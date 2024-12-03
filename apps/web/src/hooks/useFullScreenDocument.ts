import { useCallback } from 'react'
import { useSession } from './useAuth'
import { useLocalStorage } from '@uidotdev/usehooks'

type UseFullScreenDocument = [
  boolean,
  {
    toggle: () => void
  }
]
function useFullScreenDocument(documentId: string): UseFullScreenDocument {
  const { data: user } = useSession({ redirectToLogin: true })
  const [isFullScreen, setIsFullScreen] = useLocalStorage(
    `briefer-user-${user?.id}-doc-${documentId}-fullscreen`,
    false
  )

  const toggle = useCallback(() => {
    setIsFullScreen((prev) => !prev)
  }, [setIsFullScreen])

  return [isFullScreen, { toggle }]
}

export default useFullScreenDocument
