import fetcher from '@/utils/fetcher'
import type {
  ApiUser,
  UserWorkspaceRole,
  WorkspaceUser,
} from '@briefer/database'
import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import type { UserFormValues } from '@/components/forms/user'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'

type UpdateUserPayload = {
  name?: string
  role?: UserWorkspaceRole
  currentPassword?: string
  newPassword?: string
}
type API = {
  createUser: (
    payload: UserFormValues
  ) => Promise<ApiUser & { password?: string }>
  updateUser: (
    id: string,
    payload: UpdateUserPayload
  ) => Promise<null | 'invalid-payload' | 'forbidden' | 'incorrect-password'>
  removeUser: (id: string) => void
  resetPassword: (id: string) => Promise<string>
}

type UseUsers = [WorkspaceUser[], API]

export const useUsers = (workspaceId: string): UseUsers => {
  const { data, mutate } = useSWR<WorkspaceUser[]>(
    `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/users`,
    fetcher
  )

  const users = useMemo(() => data ?? [], [data])

  const createUser = useCallback(
    async (payload: UserFormValues) => {
      if (!workspaceId) {
        throw new Error('Missing workspaceId')
      }

      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/users`,
        {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      )
      if (res.status > 299) {
        throw new Error(`Unexpected status ${res.status}`)
      }

      const user = await res.json()
      mutate([...users, user])
      return user
    },
    [workspaceId]
  )

  const updateUser = useCallback(
    async (id: string, payload: UpdateUserPayload) => {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/users/${id}`,
        {
          credentials: 'include',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      )
      if (res.status === 403) {
        return 'forbidden'
      }

      if (res.status === 400) {
        const { reason } = await res.json()
        return reason
      }

      const user = await res.json()
      mutate(
        users.map((u) => {
          if (u.id === id) {
            return user
          }

          return u
        })
      )
      return null
    },
    [mutate, users, workspaceId]
  )

  const removeUser = useCallback(
    async (id: string) => {
      const data = await fetch(
        `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/users/${id}`,
        {
          credentials: 'include',
          method: 'DELETE',
        }
      )

      if (data.ok) {
        mutate(users.filter((u) => u.id !== id))
      } else {
        // TODO proper error handling
        alert('Failed to remove user')
      }
    },
    [mutate, users, workspaceId]
  )

  const resetPassword = useCallback(
    async (id: string) => {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/users/${id}/reset-password`,
        {
          credentials: 'include',
          method: 'POST',
        }
      )

      if (res.ok) {
        const { password } = await res.json()
        return password
      }

      if (res.status === 403) {
        alert('You are not allowed to reset this user password')
        return
      }

      alert('Failed to reset password')
    },
    [workspaceId]
  )

  return useMemo(
    () => [users, { createUser, updateUser, resetPassword, removeUser }],
    [createUser, removeUser, resetPassword, users]
  )
}
