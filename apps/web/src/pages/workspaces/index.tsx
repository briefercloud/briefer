import { useSession, useSignout } from '@/hooks/useAuth'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function WorkspacesPage() {
  const router = useRouter()
  const [{ isLoading, data }] = useWorkspaces()
  const signOut = useSignout()
  const session = useSession()

  useEffect(() => {
    if (isLoading || session.isLoading) {
      return
    }

    const workspace =
      data.find(
        (workspace) => workspace.id === session.data?.lastVisitedWorkspaceId
      ) ??
      data.find((workspace) => workspace.ownerId === session.data?.id) ??
      data[0]
    if (!workspace) {
      signOut()
    } else {
      router.replace(`/workspaces/${workspace.id}/documents`)
    }
  }, [isLoading, data, signOut, router])

  return null
}
