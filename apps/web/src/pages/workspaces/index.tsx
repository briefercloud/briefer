import { useSession } from '@/hooks/useAuth'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useRouter } from 'next/router'
import { useEffect, useMemo } from 'react'

export function getUserRedirectWorkspace(
  workspaces: { id: string; ownerId: string }[],
  user: { id: string; lastVisitedWorkspaceId: string | null }
) {
  return (
    workspaces.find(
      (workspace) => workspace.id === user.lastVisitedWorkspaceId
    ) ??
    workspaces.find((workspace) => workspace.ownerId === user.id) ??
    workspaces[0]
  )
}

export default function WorkspacesPage() {
  const router = useRouter()
  const [workspaces] = useWorkspaces()
  const session = useSession({ redirectToLogin: true })

  const workspaceId = useMemo(() => {
    if (
      !workspaces.isLoading &&
      !session.isLoading &&
      workspaces.data &&
      session.data
    ) {
      return getUserRedirectWorkspace(workspaces.data, session.data)?.id
    }

    return null
  }, [workspaces.isLoading, workspaces.data, session.data, session.isLoading])

  useEffect(() => {
    if (session.isLoading) {
      return
    }

    if (workspaceId) {
      router.replace(`/workspaces/${workspaceId}/documents`)
    }
  }, [workspaceId, session.isLoading, router])

  if (!session.data) {
    return null
  }

  if (!workspaces.isLoading && !workspaceId) {
    return (
      <h4>You do not have access to any workspaces. Contact your admin.</h4>
    )
  }

  return null
}
