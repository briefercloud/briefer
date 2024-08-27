import { ExecutionSchedule as PrismaExecutionSchedule } from '@prisma/client'

import prisma from './index.js'

export type HourlySchedule = {
  type: 'hourly'
  documentId: string
  minute: number
  timezone: string
}

export type DailySchedule = {
  type: 'daily'
  documentId: string
  hour: number
  minute: number
  timezone: string
}

export type WeeklySchedule = {
  type: 'weekly'
  documentId: string
  hour: number
  minute: number
  weekdays: number[]
  timezone: string
}

export type MonthlySchedule = {
  type: 'monthly'
  documentId: string
  hour: number
  minute: number
  days: number[]
  timezone: string
}

export type CronSchedule = {
  type: 'cron'
  documentId: string
  cron: string
  timezone: string
}

export type ScheduleParams =
  | HourlySchedule
  | DailySchedule
  | WeeklySchedule
  | MonthlySchedule
  | CronSchedule

export type ExecutionSchedule = {
  id: string
} & ScheduleParams

export function createSchedule(
  scheduleParams: ScheduleParams
): Promise<ExecutionSchedule> {
  return prisma().$transaction(async (prisma) => {
    let schedule: PrismaExecutionSchedule
    switch (scheduleParams.type) {
      case 'hourly':
        schedule = await prisma.executionSchedule.create({
          data: {
            type: 'hourly',
            documentId: scheduleParams.documentId,
            minute: scheduleParams.minute!,
            timezone: scheduleParams.timezone,
          },
        })
        break
      case 'daily':
        schedule = await prisma.executionSchedule.create({
          data: {
            type: 'daily',
            documentId: scheduleParams.documentId,
            hour: scheduleParams.hour,
            minute: scheduleParams.minute,
            timezone: scheduleParams.timezone,
          },
        })
        break
      case 'weekly':
        schedule = await prisma.executionSchedule.create({
          data: {
            type: 'weekly',
            documentId: scheduleParams.documentId,
            hour: scheduleParams.hour,
            minute: scheduleParams.minute,
            weekdays: JSON.stringify(scheduleParams.weekdays),
            timezone: scheduleParams.timezone,
          },
        })
        break
      case 'monthly':
        schedule = await prisma.executionSchedule.create({
          data: {
            type: 'monthly',
            documentId: scheduleParams.documentId,
            hour: scheduleParams.hour,
            minute: scheduleParams.minute,
            days: JSON.stringify(scheduleParams.days),
            timezone: scheduleParams.timezone,
          },
        })
        break
      case 'cron':
        schedule = await prisma.executionSchedule.create({
          data: {
            type: 'cron',
            documentId: scheduleParams.documentId,
            cron: scheduleParams.cron,
            timezone: scheduleParams.timezone,
          },
        })
        break
    }

    return convertSchedule(schedule)
  })
}

export function convertSchedule(
  dbSchedule: PrismaExecutionSchedule
): ExecutionSchedule {
  switch (dbSchedule.type) {
    case 'hourly':
      return {
        id: dbSchedule.id,
        type: 'hourly',
        documentId: dbSchedule.documentId,
        minute: dbSchedule.minute!,
        timezone: dbSchedule.timezone,
      }
    case 'daily':
      return {
        id: dbSchedule.id,
        type: 'daily',
        documentId: dbSchedule.documentId,
        hour: dbSchedule.hour!,
        minute: dbSchedule.minute!,
        timezone: dbSchedule.timezone,
      }
    case 'weekly':
      return {
        id: dbSchedule.id,
        type: 'weekly',
        documentId: dbSchedule.documentId,
        hour: dbSchedule.hour!,
        minute: dbSchedule.minute!,
        weekdays: JSON.parse(dbSchedule.weekdays!),
        timezone: dbSchedule.timezone,
      }
    case 'monthly':
      return {
        id: dbSchedule.id,
        type: 'monthly',
        documentId: dbSchedule.documentId,
        hour: dbSchedule.hour!,
        minute: dbSchedule.minute!,
        days: JSON.parse(dbSchedule.days!),
        timezone: dbSchedule.timezone,
      }
    case 'cron':
      return {
        id: dbSchedule.id,
        type: 'cron',
        documentId: dbSchedule.documentId,
        cron: dbSchedule.cron!,
        timezone: dbSchedule.timezone,
      }
  }
}

export async function listExecutionSchedules(): Promise<ExecutionSchedule[]> {
  const schedules = await prisma().executionSchedule.findMany()

  return schedules.map(convertSchedule)
}

export async function getDocumentExecutionSchedule(
  docId: string
): Promise<ExecutionSchedule[]> {
  const dbSchedules = await prisma().executionSchedule.findMany({
    where: { documentId: docId },
  })

  if (!dbSchedules.length) {
    return []
  }

  return dbSchedules.map(convertSchedule)
}

export async function deleteExecutionSchedule(
  scheduleId: string
): Promise<void> {
  await prisma().executionSchedule.delete({ where: { id: scheduleId } })
}

export async function listWorkspaceExecutionSchedules(
  workspaceId: string
): Promise<ExecutionSchedule[]> {
  const schedules = await prisma().document.findMany({
    where: { workspaceId },
    include: { executionSchedules: true },
  })

  return schedules.flatMap((doc) => doc.executionSchedules.map(convertSchedule))
}
