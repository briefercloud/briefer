import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import { useCallback, useMemo, useState } from 'react'

export type CSVResult = {
  data?: Blob
  loading: boolean
  error?: Error
}

export type CSVAPI = (queryId: string, name: string) => Promise<Blob>

export type UseCSV = [CSVResult, CSVAPI]

export const useCSV = (workspaceId: string, documentId: string): UseCSV => {
  const [state, setState] = useState<CSVResult>({
    data: undefined,
    loading: false,
    error: undefined,
  })

  const run = useCallback(
    async (queryId: string, name: string) => {
      setState((s) => ({ ...s, error: undefined, loading: true }))

      try {
        const res = await fetch(
          `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/documents/${documentId}/queries/${queryId}/csv?name=${name}`,
          { credentials: 'include' }
        )

        if (res.status !== 200) {
          throw new Error(`Request returned ${res.status}`)
        }

        if (!res.body) {
          throw new Error('Response has no body')
        }

        const blob = await res.blob()

        setState({ loading: false, error: undefined, data: blob })
        return blob
      } catch (err) {
        setState({ loading: false, error: err as Error })
        throw err
      }
    },
    [workspaceId, documentId, setState]
  )

  return useMemo(() => [state, run], [state, run])
}
