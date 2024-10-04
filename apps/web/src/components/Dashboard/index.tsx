import * as Y from 'yjs'
import { useCallback, useMemo, useState } from 'react'
import { SquaresPlusIcon } from '@heroicons/react/24/solid'
import { BookUpIcon } from 'lucide-react'
import { EyeIcon } from '@heroicons/react/24/outline'

import Layout from '@/components/Layout'
import { useLastUpdatedAt, useYDoc } from '@/hooks/useYDoc'
import { ApiDocument, UserWorkspaceRole } from '@briefer/database'
import DashboardView from './DashboardView'
import DashboardControls from './DashboardControls'
import { useDataSources } from '@/hooks/useDatasources'
import { BlockType } from '@briefer/editor'
import { useRouter } from 'next/router'
import Link from 'next/link'
import DashboardSkeleton from './DashboardSkeleton'
import RunAllV2 from '../RunAllV2'
import ShareDropdown from '../ShareDropdown'
import DashboardNotebookGroupButton from '../DashboardNotebookGroupButton'
import { isNil } from 'ramda'
import EllipsisDropdown from '../EllipsisDropdown'
import Comments from '../Comments'
import Schedules from '../Schedules'
import Snapshots from '../Snapshots'
import LiveButton from '../LiveButton'
import EnvBar from '../EnvBar'
import Files from '../Files'
import { PublishBlinkingSignal } from '../BlinkingSignal'
import { Tooltip } from '../Tooltips'
import { NEXT_PUBLIC_PUBLIC_URL } from '@/utils/env'

interface Props {
  document: ApiDocument
  userId: string
  role: UserWorkspaceRole
  isEditing: boolean
  publish: () => Promise<void>
  publishing: boolean
}
export default function Dashboard(props: Props) {
  const clock = useMemo(() => {
    if (props.isEditing) {
      return props.document.clock
    }

    return props.document.userAppClock[props.userId] ?? props.document.appClock
  }, [
    props.isEditing,
    props.document.clock,
    props.document.userAppClock,
    props.userId,
  ])

  const { yDoc, syncing, isDirty } = useYDoc(
    props.document.id,
    !props.isEditing,
    clock,
    props.userId,
    props.document.publishedAt,
    true,
    null
  )

  const router = useRouter()

  const onPublish = useCallback(async () => {
    if (props.publishing) {
      return
    }

    await props.publish()
    router.push(
      `/workspaces/${props.document.workspaceId}/documents/${props.document.id}/dashboard`
    )
  }, [props.publish, props.publishing])

  const copyLink = useMemo(
    () =>
      `${NEXT_PUBLIC_PUBLIC_URL()}/workspaces/${
        props.document.workspaceId
      }/documents/${props.document.id}`,
    [router]
  )

  const documentTitle = useMemo(
    () => props.document.title || 'Untitled',
    [props.document.title]
  )

  const [selectedSidebar, setSelectedSidebar] = useState<
    'comments' | 'schedules' | 'snapshots' | 'files' | null
  >(null)

  const onHideSidebar = useCallback(() => {
    setSelectedSidebar(null)
  }, [setSelectedSidebar])

  const onToggleComments = useCallback(() => {
    setSelectedSidebar((v) => (v === 'comments' ? null : 'comments'))
  }, [setSelectedSidebar])

  const onToggleSchedules = useCallback(() => {
    setSelectedSidebar((v) => (v === 'schedules' ? null : 'schedules'))
  }, [setSelectedSidebar])

  const onToggleSnapshots = useCallback(() => {
    setSelectedSidebar((v) => (v === 'snapshots' ? null : 'snapshots'))
  }, [setSelectedSidebar])

  const onToggleFiles = useCallback(() => {
    setSelectedSidebar((v) => (v === 'files' ? null : 'files'))
  }, [setSelectedSidebar])

  const isDeleted = !isNil(props.document.deletedAt)

  const onGoToApp = useCallback(() => {
    router.push(
      `/workspaces/${props.document.workspaceId}/documents/${props.document.id}/dashboard`
    )
  }, [router])

  const topBarContent = (
    <div className="flex items-center w-full justify-between">
      <div className="w-full overflow-hidden flex items-center gap-x-1.5 text-sm text-gray-400 font-sans">
        {props.isEditing ? (
          <SquaresPlusIcon className="w-4 h-4" />
        ) : (
          <EyeIcon className="w-4 h-4" />
        )}
        <span className="w-full truncate">
          <span className="font-semibold">
            {props.isEditing ? (
              'Editing'
            ) : (
              <span className="text-ceramic-500">Viewing</span>
            )}
          </span>{' '}
          {documentTitle}
        </span>
      </div>
      <DashboardNotebookGroupButton
        workspaceId={props.document.workspaceId}
        documentId={props.document.id}
        current="dashboard"
        isEditing={props.isEditing}
      />
      <div className="w-full justify-end flex items-center gap-x-2 h-[30px]">
        {props.isEditing && (
          <LiveButton
            onClick={onGoToApp}
            disabled={!props.document.publishedAt}
            tooltipActive={!props.document.publishedAt}
          />
        )}
        <ShareDropdown
          link={copyLink}
          isPublic={false}
          onTogglePublic={() => {}}
          workspaceId={props.document.workspaceId}
          documentId={props.document.id}
          documentTitle={documentTitle}
          role={props.role}
          isDashboard={true}
          isApp={!props.isEditing}
        />
        {props.role !== 'viewer' && props.isEditing && (
          <>
            <Tooltip
              title="Click to publish"
              message="This dashboard has unpublished changes."
              active={props.document.publishedAt !== null && isDirty}
              position="bottom"
              tooltipClassname="w-40"
            >
              <button
                className="flex items-center rounded-sm px-3 py-1 text-sm bg-primary-200 hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-50 gap-x-1.5 group"
                onClick={onPublish}
                disabled={props.publishing}
              >
                <BookUpIcon
                  className="w-4 h-4 rotate-12 group-hover:rotate-0 transition transition-transform duration-400"
                  strokeWidth={1}
                />
                {isDirty && props.document.publishedAt && (
                  <PublishBlinkingSignal />
                )}
                <span>Publish</span>
              </button>
            </Tooltip>
          </>
        )}
        {!props.isEditing && props.role !== 'viewer' && (
          <Link
            className="flex gap-x-2 items-center rounded-sm px-3 py-1 text-sm text-gray-500 bg-white hover:bg-gray-100 border border-gray-200 disabled:cursor-not-allowed disabled:opacity-50 gap-x-1.5 justify-center"
            href={`/workspaces/${props.document.workspaceId}/documents/${props.document.id}/dashboard/edit`}
          >
            <SquaresPlusIcon className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        )}
        <EllipsisDropdown
          onToggleSchedules={onToggleSchedules}
          onToggleSnapshots={onToggleSnapshots}
          onToggleComments={onToggleComments}
          onToggleFiles={onToggleFiles}
          isViewer={props.role === 'viewer'}
          isDeleted={isDeleted}
          isFullScreen={false}
        />
      </div>
    </div>
  )

  const lastUpdatedAt = useLastUpdatedAt(yDoc)

  return (
    <Layout
      topBarClassname={!props.isEditing ? 'bg-gray-50' : undefined}
      topBarContent={topBarContent}
    >
      <div className="w-full flex relative subpixel-antialiased bg-dashboard-gray">
        <div className="w-full flex flex-col relative">
          {syncing ? (
            <DashboardSkeleton />
          ) : (
            <DashboardContent
              {...props}
              isEditing={props.isEditing}
              yDoc={yDoc}
            />
          )}
        </div>

        <div className="w-full fixed bottom-0 bg-white z-20">
          <EnvBar
            onOpenFiles={onToggleFiles}
            publishedAt={!props.isEditing ? props.document.publishedAt : null}
            lastUpdatedAt={lastUpdatedAt}
          />
        </div>

        {!props.isEditing && (
          <RunAllV2 disabled={false} yDoc={yDoc} primary={true} />
        )}
        <Comments
          workspaceId={props.document.workspaceId}
          documentId={props.document.id}
          visible={selectedSidebar === 'comments'}
          onHide={onHideSidebar}
        />
        {props.role !== 'viewer' && !isDeleted && (
          <>
            <Schedules
              workspaceId={props.document.workspaceId}
              documentId={props.document.id}
              isPublished={props.document.publishedAt !== null}
              visible={selectedSidebar === 'schedules'}
              onHide={onHideSidebar}
              onPublish={onPublish}
              publishing={props.publishing}
            />
            <Snapshots
              workspaceId={props.document.workspaceId}
              documentId={props.document.id}
              visible={selectedSidebar === 'snapshots'}
              onHide={onHideSidebar}
              isPublished={props.document.publishedAt !== null}
            />
            <Files
              workspaceId={props.document.workspaceId}
              visible={selectedSidebar === 'files'}
              onHide={onHideSidebar}
              yDoc={yDoc}
            />
          </>
        )}
      </div>
    </Layout>
  )
}

export type DraggingBlock = {
  id: string
  type: BlockType
  width: number
  height: number
}
function DashboardContent(props: Props & { yDoc: Y.Doc }) {
  const [{ data: dataSources }] = useDataSources(props.document.workspaceId)
  const [draggingBlock, setDraggingBlock] = useState<DraggingBlock | null>(null)
  const [latestBlockId, setLatestBlockId] = useState<string | null>(null)

  const onDragStart = useCallback((draggingBlock: DraggingBlock) => {
    setDraggingBlock(draggingBlock)
  }, [])

  const onAddBlock = useCallback(
    (blockId: string) => {
      setLatestBlockId(blockId)
    },
    [setLatestBlockId]
  )

  return (
    <div className="flex h-full">
      <DashboardView
        className="flex-1"
        document={props.document}
        dataSources={dataSources}
        yDoc={props.yDoc}
        draggingBlock={draggingBlock}
        latestBlockId={latestBlockId}
        isEditing={props.isEditing}
      />
      {props.isEditing && (
        <DashboardControls
          document={props.document}
          dataSources={dataSources}
          yDoc={props.yDoc}
          onDragStart={onDragStart}
          onAddBlock={onAddBlock}
        />
      )}
    </div>
  )
}
