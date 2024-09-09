import useSWR, { SWRResponse } from 'swr'
import fetcher from '@/utils/fetcher'

type YJSState = {
  state: Buffer
}
type UseDocument = SWRResponse<YJSState>

function usePublicDocumentYJSState(documentId: string): UseDocument {
  return useSWR<YJSState>(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/public/documents/${documentId}/yjs`,
    async (url: string) => {
      const body = await fetcher<{ state: string }>(url)
      return { state: Buffer.from(body.state, 'base64') }
    }
  )
}

export default usePublicDocumentYJSState
