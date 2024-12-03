import { useSession } from '@/hooks/useAuth'
import useProperties from '@/hooks/useProperties'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function Index() {
  const session = useSession({ redirectToLogin: false })
  const router = useRouter()
  const properties = useProperties()

  useEffect(() => {
    if (session.isLoading || properties.isLoading) {
      return
    }

    if (session.data) {
      router.replace('/workspaces')
    } else if (properties.data?.needsSetup) {
      router.replace('/setup')
    } else {
      router.replace('/auth/signin')
    }
  }, [
    router,
    session.isLoading,
    properties.isLoading,
    session.data,
    properties.data,
  ])

  if (!session.data && !properties.isLoading && !properties.data) {
    return (
      <h4>Could not load properties. Please try again or contact support.</h4>
    )
  }

  return null
}
