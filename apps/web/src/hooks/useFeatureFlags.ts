import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import { FeatureFlags } from '@briefer/types'
import { useMemo } from 'react'
import useSWR from 'swr'

const defaultFeatureFlags: FeatureFlags = {
  visualizationsV2: false,
}

export default function useFeatureFlags(workspaceId: string): FeatureFlags {
  const { data } = useSWR<FeatureFlags>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/flags`,
    fetcher
  )

  return useMemo(() => data ?? defaultFeatureFlags, [data])
}
