import type { ApiDocument } from '@briefer/database'
import useSWR, { SWRResponse } from 'swr'
import fetcher from '@/utils/fetcher'

type UseDocument = SWRResponse<ApiDocument>

function usePublicDocument(documentId: string): UseDocument {
  return useSWR<ApiDocument>(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/public/documents/${documentId}`,
    fetcher
  )
}

export default usePublicDocument
