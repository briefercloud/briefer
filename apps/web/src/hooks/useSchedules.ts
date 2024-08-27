import { CreateSchedulePayload } from '@/components/Schedules/AddScheduleForm'
import fetcher from '@/utils/fetcher'
import type { ExecutionSchedule } from '@briefer/database'
import { useCallback, useMemo } from 'react'
import useSWR from 'swr'

type API = {
  createSchedule: (payload: CreateSchedulePayload) => Promise<ExecutionSchedule>
  deleteSchedule: (id: string) => Promise<void>
}

type UseSchedules = [ExecutionSchedule[], API]
export const useSchedules = (
  workspaceId: string,
  docId: string
): UseSchedules => {
  const { data, mutate } = useSWR<ExecutionSchedule[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/documents/${docId}/schedules`,
    fetcher
  )

  const schedules = useMemo(() => data ?? [], [data])

  const createSchedule = useCallback(
    async (payload: CreateSchedulePayload) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/documents/${docId}/schedules`,
        {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const schedule: ExecutionSchedule = await res.json()

      mutate((schedules ?? []).concat([schedule]))

      return schedule
    },
    [docId, mutate, schedules, workspaceId]
  )

  const deleteSchedule = useCallback(
    async (id: string) => {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/documents/${docId}/schedules/${id}`,
        {
          credentials: 'include',
          method: 'DELETE',
        }
      )

      mutate(schedules.filter((s) => s.id !== id))
    },
    [docId, mutate, schedules, workspaceId]
  )

  return useMemo(
    () => [schedules, { createSchedule, deleteSchedule }],
    [schedules, createSchedule, deleteSchedule]
  )
}
