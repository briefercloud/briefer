import { useStringQuery } from '@/hooks/useQueryArgs'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function WorkspacesPage() {
  const workspaceId = useStringQuery('workspaceId')
  const router = useRouter()

  useEffect(() => {
    router.replace(`/workspaces/${workspaceId}/documents`)
  }, [workspaceId])

  return null
}
