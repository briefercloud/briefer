import {
  prisma,
  Document,
  ExecutionSchedule,
  listExecutionSchedules,
  YjsAppDocument,
} from '@briefer/database'
import { CronJob } from 'cron'
import { logger } from '../logger.js'
import { IOServer } from '../websocket/index.js'
import * as yjs from '../yjs/v2/index.js'
import { AppPersistor } from '../yjs/v2/persistors.js'
import { ExecutionQueue } from '@briefer/editor'
import { updateAppState } from '../yjs/v2/documents.js'
import { acquireLock } from '../lock.js'

function convertToCron(schedule: ExecutionSchedule): string {
  switch (schedule.type) {
    case 'hourly':
      return `0 ${schedule.minute} * * * *`
    case 'daily':
      return `0 ${schedule.minute} ${schedule.hour} * * *`
    case 'weekly':
      const weekdaysCron = schedule.weekdays
        .map((day: number) => day % 7)
        .join(',')
      return `0 ${schedule.minute} ${schedule.hour} * * ${weekdaysCron}`
    case 'monthly':
      // Days are not zero-indexed for cron
      const daysCron = schedule.days.map((d) => d + 1).join(',')
      return `0 ${schedule.minute} ${schedule.hour} ${daysCron} * *`
    case 'cron':
      return schedule.cron!
  }
}

type Job = {
  job: CronJob<null, string>
  cron: string
}

export async function runSchedule(socketServer: IOServer) {
  const jobs: Map<string, Job> = new Map()
  const running: Map<string, Promise<void>> = new Map()

  const updateSchedule = async () => {
    const schedules = await listExecutionSchedules()
    const schedulesToDelete = new Set(jobs.keys())
    const counters = {
      created: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0,
    }

    for (const schedule of schedules) {
      try {
        schedulesToDelete.delete(schedule.id)

        const docId = schedule.documentId
        const cron = convertToCron(schedule)

        const existingJob = jobs.get(schedule.id)
        if (existingJob) {
          if (existingJob.cron === cron) {
            counters.unchanged++
            continue
          }

          logger().info(
            {
              scheduleId: schedule.id,
              documentId: docId,
              previousCron: existingJob.cron,
              newCron: cron,
              module: 'schedule',
            },
            'Schedule changed'
          )
          existingJob.job.stop()
          counters.updated++
        } else {
          counters.created++
        }

        logger().info(
          {
            scheduleId: schedule.id,
            documentId: docId,
            cron,
            module: 'schedule',
          },
          'Creating schedule'
        )

        const job = CronJob.from<null, string>({
          cronTime: cron,
          onTick: function () {
            async function tick(documentId: string) {
              logger().info(
                { scheduleId: schedule.id, documentId, module: 'schedule' },
                `Starting schedule tick for Document(${documentId})`
              )

              const document = await prisma().document.findUniqueOrThrow({
                where: { id: docId },
              })

              if (document.deletedAt !== null) {
                logger().info(
                  { scheduleId: schedule.id, documentId, module: 'schedule' },
                  `Document(${documentId}) is soft deleted, skipping execution`
                )
                return
              }

              logger().info(
                { scheduleId: schedule.id, documentId, module: 'schedule' },
                `Executing schedule for Document(${documentId})`
              )

              try {
                await executeDocument(schedule.id, document, socketServer)
              } catch (err) {
                logger().error(
                  {
                    err,
                    scheduleId: schedule.id,
                    documentId: documentId,
                    module: 'schedule',
                  },
                  `Fail to execute schedule for Document(${documentId})`
                )
              }

              logger().info(
                {
                  scheduleId: schedule.id,
                  documentId: documentId,
                  module: 'schedule',
                },
                `Finish Document(${documentId}) execution`
              )
            }

            const promise = tick(docId)
              .then(() => {
                running.delete(schedule.id)
              })
              .catch((err) => {
                running.delete(schedule.id)
                throw err
              })

            running.set(schedule.id, promise)
            return promise
          },
          start: true,
          timeZone: schedule.timezone,
          context: docId,
        })

        jobs.set(schedule.id, { job, cron })
      } catch (err) {
        logger().error(
          {
            err,
            module: 'schedule',
            documentId: schedule.documentId,
            scheduleId: schedule.id,
          },
          'Failed to update schedule'
        )
      }
    }

    for (const scheduleId of schedulesToDelete) {
      logger().info(
        { scheduleId, module: 'schedule' },
        `Removing Schedule(${scheduleId})`
      )
      jobs.get(scheduleId)?.job.stop()
      jobs.delete(scheduleId)
      counters.deleted++
    }

    if (counters.created > 0 || counters.updated > 0 || counters.deleted > 0) {
      logger().info(
        {
          created: counters.created,
          updated: counters.updated,
          deleted: counters.deleted,
          unchanged: counters.unchanged,
          module: 'schedule',
        },
        'Updated schedules'
      )
    }
  }

  let stop = false
  let lockAcquired = false
  const loop = new Promise<void>(async (resolve) => {
    logger().trace('Acquiring lock to be the schedule executor')
    await acquireLock('schedule-executor', async () => {
      lockAcquired = true
      if (stop) {
        logger().trace(
          'Schedule executor lock acquired but server is shutting down'
        )
        return
      }

      logger().trace('Schedule executor lock acquired')
      while (true) {
        if (stop) {
          break
        }

        try {
          await updateSchedule()
        } catch (err) {
          logger().error(
            { err, module: 'schedule' },
            'Failed to update schedule'
          )
        }

        if (stop) {
          break
        }

        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    })

    resolve()
  })

  return async () => {
    logger().info('[shutdown] Stopping schedule')

    stop = true
    if (lockAcquired) {
      // it only makes sense to wait for the loop if we acquired the lock
      // otherwise we might get stuck here waiting forever
      await loop
    }

    for (const job of jobs.values()) {
      job.job.stop()
    }

    while (running.size > 0) {
      logger().info(
        { running: running.size },
        '[shutdown] Waiting for running jobs to finish'
      )
      for (const promise of running.values()) {
        await promise
      }
    }

    logger().info('[shutdown] All jobs finished')
    return loop
  }
}

async function executeDocument(
  scheduleId: string,
  doc: Document,
  socketServer: IOServer
) {
  try {
    const yjsApp = await prisma().yjsAppDocument.findFirst({
      where: { documentId: doc.id },
      // fetch latest version
      orderBy: { createdAt: 'desc' },
    })
    if (!yjsApp) {
      throw new Error('Trying to run a schedule for a never saved document')
    }

    await executeNotebook(scheduleId, socketServer, doc, yjsApp)
  } catch (err) {
    logger().error(
      { err, documentId: doc.id, scheduleId, module: 'schedule' },
      `Failed to execute Document(${doc.id})`
    )
  }
}

async function executeNotebook(
  scheduleId: string,
  socketServer: IOServer,
  doc: Document,
  app: YjsAppDocument
): Promise<void> {
  let emptyLayout = true
  while (emptyLayout) {
    const id = yjs.getDocId(doc.id, app ? { id: app.id, userId: null } : null)
    emptyLayout = await yjs.getYDocForUpdate(
      id,
      socketServer,
      doc.id,
      doc.workspaceId,
      async (ydoc) => {
        if (ydoc.layout.length === 0) {
          return true
        }

        const executionQueue = ExecutionQueue.fromYjs(ydoc.ydoc)
        const batch = executionQueue.enqueueRunAll(ydoc.layout, ydoc.blocks, {
          _tag: 'schedule',
          scheduleId,
        })
        await batch.waitForCompletion()
        await updateAppState(ydoc, app, socketServer)
        return false
      },
      new AppPersistor(id, app.id, null) // user is null when running a schedule
    )

    if (emptyLayout) {
      logger().error(
        {
          documentId: doc.id,
          yjsAppDocumentId: app?.id ?? null,
          scheduleId,
          module: 'schedule',
        },
        'doc had empty layout, retrying'
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}
