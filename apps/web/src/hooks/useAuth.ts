import fetcher from '@/utils/fetcher'
import type { ApiUser, UserWorkspaceRole } from '@briefer/database'
import { useRouter } from 'next/router'
import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'

type UseAuthError = 'unexpected' | 'invalid-creds'
type AuthState = {
  loading: boolean
  data?: { email: string; loginLink?: string }
  error?: UseAuthError
}

type SignupApi = { signupWithEmail: (email: string) => void }
type UseSignup = [AuthState, SignupApi]
export const useSignup = (): UseSignup => {
  const [state, setState] = useState<{
    loading: boolean
    data?: { email: string }
    error?: 'unexpected'
  }>({
    loading: false,
    data: undefined,
    error: undefined,
  })

  const signupWithEmail = useCallback(
    (email: string) => {
      setState((s) => ({ ...s, loading: true }))
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sign-up/email`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          callback: process.env.NEXT_PUBLIC_PUBLIC_URL,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            setState({
              loading: false,
              data: await res.json(),
              error: undefined,
            })
            return
          }

          throw new Error(`Unexpected status ${res.status}`)
        })
        .catch(() => {
          setState((s) => ({ ...s, loading: false, error: 'unexpected' }))
        })
    },
    [setState]
  )

  return useMemo(() => [state, { signupWithEmail }], [state, signupWithEmail])
}

type LoginAPI = {
  loginWithEmail: (email: string) => void
  loginWithPassword: (email: string, password: string) => void
}
type UseLogin = [AuthState, LoginAPI]
export const useLogin = (): UseLogin => {
  const [state, setState] = useState<AuthState>({
    loading: false,
    data: undefined,
    error: undefined,
  })

  const loginWithEmail = useCallback(
    (email: string) => {
      setState((s) => ({ ...s, loading: true }))
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/link/request`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          callback: process.env.NEXT_PUBLIC_PUBLIC_URL,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            setState({
              loading: false,
              data: await res.json(),
              error: undefined,
            })
            return
          }

          throw new Error(`Unexpected status ${res.status}`)
        })
        .catch(() => {
          setState((s) => ({ ...s, loading: false, error: 'unexpected' }))
        })
    },
    [setState]
  )

  const loginWithPassword = useCallback(
    (email: string, password: string) => {
      setState((s) => ({ ...s, loading: true }))
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sign-in/password`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
        .then(async (res) => {
          if (res.ok) {
            setState({
              loading: false,
              data: await res.json(),
              error: undefined,
            })
            return
          }

          if (res.status === 400) {
            setState({
              loading: false,
              error: 'invalid-creds',
            })
            return
          }

          throw new Error(`Unexpected status ${res.status}`)
        })
        .catch(() => {
          setState((s) => ({ ...s, loading: false, error: 'unexpected' }))
        })
    },
    [setState]
  )

  return useMemo(
    () => [state, { loginWithEmail, loginWithPassword }],
    [state, loginWithEmail]
  )
}

export type SessionUser = ApiUser & {
  userHash: string
  roles: Record<string, UserWorkspaceRole>
}

export const useSession = () =>
  useSWR<SessionUser>(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/session`,
    fetcher
  )

export const useSignout = () => {
  const router = useRouter()
  return useCallback(
    (callback?: string) => {
      const cb = callback ?? process.env.NEXT_PUBLIC_PUBLIC_URL!
      router.push(
        `${
          process.env.NEXT_PUBLIC_API_URL
        }/auth/logout?callback=${encodeURIComponent(cb)}`
      )
    },
    [router]
  )
}
