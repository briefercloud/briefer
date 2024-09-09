import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import { Properties } from '@briefer/types'
import useSWR from 'swr'

export default function useProperties() {
  return useSWR<Properties>(`${NEXT_PUBLIC_API_URL}/v1/properties`, fetcher)
}
