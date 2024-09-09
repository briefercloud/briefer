import { MonacoContext } from '@/components/MonacoProvider'
import { useContext, useMemo } from 'react'

const useAllCodeEditorsReady = (): boolean => {
  const [{ editorReadiness }] = useContext(MonacoContext)

  const allEditorsReady = useMemo(() => {
    const allEditorsReady = Object.values(editorReadiness).every(
      (isReady) => isReady
    )
    return allEditorsReady
  }, [editorReadiness])

  return allEditorsReady
}

export default useAllCodeEditorsReady
