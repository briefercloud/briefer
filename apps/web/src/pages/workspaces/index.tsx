import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function WorkspacesPage() {
  const router = useRouter()
  const [{ isLoading, data }] = useWorkspaces()

  useEffect(() => {
    if (isLoading) {
      return
    }

    const workspace = data[0]
    if (!workspace) {
      router.replace('/new-workspace')
    } else {
      router.replace(`/workspaces/${workspace.id}/documents`)
    }
  }, [isLoading, data])

  return null
}
