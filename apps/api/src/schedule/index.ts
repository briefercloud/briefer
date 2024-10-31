import * as Y from 'yjs'
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
import { RunAllExecutor } from '../yjs/v2/executors/run-all.js'
import PQueue from 'p-queue'
import { AppPersistor, DocumentPersistor } from '../yjs/v2/persistors.js'
import { YBlock } from '@briefer/editor'
import { ScheduleNotebookEvents } from '../events/schedule.js'
import { updateAppState } from '../yjs/v2/documents.js'

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

  let stop = false
  const loop = new Promise<void>(async (resolve) => {
    while (true) {
      try {
        await updateSchedule()
      } catch (err) {
        logger().error({ err, module: 'schedule' }, 'Failed to update schedule')
      }

      if (stop) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    resolve()
  })

  return async () => {
    logger().info('[shutdown] Stopping schedule')

    stop = true
    await loop

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
      throw new Error('Trying to run a schedule for a never published document')
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
): Promise<YBlock | null> {
  const events = new ScheduleNotebookEvents()

  while (true) {
    const id = yjs.getDocId(doc.id, app ? { id: app.id, userId: null } : null)
    const failedBlock = await yjs.getYDocForUpdate(
      id,
      socketServer,
      doc.id,
      doc.workspaceId,
      async (ydoc) => {
        const runAll = ydoc.runAll
        runAll.setAttribute('status', 'schedule-running')

        if (ydoc.layout.length === 0) {
          return undefined
        }

        const executor = RunAllExecutor.make(
          doc.workspaceId,
          doc.id,
          ydoc.blocks,
          ydoc.layout,
          ydoc.runAll,
          ydoc.dataframes,
          new PQueue({ concurrency: 1 }),
          events
        )
        try {
          const tr = new Y.Transaction(ydoc.ydoc, { scheduleId }, true)
          const failedBlock = await executor.run(tr)
          runAll.setAttribute('status', 'idle')

          await updateAppState(ydoc, app, socketServer)

          return failedBlock
        } catch (e) {
          runAll.setAttribute('status', 'idle')
          throw e
        }
      },
      app
        ? new AppPersistor(app.id, null) // user is null when running a schedule
        : new DocumentPersistor(doc.id)
    )
    if (failedBlock === undefined) {
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
      continue
    }

    return failedBlock
  }
}
