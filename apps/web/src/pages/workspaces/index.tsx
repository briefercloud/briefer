import { useSignout } from '@/hooks/useAuth'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function WorkspacesPage() {
  const router = useRouter()
  const [{ isLoading, data }] = useWorkspaces()
  const signOut = useSignout()

  useEffect(() => {
    if (isLoading) {
      return
    }

    const workspace = data[0]
    if (!workspace) {
      signOut()
    } else {
      router.replace(`/workspaces/${workspace.id}/documents`)
    }
  }, [isLoading, data, signOut, router])

  return null
}
