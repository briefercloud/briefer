import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { useStringQuery } from '@/hooks/useQueryArgs'
import type { EnvironmentStatus } from '@briefer/database'
import {
  ArrowPathIcon,
  CodeBracketIcon,
  CpuChipIcon,
  FolderIcon,
  // NewspaperIcon,
} from '@heroicons/react/20/solid'
import { NewspaperIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'
import * as dfns from 'date-fns'
import clsx from 'clsx'

interface Props {
  onOpenFiles: () => void
  publishedAt: string | null
  lastUpdatedAt: string | null
}
function EnvBar(props: Props) {
  const workspaceId = useStringQuery('workspaceId')
  const { status, loading, restart } = useEnvironmentStatus(workspaceId)

  // distance from now
  const publishedAtDisplay = dfns.formatDistanceToNow(
    props.publishedAt ?? new Date()
  )

  const lastUpdatedAt = props.lastUpdatedAt
    ? `Last updated at ${dfns.format(
        props.lastUpdatedAt ?? new Date(),
        `hh:mm a, do 'of' MMMM yyyy`
      )}.`
    : 'Never executed.'

  return (
    <div
      className={clsx(
        'flex items-center justify-between border-t border-gray-200 py-2 px-4 font-primary',
        props.publishedAt && 'bg-gray-50'
      )}
    >
      <div className="flex items-center space-x-2">
        {props.publishedAt ? (
          <div className="flex items-center gap-x-1.5 text-sm text-gray-500 font-medium">
            <NewspaperIcon className="h-4 w-4" />
            <span>{`Published ${publishedAtDisplay} ago. ${lastUpdatedAt}`}</span>
          </div>
        ) : (
          <>
            <div>
              <EnvironmentButton name="Python 3.9" workspaceId={workspaceId} />
            </div>
            <div>
              <Link
                href={`/workspaces/${workspaceId}/environments/current/variables`}
                className="border border-gray-200 rounded-sm text-sm px-3 py-1 hover:bg-gray-50 cursor-pointer flex items-center gap-x-2"
              >
                <CodeBracketIcon className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700">Environment variables</span>
              </Link>
            </div>
            <button
              className="border border-gray-200 rounded-sm text-sm px-3 py-1 hover:bg-gray-50 cursor-pointer flex items-center gap-x-2"
              onClick={props.onOpenFiles}
            >
              <FolderIcon className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">Files</span>
            </button>
          </>
        )}
      </div>
      <div className="flex items-center">
        <StatusBadge loading={loading} status={status} onRestart={restart} />
      </div>
    </div>
  )
}

const EnvironmentButton = ({
  name,
  workspaceId,
}: {
  name: string
  workspaceId: string
}) => {
  return (
    <Link
      href={`/workspaces/${workspaceId}/environments/current`}
      className="border border-gray-200 rounded-sm text-sm px-3 py-1 hover:bg-gray-50 cursor-pointer flex items-center gap-x-2"
    >
      <CpuChipIcon className="h-4 w-4 text-gray-600" />
      <span className="text-gray-700">{name}</span>
    </Link>
  )
}

const StatusBadge = ({
  loading,
  status,
  onRestart,
}: {
  loading: boolean
  status: EnvironmentStatus | null
  onRestart: () => void
}) => {
  if (loading) {
    return <LoadingBadge>Loading</LoadingBadge>
  }

  switch (status) {
    case 'Starting':
      return <YellowBadge>Starting</YellowBadge>
    case 'Running':
      return (
        <GreenBadge>
          <div className="flex items-center gap-x-2">
            <div>Running</div>
            <div className="w-[1px] h-4 bg-green-700 opacity-50" />
            <div className="flex items-center group relative">
              <button
                onClick={onRestart}
                className="text-green-700 hover:text-green-900"
              >
                <ArrowPathIcon className="h-3 w-3" />
              </button>
              <div className="right-0 font-sans pointer-events-none absolute -top-2 -translate-y-full w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex items-center justify-center gap-y-1">
                Restart environment
              </div>
            </div>
          </div>
        </GreenBadge>
      )
    case 'Stopped':
      return <GrayBadge>Stopped</GrayBadge>
    case 'Stopping':
      return <YellowBadge>Stopping</YellowBadge>
    case 'Failing':
      return <RedBadge>Failing</RedBadge>
  }

  return <GrayBadge>Stopped</GrayBadge>
}

type BadgeProps = {
  children: React.ReactNode
}

const LoadingBadge = ({ children }: BadgeProps) => {
  return (
    <span className="inline-flex items-center gap-x-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
      <svg
        className={`h-1.5 w-1.5 fill-blue-500`}
        viewBox="0 0 6 6"
        aria-hidden="true"
      >
        {' '}
        <circle cx={3} cy={3} r={3} />{' '}
      </svg>
      <span className="text-xs">{children}</span>
    </span>
  )
}

const RedBadge = ({ children }: BadgeProps) => {
  return (
    <span className="inline-flex items-center gap-x-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
      <svg
        className={`h-1.5 w-1.5 fill-red-500`}
        viewBox="0 0 6 6"
        aria-hidden="true"
      >
        {' '}
        <circle cx={3} cy={3} r={3} />{' '}
      </svg>
      <span className="text-xs">{children}</span>
    </span>
  )
}

const GrayBadge = ({ children }: BadgeProps) => {
  return (
    <span className="inline-flex items-center gap-x-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
      <svg
        className={`h-1.5 w-1.5 fill-gray-400`}
        viewBox="0 0 6 6"
        aria-hidden="true"
      >
        <circle cx={3} cy={3} r={3} />
      </svg>
      <span className="text-xs">{children}</span>
    </span>
  )
}

const GreenBadge = ({ children }: BadgeProps) => {
  return (
    <span className="inline-flex items-center gap-x-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
      <svg
        className={`h-1.5 w-1.5 fill-green-500`}
        viewBox="0 0 6 6"
        aria-hidden="true"
      >
        <circle cx={3} cy={3} r={3} />
      </svg>
      <span className="text-xs">{children}</span>
    </span>
  )
}

const YellowBadge = ({ children }: BadgeProps) => {
  return (
    <span className="inline-flex items-center gap-x-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
      <svg
        className={`h-1.5 w-1.5 fill-yellow-500`}
        viewBox="0 0 6 6"
        aria-hidden="true"
      >
        <circle cx={3} cy={3} r={3} />
      </svg>
      <span className="text-xs">{children}</span>
    </span>
  )
}

export default EnvBar
