import * as Y from 'yjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SquaresPlusIcon } from '@heroicons/react/24/solid'
import { BookUpIcon } from 'lucide-react'
import { EyeIcon } from '@heroicons/react/24/outline'

import Layout from '@/components/Layout'
import { useLastUpdatedAt, useYDoc, useYDocState } from '@/hooks/useYDoc'
import { ApiDocument, UserWorkspaceRole } from '@briefer/database'
import DashboardView from './DashboardView'
import DashboardControls from './DashboardControls'
import { useDataSources } from '@/hooks/useDatasources'
import {
  AITasks,
  BlockType,
  ExecutionQueue,
  getBlocks,
  getDataframes,
  getLayout,
  switchBlockType,
  YBlock,
} from '@briefer/editor'
import { useRouter } from 'next/router'
import Link from 'next/link'
import DashboardSkeleton from './DashboardSkeleton'
import RunAllV2 from '../RunAllV2'
import ShareDropdown from '../ShareDropdown'
import DashboardNotebookGroupButton from '../DashboarNotebookGroupButton'
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
import { SQLExtensionProvider } from '../v2Editor/CodeEditor/sql'
import { SessionUser } from '@/hooks/useAuth'
import SchemaExplorer from '../schemaExplorer'
import { Transition } from '@headlessui/react'
import ScrollBar from '../ScrollBar'
import { createPortal } from 'react-dom'
import VisualizationBlock from '../v2Editor/customBlocks/visualization'
import VisualizationV2Block from '../v2Editor/customBlocks/visualizationV2'
import RichTextBlock from '../v2Editor/customBlocks/richText'
import SQLBlock from '../v2Editor/customBlocks/sql'
import PythonBlock from '../v2Editor/customBlocks/python'
import InputBlock from '../v2Editor/customBlocks/input'
import DropdownInputBlock from '../v2Editor/customBlocks/dropdownInput'
import DateInputBlock from '../v2Editor/customBlocks/dateInput'
import PivotTableBlock from '../v2Editor/customBlocks/pivotTable'
import SimpleBar from 'simplebar-react'
import clsx from 'clsx'
import { useHotkeys } from 'react-hotkeys-hook'

export type DashboardMode =
  | {
      _tag: 'live'
    }
  | {
      _tag: 'editing'
      position: 'dashboard' | 'sidebar' | 'expanded'
    }

export function dashboardModeHasControls(mode: DashboardMode): boolean {
  switch (mode._tag) {
    case 'live':
      return false
    case 'editing':
      switch (mode.position) {
        case 'sidebar':
        case 'dashboard':
          return false
        case 'expanded':
          return true
      }
  }
}

interface Props {
  document: ApiDocument
  user: SessionUser
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

    return props.document.userAppClock[props.user.id] ?? props.document.appClock
  }, [
    props.isEditing,
    props.document.clock,
    props.document.userAppClock,
    props.user,
  ])

  const { yDoc, syncing, isDirty, undo, redo } = useYDoc(
    props.document.workspaceId,
    props.document.id,
    !props.isEditing,
    clock,
    props.user.id,
    props.document.publishedAt,
    true,
    null
  )

  useHotkeys('mod+z', undo)
  useHotkeys('mod+shift+z', redo)

  const executionQueue = useMemo(
    () =>
      ExecutionQueue.fromYjs(yDoc, {
        skipDependencyCheck: !props.document.runUnexecutedBlocks,
      }),
    [yDoc]
  )
  const aiTasks = useMemo(() => AITasks.fromYjs(yDoc), [yDoc])

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

  const shareLinkWithoutSidebar = props.document.shareLinksWithoutSidebar
  const copyLink = useMemo(
    () =>
      `${NEXT_PUBLIC_PUBLIC_URL()}/workspaces/${
        props.document.workspaceId
      }/documents/${props.document.id}/dashboard${
        shareLinkWithoutSidebar ? '?sidebarCollapsed=true' : ''
      }`,
    [props.document.workspaceId, props.document.id, shareLinkWithoutSidebar]
  )

  const documentTitle = useMemo(
    () => props.document.title || 'Untitled',
    [props.document.title]
  )

  const [selectedSidebar, setSelectedSidebar] = useState<
    | { _tag: 'comments' }
    | { _tag: 'schedules' }
    | { _tag: 'snapshots' }
    | { _tag: 'files' }
    | { _tag: 'schemaExplorer'; dataSourceId: string | null }
    | { _tag: 'shortcuts' }
    | { _tag: 'reusableComponents' }
    | { _tag: 'pageSettings' }
    | null
  >(null)

  const onHideSidebar = useCallback(() => {
    setSelectedSidebar(null)
  }, [setSelectedSidebar])

  const onToggleComments = useCallback(() => {
    setSelectedSidebar((v) =>
      v?._tag === 'comments' ? null : { _tag: 'comments' }
    )
  }, [setSelectedSidebar])

  const onToggleSchedules = useCallback(() => {
    setSelectedSidebar((v) =>
      v?._tag === 'schedules' ? null : { _tag: 'schedules' }
    )
  }, [setSelectedSidebar])

  const onToggleSnapshots = useCallback(() => {
    setSelectedSidebar((v) =>
      v?._tag === 'snapshots' ? null : { _tag: 'snapshots' }
    )
  }, [setSelectedSidebar])

  const onToggleFiles = useCallback(() => {
    setSelectedSidebar((v) => (v?._tag === 'files' ? null : { _tag: 'files' }))
  }, [setSelectedSidebar])

  const onToggleSchemaExplorer = useCallback(
    (dataSourceId?: string | null) => {
      setSelectedSidebar((v) =>
        v?._tag === 'schemaExplorer' && v.dataSourceId === dataSourceId
          ? null
          : { _tag: 'schemaExplorer', dataSourceId: dataSourceId ?? null }
      )
    },
    [setSelectedSidebar]
  )

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
        userRole={props.role}
        isPublished={props.document.publishedAt !== null}
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
              title="Click to save"
              message="This dashboard has unsaved changes."
              active={props.document.publishedAt !== null && isDirty}
              position="bottom"
              tooltipClassname="w-40"
            >
              <button
                id="dashboard-publish-button"
                className="flex items-center rounded-sm px-3 py-1 text-sm bg-primary-200 hover:bg-primary-300 border border-transparent disabled:border-gray-200 disabled:bg-gray-100 disabled:cursor-not-allowed gap-x-1.5 group relative disabled:text-gray-500"
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
                <span>Save</span>
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
          onToggleSchemaExplorer={onToggleSchemaExplorer}
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
      user={props.user}
    >
      <div className="w-full flex relative subpixel-antialiased bg-dashboard-gray">
        <div className="w-full flex flex-col relative">
          {syncing ? (
            <DashboardSkeleton />
          ) : (
            <SQLExtensionProvider workspaceId={props.document.workspaceId}>
              <DashboardContent
                {...props}
                isEditing={props.isEditing}
                yDoc={yDoc}
                executionQueue={executionQueue}
                aiTasks={aiTasks}
                onToggleSchemaExplorer={onToggleSchemaExplorer}
              />
            </SQLExtensionProvider>
          )}
        </div>

        <div className="w-full fixed bottom-0 bg-white z-20">
          <EnvBar
            onOpenFiles={onToggleFiles}
            publishedAt={!props.isEditing ? props.document.publishedAt : null}
            lastUpdatedAt={lastUpdatedAt}
            isViewer={props.role === 'viewer'}
          />
        </div>

        {!props.isEditing && (
          <RunAllV2
            disabled={false}
            yDoc={yDoc}
            primary={true}
            userId={props.user.id}
            executionQueue={executionQueue}
          />
        )}
        <Comments
          workspaceId={props.document.workspaceId}
          documentId={props.document.id}
          visible={selectedSidebar?._tag === 'comments'}
          onHide={onHideSidebar}
        />
        {props.role !== 'viewer' && !isDeleted && (
          <>
            <Schedules
              workspaceId={props.document.workspaceId}
              documentId={props.document.id}
              isPublished={props.document.publishedAt !== null}
              visible={selectedSidebar?._tag === 'schedules'}
              onHide={onHideSidebar}
              onPublish={onPublish}
              publishing={props.publishing}
            />
            <Snapshots
              workspaceId={props.document.workspaceId}
              documentId={props.document.id}
              visible={selectedSidebar?._tag === 'snapshots'}
              onHide={onHideSidebar}
              isPublished={props.document.publishedAt !== null}
            />
            <Files
              workspaceId={props.document.workspaceId}
              visible={selectedSidebar?._tag === 'files'}
              onHide={onHideSidebar}
              userId={props.user.id}
              yDoc={yDoc}
              executionQueue={executionQueue}
            />
            <SchemaExplorer
              workspaceId={props.document.workspaceId}
              visible={selectedSidebar?._tag === 'schemaExplorer'}
              onHide={onHideSidebar}
              dataSourceId={
                selectedSidebar?._tag === 'schemaExplorer'
                  ? selectedSidebar.dataSourceId
                  : null
              }
              canRetrySchema={true}
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
function DashboardContent(
  props: Props & {
    yDoc: Y.Doc
    executionQueue: ExecutionQueue
    aiTasks: AITasks
    onToggleSchemaExplorer: (dataSourceId?: string | null) => void
  }
) {
  const [{ datasources: dataSources }] = useDataSources(
    props.document.workspaceId
  )
  const [draggingBlock, setDraggingBlock] = useState<DraggingBlock | null>(null)
  const [latestBlockId, setLatestBlockId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<YBlock | null>(null)
  const { state: blocks } = useYDocState(props.yDoc, getBlocks)
  const { state: layout } = useYDocState(props.yDoc, getLayout)
  const { state: dataframes } = useYDocState(props.yDoc, getDataframes)

  const onDragStart = useCallback((draggingBlock: DraggingBlock) => {
    setDraggingBlock(draggingBlock)
  }, [])

  const onAddBlock = useCallback(
    (blockId: string) => {
      setLatestBlockId(blockId)
    },
    [setLatestBlockId]
  )

  useEffect(() => {
    if (!expanded) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [expanded])

  const [isControlsOpen, setIsControlsOpen] = useState(false)
  const onOpenControls = useCallback(() => {
    setIsControlsOpen(true)
  }, [])
  const onCloseControls = useCallback(() => {
    setIsControlsOpen(false)
  }, [])

  return (
    <>
      <div className="flex h-[calc(100%-47px)]">
        <DashboardView
          className={clsx(
            'flex-grow h-full',
            props.isEditing && isControlsOpen && 'w-[calc(100%-400px)]'
          )}
          document={props.document}
          dataSources={dataSources}
          yDoc={props.yDoc}
          draggingBlock={draggingBlock}
          latestBlockId={latestBlockId}
          isEditing={props.isEditing}
          userRole={props.role}
          userId={props.user.id}
          executionQueue={props.executionQueue}
          aiTasks={props.aiTasks}
          onExpand={setExpanded}
        />
        {props.isEditing && (
          <DashboardControls
            document={props.document}
            dataSources={dataSources}
            yDoc={props.yDoc}
            onDragStart={onDragStart}
            onAddBlock={onAddBlock}
            userId={props.user.id}
            executionQueue={props.executionQueue}
            aiTasks={props.aiTasks}
            onToggleSchemaExplorer={props.onToggleSchemaExplorer}
            onExpand={setExpanded}
            isOpen={isControlsOpen}
            onOpen={onOpenControls}
            onClose={onCloseControls}
          />
        )}
      </div>
      {createPortal(
        <Transition
          className="fixed inset-0 z-20 flex items-center justify-center py-8"
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
          show={expanded !== null}
        >
          {expanded ? (
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setExpanded(null)} // Close when clicking on backdrop
            />
          ) : null}

          {expanded ? (
            <ScrollBar className="bg-white px-16 py-12 rounded-xl shadow-md max-h-[90vh] min-w-[940px] 2xl:w-[1280px] 3xl:w-[1536px]">
              {switchBlockType(expanded, {
                onVisualization: (block) => (
                  <VisualizationBlock
                    document={props.document}
                    dataframes={dataframes.value}
                    block={block}
                    blocks={blocks.value}
                    dragPreview={null}
                    isEditable={true}
                    onAddGroupedBlock={() => {}}
                    isDashboard={false}
                    isPublicMode={false}
                    hasMultipleTabs={false}
                    isBlockHiddenInPublished={false}
                    onToggleIsBlockHiddenInPublished={() => {}}
                    isCursorWithin={false}
                    isCursorInserting={false}
                    userId={props.user.id}
                    executionQueue={props.executionQueue}
                    isFullScreen={true}
                  />
                ),
                onVisualizationV2: (block) => (
                  <VisualizationV2Block
                    document={props.document}
                    dataframes={dataframes.value}
                    block={block}
                    blocks={blocks.value}
                    dragPreview={null}
                    isEditable={true}
                    onAddGroupedBlock={() => {}}
                    dashboardMode={{ _tag: 'editing', position: 'expanded' }}
                    isPublicMode={false}
                    hasMultipleTabs={false}
                    isBlockHiddenInPublished={false}
                    onToggleIsBlockHiddenInPublished={() => {}}
                    isCursorWithin={false}
                    isCursorInserting={false}
                    userId={props.user.id}
                    executionQueue={props.executionQueue}
                    isFullScreen={true}
                  />
                ),
                onRichText: (block) => (
                  <RichTextBlock
                    block={block}
                    belongsToMultiTabGroup={false}
                    isEditable={true}
                    dragPreview={null}
                    dashboardMode={{ _tag: 'editing', position: 'expanded' }}
                    isCursorWithin={false}
                    isCursorInserting={false}
                  />
                ),
                onSQL: (block) => (
                  <SQLBlock
                    block={block}
                    blocks={blocks.value}
                    layout={layout.value}
                    document={props.document}
                    dataSources={dataSources}
                    isEditable={true}
                    dragPreview={null}
                    dashboardMode={{ _tag: 'editing', position: 'expanded' }}
                    isPublicMode={false}
                    hasMultipleTabs={false}
                    isBlockHiddenInPublished={false}
                    onToggleIsBlockHiddenInPublished={() => {}}
                    onSchemaExplorer={props.onToggleSchemaExplorer}
                    insertBelow={() => {}}
                    userId={props.user.id}
                    executionQueue={props.executionQueue}
                    aiTasks={props.aiTasks}
                    isFullScreen={true}
                  />
                ),
                onPython: (block) => (
                  <PythonBlock
                    document={props.document}
                    block={block}
                    blocks={blocks.value}
                    isEditable={true}
                    dragPreview={null}
                    isPDF={false}
                    dashboardMode={{ _tag: 'editing', position: 'expanded' }}
                    isPublicMode={false}
                    hasMultipleTabs={false}
                    isBlockHiddenInPublished={false}
                    onToggleIsBlockHiddenInPublished={() => {}}
                    userId={props.user.id}
                    executionQueue={props.executionQueue}
                    aiTasks={props.aiTasks}
                    isFullScreen={true}
                  />
                ),
                onInput: (block) => (
                  <InputBlock
                    block={block}
                    blocks={blocks.value}
                    dragPreview={null}
                    belongsToMultiTabGroup={false}
                    isEditable={true}
                    isApp={false}
                    dashboardMode={{ _tag: 'editing', position: 'expanded' }}
                    isCursorWithin={false}
                    isCursorInserting={false}
                    userId={props.user.id}
                    workspaceId={props.document.workspaceId}
                    executionQueue={props.executionQueue}
                  />
                ),
                onDropdownInput: (block) => (
                  <DropdownInputBlock
                    block={block}
                    blocks={blocks.value}
                    dragPreview={null}
                    belongsToMultiTabGroup={false}
                    isEditable={true}
                    isApp={false}
                    dashboardMode={{ _tag: 'editing', position: 'expanded' }}
                    dataframes={dataframes.value}
                    isCursorWithin={false}
                    isCursorInserting={false}
                    userId={props.user.id}
                    workspaceId={props.document.workspaceId}
                    executionQueue={props.executionQueue}
                  />
                ),
                onDateInput: (block) => (
                  <DateInputBlock
                    block={block}
                    blocks={blocks.value}
                    workspaceId={props.document.workspaceId}
                    dragPreview={null}
                    belongsToMultiTabGroup={false}
                    isEditable={true}
                    isApp={false}
                    dashboardMode={{ _tag: 'editing', position: 'expanded' }}
                    isCursorWithin={false}
                    isCursorInserting={false}
                    userId={props.user.id}
                    executionQueue={props.executionQueue}
                  />
                ),

                // FileUpload do not appear in the sidebar
                onFileUpload: () => null,
                // DashboardHeader do not appear in the sidebar
                onDashboardHeader: () => null,
                // Writeback do not appear in the sidebar
                onWriteback: () => null,

                onPivotTable: (block) => (
                  <PivotTableBlock
                    workspaceId={props.document.workspaceId}
                    dataframes={dataframes.value}
                    block={block}
                    blocks={blocks.value}
                    dragPreview={null}
                    isEditable={true}
                    onAddGroupedBlock={() => {}}
                    dashboardMode={{ _tag: 'editing', position: 'expanded' }}
                    hasMultipleTabs={false}
                    isBlockHiddenInPublished={false}
                    onToggleIsBlockHiddenInPublished={() => {}}
                    isCursorWithin={false}
                    isCursorInserting={false}
                    userId={props.user.id}
                    executionQueue={props.executionQueue}
                    isFullScreen={true}
                  />
                ),
              })}
            </ScrollBar>
          ) : null}
        </Transition>,
        document.body
      )}
    </>
  )
}
