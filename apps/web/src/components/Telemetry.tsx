import { useEffect } from 'react'
import { useSession } from '@/hooks/useAuth'
import { usePostHog } from 'posthog-js/react'

export default function Telemetry() {
  const posthog = usePostHog()
  const session = useSession({ redirectToLogin: false })

  useEffect(() => {
    posthog.init('phc_hHNB1GN3QFdyn0eMH6VW4dNezbXsbSq4PE5PcL9xbju', {
      autocapture: false,
      capture_pageview: false,
    })
  }, [])

  useEffect(() => {
    if (session.data?.id) {
      posthog.identify(session.data.id)
    }

    return () => {
      posthog.reset()
    }
  }, [session.data, posthog])

  return null
}
