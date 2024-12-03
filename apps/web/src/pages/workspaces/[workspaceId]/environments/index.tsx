import { useEffect } from 'react'

import { useStringQuery } from '@/hooks/useQueryArgs'
import { useRouter } from 'next/router'

export default function EnvironmentsPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')

  useEffect(() => {
    router.push(`/workspaces/${workspaceId}/environments/current`)
  }, [workspaceId, router])

  return null
}
