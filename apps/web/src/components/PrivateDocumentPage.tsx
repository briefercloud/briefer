import dynamic from 'next/dynamic'

import { useDataSources } from '@/hooks/useDatasources'
import useDocument from '@/hooks/useDocument'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import type { ApiDocument, ApiUser, UserWorkspaceRole } from '@briefer/database'
import { isNil } from 'ramda'
import ShareDropdown from './ShareDropdown'
import { useDocuments } from '@/hooks/useDocuments'
import Layout from './Layout'
import Comments from './Comments'
import RunAllV2 from './RunAllV2'
import useFullScreenDocument from '@/hooks/useFullScreenDocument'
import Schedules from './Schedules'
import Snapshots from './Snapshots'
import { useYDoc } from '@/hooks/useYDoc'
import DashboardNotebookGroupButton from './DashboarNotebookGroupButton'
import EllipsisDropdown from './EllipsisDropdown'
import Link from 'next/link'
import { EyeIcon, PencilIcon } from '@heroicons/react/24/outline'
import { BookUpIcon } from 'lucide-react'
import LiveButton from './LiveButton'
import clsx from 'clsx'
import { widthClasses } from './v2Editor/constants'
import { ContentSkeleton, TitleSkeleton } from './v2Editor/ContentSkeleton'
import Files from './Files'
import { PublishBlinkingSignal } from './BlinkingSignal'
import { Tooltip } from './Tooltips'
import SchemaExplorer from './schemaExplorer'
import { EditorAwarenessProvider } from '@/hooks/useEditorAwareness'
import ShortcutsModal from './ShortcutsModal'
import { NEXT_PUBLIC_PUBLIC_URL } from '@/utils/env'

// this is needed because this component only works with the browser
const V2Editor = dynamic(() => import('@/components/v2Editor'), {
  ssr: false,
})

interface Props {
  workspaceId: string
  documentId: string
  user: ApiUser & { roles: Record<string, UserWorkspaceRole> }
  isApp: boolean
}
export default function PrivateDocumentPage(props: Props) {
  const [{ document, publishing }, { publish }] = useDocument(
    props.workspaceId,
    props.documentId
  )

  if (!document) {
    return (
      <Layout>
        <div className="w-full flex justify-center">
          <div className={clsx(widthClasses, 'py-20')}>
            <TitleSkeleton visible />
            <ContentSkeleton visible />
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <PrivateDocumentPageInner
      {...props}
      document={document}
      publish={publish}
      publishing={publishing}
    />
  )
}

function PrivateDocumentPageInner(
  props: Props & {
    document: ApiDocument
    publish: () => Promise<void>
    publishing: boolean
  }
) {
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
    | null
  >(null)

  const [dataSources] = useDataSources(props.workspaceId)

  const onHideSidebar = useCallback(() => {
    setSelectedSidebar(null)
  }, [setSelectedSidebar])

  const onToggleComments = useCallback(() => {
    setSelectedSidebar((v) =>
      v?._tag === 'comments' ? null : { _tag: 'comments' }
    )
  }, [setSelectedSidebar])

  const onToggleShortcuts = useCallback(() => {
    setSelectedSidebar((v) =>
      v?._tag === 'shortcuts' ? null : { _tag: 'shortcuts' }
    )
  }, [setSelectedSidebar])

  const onToggleSchemaExplorerEllipsis = useCallback(() => {
    setSelectedSidebar((v) =>
      v?._tag === 'schemaExplorer'
        ? null
        : { _tag: 'schemaExplorer', dataSourceId: null }
    )
  }, [setSelectedSidebar])

  const onToggleSchemaExplorerSQLBlock = useCallback(
    (dataSourceId?: string | null) => {
      setSelectedSidebar((v) =>
        v?._tag === 'schemaExplorer' && v.dataSourceId === dataSourceId
          ? null
          : { _tag: 'schemaExplorer', dataSourceId: dataSourceId ?? null }
      )
    },
    [setSelectedSidebar]
  )

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

  const router = useRouter()
  const copyLink = useMemo(
    () =>
      `${NEXT_PUBLIC_PUBLIC_URL()}/workspaces/${props.workspaceId}/documents/${
        props.documentId
      }`,
    [router]
  )

  const isViewer = props.user.roles[props.workspaceId] === 'viewer'
  const isDeleted = !isNil(props.document.deletedAt)

  const [isFullScreen, { toggle: onToggleFullScreen }] = useFullScreenDocument(
    props.document.id
  )

  const [, { restoreDocument }] = useDocuments(props.workspaceId)
  const onRestoreDocument = useCallback(() => {
    restoreDocument(props.documentId)
  }, [props.documentId, restoreDocument])

  const clock = useMemo(() => {
    if (!props.isApp) {
      return props.document.clock
    }

    return props.document.userAppClock[props.user.id] ?? props.document.appClock
  }, [
    props.isApp,
    props.document.clock,
    props.document.userAppClock,
    props.document.appClock,
    props.user.id,
  ])

  const { yDoc, provider, syncing, isDirty } = useYDoc(
    props.document.id,
    props.isApp,
    clock,
    props.user.id,
    props.document.publishedAt,
    true,
    null
  )

  const onPublish = useCallback(async () => {
    if (props.publishing) {
      return
    }

    await props.publish()
    router.push(
      `/workspaces/${props.document.workspaceId}/documents/${props.document.id}/notebook`
    )
  }, [props.publishing, props.publish])

  const onGoToApp = useCallback(() => {
    router.push(
      `/workspaces/${props.document.workspaceId}/documents/${props.document.id}/notebook`
    )
  }, [router])

  const topBarContent = (
    <div className="flex items-center w-full justify-between gap-x-6">
      <div className="w-full overflow-hidden flex items-center gap-x-1.5 text-sm text-gray-400 font-sans">
        {props.isApp ? (
          <EyeIcon className="w-4 h-4" />
        ) : (
          <PencilIcon className="w-4 h-4" />
        )}
        <span className="w-full truncate">
          <span className="font-semibold">
            {props.isApp ? (
              <span className="text-ceramic-500">Viewing</span>
            ) : (
              'Editing'
            )}
          </span>{' '}
          {documentTitle}
        </span>
      </div>
      <DashboardNotebookGroupButton
        workspaceId={props.workspaceId}
        documentId={props.documentId}
        current="notebook"
        isEditing={!props.isApp}
      />

      <div className="w-full justify-end flex items-center gap-x-2 h-[30px]">
        {!props.isApp && (
          <LiveButton
            onClick={onGoToApp}
            disabled={props.document.publishedAt === null}
            tooltipActive={props.document.publishedAt === null}
          />
        )}

        <ShareDropdown
          link={copyLink}
          isPublic={false}
          onTogglePublic={() => {}}
          workspaceId={props.workspaceId}
          documentId={props.documentId}
          documentTitle={documentTitle}
          role={props.user.roles[props.workspaceId]}
          isDashboard={false}
          isApp={props.isApp}
        />
        {props.isApp ? (
          <Link
            className="flex gap-x-2 items-center rounded-sm px-3 py-1 text-sm text-gray-500 bg-white hover:bg-gray-100 border border-gray-200 disabled:cursor-not-allowed disabled:opacity-50 gap-x-1.5 justify-center"
            href={`/workspaces/${props.document.workspaceId}/documents/${props.document.id}/notebook/edit`}
          >
            <PencilIcon className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        ) : (
          <>
            <Tooltip
              title="Click to publish"
              message="This notebook has unpublished changes."
              active={props.document.publishedAt !== null && isDirty}
              position="bottom"
              tooltipClassname="w-40"
            >
              <button
                className="flex items-center rounded-sm px-3 py-1 text-sm bg-primary-200 hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-50 gap-x-1.5 group relative"
                onClick={onPublish}
                disabled={props.publishing}
              >
                <BookUpIcon
                  className="w-4 h-4 rotate-12 group-hover:rotate-0 transition transition-transform duration-400"
                  strokeWidth={1}
                />
                <span>Publish</span>
                {isDirty && props.document.publishedAt && (
                  <PublishBlinkingSignal />
                )}
              </button>
            </Tooltip>
          </>
        )}

        <EllipsisDropdown
          onToggleSchedules={onToggleSchedules}
          onToggleSnapshots={onToggleSnapshots}
          onToggleComments={onToggleComments}
          onToggleFullScreen={onToggleFullScreen}
          onToggleFiles={onToggleFiles}
          onToggleSchemaExplorer={onToggleSchemaExplorerEllipsis}
          onToggleShortcuts={onToggleShortcuts}
          isViewer={isViewer}
          isDeleted={isDeleted}
          isFullScreen={isFullScreen}
        />
      </div>
    </div>
  )

  return (
    <Layout
      topBarClassname={props.isApp ? 'bg-gray-50' : undefined}
      topBarContent={topBarContent}
    >
      <div className="w-full relative flex">
        <EditorAwarenessProvider awareness={provider.awareness}>
          <V2Editor
            document={props.document}
            dataSources={dataSources}
            isPublicViewer={false}
            isDeleted={isDeleted}
            onRestoreDocument={onRestoreDocument}
            isEditable={!props.isApp}
            isPDF={false}
            isApp={props.isApp}
            userId={props.user.id}
            role={props.user.roles[props.workspaceId]}
            isFullScreen={isFullScreen}
            yDoc={yDoc}
            provider={provider}
            isSyncing={syncing}
            onOpenFiles={onToggleFiles}
            onSchemaExplorer={onToggleSchemaExplorerSQLBlock}
          />
        </EditorAwarenessProvider>
        {!isViewer && (
          <RunAllV2 disabled={false} yDoc={yDoc} primary={props.isApp} />
        )}

        <Comments
          workspaceId={props.workspaceId}
          documentId={props.documentId}
          visible={selectedSidebar?._tag === 'comments'}
          onHide={onHideSidebar}
        />

        <SchemaExplorer
          workspaceId={props.workspaceId}
          visible={selectedSidebar?._tag === 'schemaExplorer'}
          onHide={onHideSidebar}
          dataSourceId={
            selectedSidebar?._tag === 'schemaExplorer'
              ? selectedSidebar.dataSourceId
              : null
          }
        />

        <ShortcutsModal
          visible={selectedSidebar?._tag === 'shortcuts'}
          onHide={onHideSidebar}
        />

        {!isViewer && !isDeleted && (
          <>
            <Schedules
              workspaceId={props.workspaceId}
              documentId={props.documentId}
              isPublished={props.document.publishedAt !== null}
              visible={selectedSidebar?._tag === 'schedules'}
              onHide={onHideSidebar}
              onPublish={onPublish}
              publishing={props.publishing}
            />
            <Snapshots
              workspaceId={props.workspaceId}
              documentId={props.documentId}
              visible={selectedSidebar?._tag === 'snapshots'}
              onHide={onHideSidebar}
              isPublished={props.document.publishedAt !== null}
            />
            <Files
              workspaceId={props.workspaceId}
              visible={selectedSidebar?._tag === 'files'}
              onHide={onHideSidebar}
              yDoc={yDoc}
            />
          </>
        )}
      </div>
    </Layout>
  )
}
