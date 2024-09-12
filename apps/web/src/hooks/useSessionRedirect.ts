import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useEffect } from 'react'
import { NextRouter, useRouter } from 'next/router'
import { useSession, useSignout } from '@/hooks/useAuth'
import useProperties from './useProperties'

const redirectToLogin = (router: NextRouter) => {
  const postRedirPath = router.asPath
  const path =
    postRedirPath === '/'
      ? '/auth/signin'
      : `/auth/signin?r=${encodeURIComponent(postRedirPath)}`

  router.replace(path)
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
