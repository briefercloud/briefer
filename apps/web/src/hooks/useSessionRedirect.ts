import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useEffect, useCallback } from 'react'
import { NextRouter, useRouter } from 'next/router'
import { useSession, useSignout } from '@/hooks/useAuth'
import Cookies from 'js-cookie'
import useProperties from './useProperties'

const redirectToLogin = (router: NextRouter) => {
  const postRedirPath = router.asPath
  const path =
    postRedirPath === '/'
      ? '/auth/signin'
      : `/auth/signin?r=${encodeURIComponent(postRedirPath)}`

  router.replace(path)
}

export const useCookieCheck = () => {
  const session = useSession()
  const router = useRouter()
  const redirectOnCookieExpiry = useCallback(() => {
    if (!session.data) {
      return
    }

    const tokenExists = Cookies.get('sessionExpiry')
    const isAlreadyOnLoginPage = router.asPath.includes('/auth/signin')
    if (!tokenExists && !isAlreadyOnLoginPage) {
      redirectToLogin(router)
    }
  }, [router, session])

  useEffect(() => {
    window.addEventListener('focus', redirectOnCookieExpiry)
    const timer = setInterval(redirectOnCookieExpiry, 5000)
    return () => {
      window.removeEventListener('focus', redirectOnCookieExpiry)
      clearInterval(timer)
    }
  }, [redirectOnCookieExpiry])
}

export const useSessionRedirect = (shouldRedirect = true) => {
  const properties = useProperties()
  const router = useRouter()
  const session = useSession()
  const [workspaces] = useWorkspaces()
  const signOut = useSignout()

  useEffect(() => {
    if (
      !shouldRedirect ||
      session.isLoading ||
      workspaces.isLoading ||
      properties.isLoading ||
      !properties.data
    ) {
      return
    }

    if (!session.data) {
      if (properties.data.needsSetup) {
        router.replace('/setup')
      } else {
        redirectToLogin(router)
      }
    } else if (workspaces.data.length === 0) {
      signOut()
    } else {
      router.replace(`/workspaces/${workspaces.data[0].id}/documents`)
    }
  }, [properties, workspaces, session, router, shouldRedirect, signOut])
}
