import React, { useEffect } from 'react'

import NewWorkspace from '@/components/forms/NewWorkspace'
import { useSession } from '@/hooks/useAuth'
import { useRouter } from 'next/router'

export default function NewWorkspacePage() {
  const session = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!session.data && !session.isLoading) {
      router.replace('/')
    }
  }, [router, session])

  if (!session.data) {
    return null
  }

  return <NewWorkspace />
}
