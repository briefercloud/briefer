import fetcher from '@/utils/fetcher'
import { useMemo } from 'react'
import useSWR from 'swr'

export type Channel = {
  id: string
  name: string
  name_normalized: string
  is_channel: boolean
}

const useSlackChannels = (workspaceId: string, integrationId?: string) => {
  const { data } = useSWR<Channel[]>(
    integrationId
      ? `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/integrations/slack/${integrationId}/channels`
      : null,
    fetcher,
    { refreshInterval: 5000, keepPreviousData: true }
  )

  const channels = useMemo(() => data ?? [], [data])

  return useMemo(() => [channels], [channels])
}

export default useSlackChannels
