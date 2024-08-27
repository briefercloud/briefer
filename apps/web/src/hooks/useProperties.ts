import fetcher from '@/utils/fetcher'
import { Properties } from '@briefer/types'
import useSWR from 'swr'

export default function useProperties() {
  return useSWR<Properties>(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/properties`,
    fetcher
  )
}
