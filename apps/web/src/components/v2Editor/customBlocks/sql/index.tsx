import {
  PlayIcon,
  StopIcon,
  ClockIcon,
  SparklesIcon,
  BookOpenIcon,
  VariableIcon,
} from '@heroicons/react/20/solid'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as Y from 'yjs'
import {
  type SQLBlock,
  setTitle,
  toggleSQLEditWithAIPromptOpen,
  isSQLBlockEditWithAIPromptOpen,
  closeSQLEditWithAIPrompt,
  updateYText,
  YBlockGroup,
  YBlock,
  BlockType,
  addGroupedBlock,
  getSQLAttributes,
  createComponentState,
  ExecutionQueue,
  AITasks,
  isExecutionStatusLoading,
  AddBlockGroupBlock,
  getSQLCodeFormatted,
} from '@briefer/editor'
import SQLResult from './SQLResult'
import type {
  ApiDocument,
  ApiWorkspace,
  DataSourceType,
} from '@briefer/database'
import DataframeNameInput from './DataframeNameInput'
import HeaderSelect from '@/components/v2Editor/customBlocks/sql/HeaderSelect'
import clsx from 'clsx'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import {
  LoadingEnvText,
  LoadingQueryText,
  QuerySucceededText,
} from '@/components/ExecutionStatusText'
import { ConnectDragPreview } from 'react-dnd'
import EditWithAIForm from '../../EditWithAIForm'
import ApproveDiffButons from '../../ApproveDiffButtons'
import LargeSpinner from '@/components/LargeSpinner'
import { APIDataSources } from '@/hooks/useDatasources'
import { useRouter } from 'next/router'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import FormatSQLButton from '../../FormatSQLButton'
import useEditorAwareness from '@/hooks/useEditorAwareness'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import useProperties from '@/hooks/useProperties'
import { SaveReusableComponentButton } from '@/components/ReusableComponents'
import { useReusableComponents } from '@/hooks/useReusableComponents'
import CodeEditor, { CodeEditorRef } from '../../CodeEditor'
import SQLQueryConfigurationButton from './SQLQueryConfigurationButton'
import {
  exhaustiveCheck,
  SQLQueryConfiguration,
  TableSort,
} from '@briefer/types'
import { useBlockExecutions } from '@/hooks/useBlockExecution'
import { head } from 'ramda'
import { useAITasks } from '@/hooks/useAITasks'
import useFeatureFlags from '@/hooks/useFeatureFlags'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleStackIcon,
} from '@heroicons/react/24/solid'
import { TooltipV2 } from '@/components/Tooltips'
import { DashboardMode, dashboardModeHasControls } from '@/components/Dashboard'
import { Transition } from '@headlessui/react'

interface Props {
  block: Y.XmlElement<SQLBlock>
  layout: Y.Array<YBlockGroup>
  blocks: Y.Map<YBlock>
  dataSources: APIDataSources
  document: ApiDocument
  isEditable: boolean
  isPublicMode: boolean
  dragPreview: ConnectDragPreview | null
  dashboardMode: DashboardMode | null
  hasMultipleTabs: boolean
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: (blockId: string) => void
  onSchemaExplorer: (dataSourceId: string | null) => void
  insertBelow: () => void
  executionQueue: ExecutionQueue
  userId: string | null
  aiTasks: AITasks
  isFullScreen: boolean
}
function SQLBlock(props: Props) {
  const properties = useProperties()
  const [workspaces] = useWorkspaces()
  const currentWorkspace: ApiWorkspace | undefined = useMemo(
    () => workspaces.data.find((w) => w.id === props.document.workspaceId),
    [workspaces.data, props.document.workspaceId]
  )

  const hasOaiKey = useMemo(() => {
    return (
      !properties.data?.disableCustomOpenAiKey &&
      (currentWorkspace?.secrets.hasOpenAiApiKey ?? false)
    )
  }, [currentWorkspace, properties.data])

  const [localResultHidden, setLocalResultHidden] = useState<boolean | null>(
    null
  )

  const toggleResultHidden = useCallback(() => {
    if (props.isEditable) {
      props.block.doc?.transact(() => {
        const currentIsResultHidden = props.block.getAttribute('isResultHidden')
        props.block.setAttribute('isResultHidden', !currentIsResultHidden)
      })
    } else {
      setLocalResultHidden((prev) => {
        const blockResultHidden = props.block.getAttribute('isResultHidden')
        return prev === null ? !blockResultHidden : !prev
      })
    }
  }, [props.block, props.isEditable])

  const [localCodeHidden, setLocalCodeHidden] = useState<boolean | null>(null)

  const toggleCodeHidden = useCallback(() => {
    if (props.isEditable) {
      props.block.doc?.transact(() => {
        const currentIsCodeHidden = props.block.getAttribute('isCodeHidden')
        props.block.setAttribute('isCodeHidden', !currentIsCodeHidden)
      })
    } else {
      setLocalCodeHidden((prev) => {
        const blockCodeHidden = props.block.getAttribute('isCodeHidden')
        return prev === null ? !blockCodeHidden : !prev
      })
    }
  }, [props.block, props.isEditable])

  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const onSQLSelectionChanged = useCallback((selectedCode: string | null) => {
    setSelectedCode(selectedCode)
  }, [])

  const {
    dataframeName,
    id: blockId,
    title,
    result,
    page,
    dashboardPage,
    isCodeHidden: isCodeHiddenProp,
    isResultHidden: isResultHiddenProp,
    editWithAIPrompt,
    aiSuggestions,
    dataSourceId,
    isFileDataSource,
    componentId,
    sort,
    dashboardPageSize,
  } = getSQLAttributes(props.block, props.blocks)

  const isCodeHidden =
    (!props.dashboardMode || !dashboardModeHasControls(props.dashboardMode)) &&
    (props.isEditable
      ? isCodeHiddenProp
      : localCodeHidden === null
        ? isCodeHiddenProp
        : localCodeHidden)

  const isResultHidden =
    (!props.dashboardMode || !dashboardModeHasControls(props.dashboardMode)) &&
    (props.isEditable
      ? isResultHiddenProp
      : localResultHidden === null
        ? isResultHiddenProp
        : localResultHidden)

  const { startedAt: environmentStartedAt } = useEnvironmentStatus(
    props.document.workspaceId
  )

  const onRun = useCallback(() => {
    props.executionQueue.enqueueBlock(
      blockId,
      props.userId,
      environmentStartedAt,
      {
        _tag: 'sql',
        isSuggestion: false,
        selectedCode,
      }
    )
  }, [
    props.executionQueue,
    blockId,
    props.userId,
    environmentStartedAt,
    selectedCode,
  ])

  const onTry = useCallback(() => {
    props.executionQueue.enqueueBlock(
      blockId,
      props.userId,
      environmentStartedAt,
      {
        _tag: 'sql',
        isSuggestion: true,
        selectedCode,
      }
    )
  }, [
    props.executionQueue,
    blockId,
    props.userId,
    environmentStartedAt,
    selectedCode,
  ])

  const executions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'sql'
  )
  const execution = head(executions) ?? null
  const status = execution?.item.getStatus() ?? { _tag: 'idle' }

  const pageExecutions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'sql-load-page'
  )
  const pageExecution = head(pageExecutions)
  const pageStatus = pageExecution?.item.getStatus()._tag ?? 'idle'

  const loadingPage = isExecutionStatusLoading(pageStatus)

  const statusIsDisabled: boolean = (() => {
    switch (status._tag) {
      case 'idle':
      case 'completed':
      case 'unknown':
        return false
      case 'running':
      case 'enqueued':
      case 'aborting':
        return true
    }
  })()

  const onToggleEditWithAIPromptOpen = useCallback(() => {
    if (!hasOaiKey) {
      return
    }

    toggleSQLEditWithAIPromptOpen(props.block)
  }, [props.block, hasOaiKey])

  const dataSource = useMemo(
    () => props.dataSources.find((d) => d.config.data.id === dataSourceId),
    [props.dataSources, dataSourceId]
  )

  const [
    { data: components },
    { create: createReusableComponent, update: updateReusableComponent },
  ] = useReusableComponents(props.document.workspaceId)
  const component = useMemo(
    () => components.find((c) => c.id === componentId),
    [components, componentId]
  )

  const editAITasks = useAITasks(props.aiTasks, props.block, 'edit-sql')
  const fixAITasks = useAITasks(props.aiTasks, props.block, 'fix-sql')
  const aiTask = useMemo(
    () => head(editAITasks.concat(fixAITasks)) ?? null,
    [editAITasks, fixAITasks]
  )

  const isAIEditing =
    aiTask?.getMetadata()._tag === 'edit-sql'
      ? isExecutionStatusLoading(aiTask.getStatus()._tag)
      : false
  const isAIFixing =
    aiTask?.getMetadata()._tag === 'fix-sql'
      ? isExecutionStatusLoading(aiTask.getStatus()._tag)
      : false

  const [editorState, editorAPI] = useEditorAwareness()

  const onCloseEditWithAIPrompt = useCallback(() => {
    if (aiTask?.getMetadata()._tag === 'edit-sql') {
      aiTask.setAborting()
    }

    closeSQLEditWithAIPrompt(props.block, false)
    editorAPI.insert(blockId, { scrollIntoView: false })
  }, [props.block, editorAPI.insert, blockId, aiTask])

  const onChangeDataSource = useCallback(
    (df: { value: string; type: DataSourceType | 'duckdb' }) => {
      if (df.type === 'duckdb') {
        props.block.setAttribute('dataSourceId', null)
        props.block.setAttribute('isFileDataSource', true)
      } else {
        props.block.setAttribute('dataSourceId', df.value)
        props.block.setAttribute('isFileDataSource', false)
      }
    },
    [props.block]
  )

  const { status: envStatus, loading: envLoading } = useEnvironmentStatus(
    props.document.workspaceId
  )

  const onChangeTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(props.block, e.target.value)
    },
    [props.block]
  )

  const onRunAbort = useCallback(() => {
    switch (status._tag) {
      case 'enqueued':
        execution?.batch.removeItem(blockId)
        break
      case 'running':
        execution?.item.setAborting()
        break
      case 'idle':
      case 'completed':
      case 'unknown':
        onRun()
        break
      case 'aborting':
        break
      default:
        exhaustiveCheck(status)
    }
  }, [status, execution, onRun, blockId])

  const { source, configuration } = getSQLAttributes(props.block, props.blocks)
  const lastQuery = props.block.getAttribute('lastQuery')
  const startQueryTime = props.block.getAttribute('startQueryTime')
  const lastQueryTime = props.block.getAttribute('lastQueryTime')
  const queryStatusText = useMemo(() => {
    switch (status._tag) {
      case 'idle':
      case 'completed': {
        if (source?.toJSON() === lastQuery && lastQueryTime) {
          return (
            <QuerySucceededText
              lastExecutionTime={lastQueryTime}
              isResultHidden={isResultHidden}
              onToggleResultHidden={toggleResultHidden}
            />
          )
        }

        return null
      }
      case 'running':
      case 'enqueued':
      case 'aborting':
        if (envStatus === 'Starting') {
          return <LoadingEnvText />
        }
        return <LoadingQueryText startExecutionTime={startQueryTime ?? null} />
      case 'unknown':
        return null
    }
  }, [
    status,
    startQueryTime,
    lastQuery,
    lastQueryTime,
    source.toJSON(),
    envStatus,
  ])

  const onSubmitEditWithAI = useCallback(() => {
    props.aiTasks.enqueue(blockId, props.userId, { _tag: 'edit-sql' })
  }, [props.aiTasks, blockId, props.userId])

  const onAcceptAISuggestion = useCallback(() => {
    if (aiSuggestions) {
      updateYText(source, aiSuggestions.toString())
    }

    props.block.setAttribute('aiSuggestions', null)
  }, [props.block, aiSuggestions, source])

  const onRejectAISuggestion = useCallback(() => {
    props.block.setAttribute('aiSuggestions', null)
  }, [props.block])

  const onFixWithAI = useCallback(() => {
    if (!hasOaiKey) {
      return
    }

    if (aiTask?.getMetadata()._tag === 'fix-sql') {
      aiTask.setAborting()
    } else {
      props.aiTasks.enqueue(blockId, props.userId, { _tag: 'fix-sql' })
    }
  }, [props.aiTasks, blockId, props.userId, hasOaiKey, aiTask])

  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => {
        setCopied(false)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [copied, setCopied])

  const diffButtonsVisible =
    !props.isPublicMode && aiSuggestions !== null && status._tag === 'idle'

  const router = useRouter()
  const onAddDataSource = useCallback(() => {
    router.push(`/workspaces/${props.document.workspaceId}/data-sources`)
  }, [router, props.document.workspaceId])

  const onToggleFormatSQLCode = useCallback(() => {
    const sqlCodeFormatted = getSQLCodeFormatted(
      source,
      dataSource?.config.type ?? null
    )

    if (!sqlCodeFormatted) {
      return
    }

    // Reuse the `EditWithAIForm` component to show the formatted SQL code
    props.block.setAttribute('aiSuggestions', sqlCodeFormatted)
  }, [source, props.block])

  const onToggleIsBlockHiddenInPublished = useCallback(() => {
    props.onToggleIsBlockHiddenInPublished(blockId)
  }, [props.onToggleIsBlockHiddenInPublished, blockId])

  const onSchemaExplorer = useCallback(() => {
    props.onSchemaExplorer(dataSourceId)
  }, [props.onSchemaExplorer, dataSourceId])

  const onClickWithin = useCallback(() => {
    editorAPI.focus(blockId, { scrollIntoView: false })
  }, [blockId, editorAPI.focus])

  const dataSourcesOptions = useMemo(
    () =>
      props.dataSources
        .map((d) => ({
          value: d.config.data.id,
          label: d.config.data.name,
          type: d.config.type,
          isDemo: d.config.data.isDemo,
        }))
        .toArray(),
    [props.dataSources]
  )

  const isComponentInstance =
    component !== undefined && component.blockId !== blockId

  const onSaveReusableComponent = useCallback(() => {
    const component = components.find((c) => c.id === componentId)
    if (!component) {
      const { id: componentId, state } = createComponentState(
        props.block,
        props.blocks
      )
      createReusableComponent(
        props.document.workspaceId,
        {
          id: componentId,
          blockId,
          documentId: props.document.id,
          state,
          title,
          type: 'sql',
        },
        props.document.title,
        props.document.icon
      )
    } else if (!isComponentInstance) {
      // can only update component if it is not an instance
      updateReusableComponent(props.document.workspaceId, component.id, {
        state: createComponentState(props.block, props.blocks).state,
        title,
      })
    }
  }, [
    createReusableComponent,
    props.document.workspaceId,
    blockId,
    props.document.id,
    title,
    props.block,
    components,
    isComponentInstance,
    props.document.title,
  ])

  const onChangeConfiguration = useCallback(
    (value: SQLQueryConfiguration) => {
      props.block.setAttribute('configuration', value)
    },
    [props.block]
  )

  const onChangeSort = useCallback(
    (sort: TableSort | null) => {
      const run = () => {
        props.block.setAttribute('sort', sort)
        props.executionQueue.enqueueBlock(
          props.block,
          props.userId,
          environmentStartedAt,
          {
            _tag: 'sql-load-page',
          }
        )
      }

      if (props.block.doc) {
        props.block.doc.transact(run)
      } else {
        run()
      }
    },
    [props.block]
  )

  const onChangePage = useCallback(
    (page: number) => {
      const run = () => {
        if (
          props.dashboardMode &&
          !dashboardModeHasControls(props.dashboardMode)
        ) {
          props.block.setAttribute('dashboardPage', page)
        } else {
          props.block.setAttribute('page', page)
        }
        props.executionQueue.enqueueBlock(
          props.block,
          props.userId,
          environmentStartedAt,
          {
            _tag: 'sql-load-page',
          }
        )
      }

      if (props.block.doc) {
        props.block.doc.transact(run)
      } else {
        run()
      }
    },
    [props.block, props.dashboardMode, props.userId, environmentStartedAt]
  )

  const flags = useFeatureFlags(props.document.workspaceId)
  const isVisualizationButtonDisabled =
    props.block.getAttribute('result')?.type !== 'success' || !props.isEditable
  const onAddVisualization = useCallback(() => {
    const blockId = props.block.getAttribute('id')

    const blockGroup = props.layout.toArray().find((blockGroup) => {
      return blockGroup
        .getAttribute('tabs')
        ?.toArray()
        .some((tab) => {
          return tab.getAttribute('id') === blockId
        })
    })
    const blockGroupId = blockGroup?.getAttribute('id')

    if (!blockId || !blockGroupId) {
      return
    }

    const block: AddBlockGroupBlock = {
      type: flags.visualizationsV2
        ? BlockType.VisualizationV2
        : BlockType.Visualization,
      dataframeName: props.block.getAttribute('dataframeName')?.value ?? null,
    }

    addGroupedBlock(
      props.layout,
      props.blocks,
      blockGroupId,
      blockId,
      block,
      'after'
    )
  }, [props.layout, props.blocks, props.block, flags])

  const headerSelectValue = isFileDataSource ? 'duckdb' : dataSourceId

  const isEditorFocused = editorState.cursorBlockId === blockId
  const isRunButtonDisabled =
    status._tag === 'aborting' ||
    execution?.batch.isRunAll() ||
    headerSelectValue === null

  const runTooltipContent = useMemo(() => {
    if (status._tag !== 'idle') {
      switch (status._tag) {
        case 'enqueued':
          return {
            title: 'This block is enqueud',
            message: isRunButtonDisabled
              ? 'When running entire documents, you cannot remove individual blocks from the queue.'
              : 'It will run once the previous blocks finish executing. Click to remove it from the queue.',
          }
        case 'running': {
          if (envStatus !== 'Running' && !envLoading) {
            return {
              title: 'Your environment is starting',
              message:
                'Please hang tight. We need to save your query as a dataframe so you can use it in Python blocks.',
            }
          }

          if (execution?.batch.isRunAll() ?? false) {
            return {
              title: 'This block is running.',
              message:
                'When running entire documents, you cannot stop individual blocks.',
            }
          }
        }
        case 'unknown':
        case 'aborting':
        case 'completed':
          return null
      }
    } else if (props.dataSources.size > 0 || headerSelectValue === 'duckdb') {
      return {
        content: (ref: RefObject<HTMLDivElement>) => (
          <div
            className="font-sans pointer-events-none absolute w-max bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1"
            ref={ref}
          >
            <span>Run query</span>
            <span className="inline-flex gap-x-1 items-center text-gray-400">
              <span>⌘</span>
              <span>+</span>
              <span>Enter</span>
            </span>
          </div>
        ),
      }
    } else {
      return {
        title: 'No data sources',
        message: 'Please add a data source to run this query.',
      }
    }
  }, [
    status,
    envStatus,
    envLoading,
    execution,
    props.dataSources.size,
    headerSelectValue,
    isRunButtonDisabled,
  ])

  const codeEditor = useRef<CodeEditorRef>(null)

  const onAddVariable = useCallback(() => {
    const snippet = `{{ your_var_name }}`
    codeEditor.current?.insert(
      snippet,
      { from: 3, to: snippet.length - 3 },
      (p) => (p === 0 ? 'end' : p)
    )
  }, [codeEditor])

  const onChangeDashboardPageSize = useCallback(
    (pageSize: number) => {
      const run = () => {
        props.block.setAttribute('dashboardPageSize', pageSize)
        props.executionQueue.enqueueBlock(
          props.block,
          props.userId,
          environmentStartedAt,
          {
            _tag: 'sql-load-page',
          }
        )
      }

      if (props.block.doc) {
        props.block.doc.transact(run)
      } else {
        run()
      }
    },
    [props.block, props.userId, environmentStartedAt]
  )

  if (props.dashboardMode && !dashboardModeHasControls(props.dashboardMode)) {
    if (!result) {
      return (
        <div className="flex items-center justify-center h-full">
          {status._tag !== 'idle' ? (
            <LargeSpinner color="#b8f229" />
          ) : (
            <div className="text-gray-500">No query results</div>
          )}
        </div>
      )
    }

    return (
      <SQLResult
        page={page}
        dashboardPage={dashboardPage}
        result={result}
        isPublic={props.isPublicMode}
        documentId={props.document.id}
        workspaceId={props.document.workspaceId}
        blockId={blockId}
        dataframeName={dataframeName?.value ?? ''}
        isResultHidden={isResultHidden ?? false}
        toggleResultHidden={toggleResultHidden}
        isFixingWithAI={isAIFixing}
        onFixWithAI={onFixWithAI}
        dashboardMode={props.dashboardMode}
        canFixWithAI={hasOaiKey}
        sort={sort}
        isAddVisualizationDisabled={isVisualizationButtonDisabled}
        onAddVisualization={onAddVisualization}
        onChangeSort={onChangeSort}
        onChangePage={onChangePage}
        onChangeDashboardPageSize={onChangeDashboardPageSize}
        loadingPage={loadingPage}
        hasTitle={title.trim() !== ''}
        dashboardPageSize={dashboardPageSize}
      />
    )
  }

  return (
    <div
      className="relative group/block"
      onClick={onClickWithin}
      data-block-id={blockId}
    >
      <div
        className={clsx(
          'rounded-md border',
          props.isBlockHiddenInPublished && 'border-dashed',
          props.hasMultipleTabs ? 'rounded-tl-none' : 'rounded-tl-md',
          {
            'border-ceramic-400 shadow-sm':
              isEditorFocused && editorState.mode === 'insert',
            'border-blue-400 shadow-sm':
              isEditorFocused && editorState.mode === 'normal',
            'border-gray-200': !isEditorFocused,
          }
        )}
      >
        <div
          className={clsx(
            'rounded-t-md',
            statusIsDisabled ? 'bg-gray-100' : 'bg-white',
            props.hasMultipleTabs ? 'rounded-tl-none' : '',
            !(isResultHidden || !result) &&
              !isCodeHidden &&
              'border-b border-gray-200',
            (isResultHidden || !result) && !isCodeHidden && 'rounded-b-md',
            (isResultHidden || !result) && isCodeHidden && 'rounded-b-md'
          )}
        >
          <div
            className={clsx(
              'bg-gray-50 rounded-t-md',
              props.hasMultipleTabs ? 'rounded-tl-none' : '',
              isCodeHidden && (isResultHidden || !result) ? 'rounded-b-md' : ''
            )}
            ref={(d) => {
              props.dragPreview?.(d)
            }}
          >
            <div
              className={clsx(
                'flex items-center justify-between px-3 pr-0 gap-x-4 font-sans h-12 rounded-t-md',
                !isCodeHidden && 'divide-x divide-gray-200',
                props.hasMultipleTabs ? 'rounded-tl-none' : '',
                isCodeHidden && (isResultHidden || !result)
                  ? 'rounded-b-md'
                  : 'border-b border-gray-200'
              )}
            >
              <div className="select-none text-gray-300 text-xs flex items-center w-full h-full gap-x-1.5">
                <div className="relative group w-4 h-4">
                  <CircleStackIcon className="absolute inset-0 h-4 w-4 text-gray-400 group-hover:opacity-0 transition-opacity" />
                  <button
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={toggleCodeHidden}
                  >
                    {isCodeHidden ? (
                      <ChevronRightIcon className="h-4 w-4" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  className={clsx(
                    'text-sm font-sans font-medium pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-800 hover:ring-1 focus:ring-1 ring-inset focus:ring-inset placeholder:text-gray-400 focus:ring-inset py-0 disabled:ring-0 h-2/3 bg-transparent focus:bg-white'
                  )}
                  placeholder={
                    props.isEditable ? 'SQL (click to add a title)' : 'SQL'
                  }
                  value={title}
                  onChange={onChangeTitle}
                  disabled={!props.isEditable}
                />
              </div>
              <Transition
                className="print:hidden flex items-center gap-x-0 group-focus/block:opacity-100 h-full divide-x divide-gray-200"
                show={!isCodeHidden}
                enter="transition-opacity ease-in duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <DataframeNameInput
                  disabled={!props.isEditable || statusIsDisabled}
                  block={props.block}
                  environmentStartedAt={environmentStartedAt}
                  userId={props.userId}
                  executionQueue={props.executionQueue}
                />
                <HeaderSelect
                  hidden={props.isPublicMode}
                  value={headerSelectValue ?? ''}
                  options={dataSourcesOptions}
                  onChange={onChangeDataSource}
                  disabled={!props.isEditable || statusIsDisabled}
                  onAdd={
                    props.dataSources.size === 0 ? onAddDataSource : undefined
                  }
                  onAddLabel={
                    props.dataSources.size === 0 ? 'New data source' : undefined
                  }
                />
              </Transition>
              <Transition
                className="print:hidden flex items-center gap-x-1 text-[10px] text-gray-400 whitespace-nowrap pr-3"
                show={!(!isCodeHidden && dataframeName?.value)}
                enter="transition-opacity ease-in duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <CopyToClipboard
                  text={dataframeName?.value ?? ''}
                  onCopy={() => setCopied(true)}
                >
                  <code className="bg-primary-500/20 text-primary-700 px-1.5 py-0.5 font-mono rounded-md relative group cursor-pointer">
                    {copied ? 'Copied!' : dataframeName?.value}

                    <div className="font-sans pointer-events-none absolute -top-2 right-0 -translate-y-full opacity-0 transition-opacity scale-0 group-hover:scale-100 group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 w-56 whitespace-normal z-20">
                      <span className="text-gray-400 text-center">
                        Use this variable name to reference the results as a
                        Pandas dataframe in further Python blocks.{' '}
                        <span className="underline">Click to copy</span>.
                      </span>
                    </div>
                  </code>
                </CopyToClipboard>
              </Transition>
            </div>
          </div>
          <Transition
            show={!isCodeHidden}
            enter="transition-all ease-in duration-300 overflow-hidden"
            enterFrom="max-h-0"
            enterTo="max-h-[var(--dynamic-height)]"
            leave="transition-[max-height] ease-out duration-300 overflow-hidden"
            leaveFrom="max-h-[var(--dynamic-height)]"
            leaveTo="max-h-0"
            style={
              {
                '--dynamic-height': `${
                  Math.max(
                    source.toString().split('\n').length,
                    aiSuggestions?.toString().split('\n').length ?? 0
                  ) *
                    16 +
                  50
                }px`,
              } as React.CSSProperties
            }
          >
            <div
              className={clsx((isResultHidden || !result) && 'rounded-b-md')}
            >
              <div className="print:hidden py-5">
                <div>
                  <CodeEditor
                    ref={codeEditor}
                    workspaceId={props.document.workspaceId}
                    documentId={props.document.id}
                    blockId={blockId}
                    source={source}
                    language="sql"
                    readOnly={!props.isEditable || statusIsDisabled}
                    onEditWithAI={onToggleEditWithAIPromptOpen}
                    onRun={onRun}
                    onInsertBlock={props.insertBelow}
                    diff={aiSuggestions ?? undefined}
                    dataSourceId={dataSourceId}
                    disabled={statusIsDisabled}
                    onSelectionChanged={onSQLSelectionChanged}
                  />
                </div>
              </div>
              <ApproveDiffButons
                visible={diffButtonsVisible && !isCodeHidden}
                canTry={status._tag === 'idle'}
                onTry={onTry}
                onAccept={onAcceptAISuggestion}
                onReject={onRejectAISuggestion}
              />
              {isSQLBlockEditWithAIPromptOpen(props.block) &&
              !props.isPublicMode ? (
                <EditWithAIForm
                  loading={isAIEditing}
                  disabled={isAIEditing || aiSuggestions !== null}
                  onSubmit={onSubmitEditWithAI}
                  onClose={onCloseEditWithAIPrompt}
                  value={editWithAIPrompt}
                  hasOutput={result !== null}
                />
              ) : (
                <div
                  className={clsx('print:hidden px-3 pb-3', {
                    hidden: isCodeHidden,
                    'rounded-b-md': isResultHidden || !result,
                  })}
                >
                  <div className="flex justify-between text-xs">
                    <div className="flex items-center">{queryStatusText}</div>
                    <div className="flex items-center gap-x-2">
                      {!props.isPublicMode &&
                        aiSuggestions === null &&
                        props.isEditable &&
                        !isAIFixing &&
                        headerSelectValue !== 'duckdb' && (
                          <button
                            onClick={onSchemaExplorer}
                            className={clsx(
                              !props.isEditable
                                ? 'cursor-not-allowed bg-gray-200'
                                : 'cusor-pointer hover:bg-gray-50 hover:text-gray-700',
                              'flex items-center border rounded-sm border-gray-200 px-2 py-1 gap-x-1 text-gray-500 group relative font-sans'
                            )}
                          >
                            <BookOpenIcon className="w-3 h-3" />
                            <span>Schema</span>
                          </button>
                        )}

                      {!props.isPublicMode &&
                        props.isEditable &&
                        aiSuggestions === null && (
                          <TooltipV2<HTMLButtonElement>
                            title="Add a variable"
                            message="Interpolate Python variables into this query"
                            active={true}
                            className="w-48"
                          >
                            {(ref) => (
                              <button
                                ref={ref}
                                disabled={!props.isEditable}
                                className={clsx(
                                  !props.isEditable || !hasOaiKey
                                    ? 'cursor-not-allowed bg-gray-200'
                                    : 'cusor-pointer hover:bg-gray-50 hover:text-gray-700',
                                  'flex items-center border rounded-sm border-gray-200 px-2 py-1 gap-x-1 text-gray-500 group relative font-sans'
                                )}
                                onClick={onAddVariable}
                              >
                                <VariableIcon className="w-3 h-3" />
                                <span>Variable</span>
                              </button>
                            )}
                          </TooltipV2>
                        )}
                      {!props.isPublicMode &&
                        aiSuggestions === null &&
                        props.isEditable &&
                        !isAIFixing && (
                          <TooltipV2<HTMLButtonElement>
                            content={(ref) => (
                              <div
                                ref={ref}
                                className={clsx(
                                  'font-sans pointer-events-none bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col items-center justify-center gap-y-1 z-30',
                                  hasOaiKey ? 'w-32' : 'w-40'
                                )}
                              >
                                <span className="text-center">
                                  {hasOaiKey
                                    ? 'Open AI edit form'
                                    : 'Missing OpenAI API key'}
                                </span>
                                <span className="inline-flex gap-x-1 items-center text-gray-400">
                                  {hasOaiKey ? (
                                    <>
                                      <span>⌘</span>
                                      <span>+</span>
                                      <span>e</span>
                                    </>
                                  ) : (
                                    <span>
                                      Admins can add an OpenAI key in settings.
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                            active={true}
                          >
                            {(ref) => (
                              <button
                                ref={ref}
                                disabled={!props.isEditable}
                                onClick={onToggleEditWithAIPromptOpen}
                                className={clsx(
                                  !props.isEditable || !hasOaiKey
                                    ? 'cursor-not-allowed bg-gray-200'
                                    : 'cusor-pointer hover:bg-gray-50 hover:text-gray-700',
                                  'flex items-center border rounded-sm border-gray-200 px-2 py-1 gap-x-1 text-gray-500 group relative font-sans'
                                )}
                              >
                                <SparklesIcon className="w-3 h-3" />
                                <span>Edit with AI</span>
                              </button>
                            )}
                          </TooltipV2>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Transition>
        </div>
        {result && (
          <SQLResult
            page={page}
            dashboardPage={dashboardPage}
            result={result}
            isPublic={false}
            documentId={props.document.id}
            workspaceId={props.document.workspaceId}
            blockId={blockId}
            dataframeName={dataframeName?.value ?? ''}
            isResultHidden={isResultHidden ?? false}
            toggleResultHidden={toggleResultHidden}
            isFixingWithAI={isAIFixing}
            onFixWithAI={onFixWithAI}
            dashboardMode={props.dashboardMode}
            canFixWithAI={hasOaiKey}
            sort={sort}
            isAddVisualizationDisabled={isVisualizationButtonDisabled}
            onAddVisualization={onAddVisualization}
            onChangeSort={onChangeSort}
            onChangePage={onChangePage}
            loadingPage={loadingPage}
            onChangeDashboardPageSize={onChangeDashboardPageSize}
            hasTitle={title.trim() !== ''}
            dashboardPageSize={dashboardPageSize}
          />
        )}
      </div>
      <div
        className={clsx(
          'absolute h-full transition-opacity opacity-0 group-hover/block:opacity-100 pl-1.5 right-0 top-0 translate-x-full flex flex-col gap-y-1',
          isEditorFocused || statusIsDisabled ? 'opacity-100' : 'opacity-0',
          !props.isEditable ? 'hidden' : 'block'
        )}
      >
        <TooltipV2<HTMLButtonElement> {...runTooltipContent} active={true}>
          {(ref) => (
            <button
              ref={ref}
              onClick={onRunAbort}
              disabled={isRunButtonDisabled}
              className={clsx(
                {
                  'bg-gray-200': isRunButtonDisabled,
                  'bg-red-200':
                    status._tag === 'running' && envStatus === 'Running',
                  'bg-yellow-300':
                    !isRunButtonDisabled &&
                    (status._tag === 'enqueued' ||
                      (status._tag === 'running' && envStatus !== 'Running')),
                  'bg-primary-200':
                    !isRunButtonDisabled && status._tag === 'idle',
                },
                'rounded-sm h-6 min-w-6 flex items-center justify-center relative group disabled:cursor-not-allowed'
              )}
            >
              {status._tag !== 'idle' ? (
                <div>
                  {status._tag === 'enqueued' ? (
                    <ClockIcon className="w-3 h-3 text-gray-500" />
                  ) : (
                    <StopIcon className="w-3 h-3 text-gray-500" />
                  )}
                </div>
              ) : (
                <PlayIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
          )}
        </TooltipV2>
        {!props.dashboardMode && (
          <HiddenInPublishedButton
            isBlockHiddenInPublished={props.isBlockHiddenInPublished}
            onToggleIsBlockHiddenInPublished={onToggleIsBlockHiddenInPublished}
            hasMultipleTabs={props.hasMultipleTabs}
            isCodeHidden={isCodeHidden}
            onToggleIsCodeHidden={toggleCodeHidden}
            isOutputHidden={isResultHidden}
            onToggleIsOutputHidden={toggleResultHidden}
          />
        )}

        {((result && !isResultHidden) || !isCodeHidden) &&
          !props.dashboardMode && (
            <SaveReusableComponentButton
              isComponent={blockId === component?.blockId}
              onSave={onSaveReusableComponent}
              disabled={!props.isEditable || isComponentInstance}
              isComponentInstance={isComponentInstance}
            />
          )}

        {((result && !isResultHidden) || !isCodeHidden) &&
          !props.dashboardMode && (
            <FormatSQLButton
              onFormat={onToggleFormatSQLCode}
              disabled={!props.isEditable}
            />
          )}

        {((result && !isResultHidden) || !isCodeHidden) &&
          dataSource?.config.type === 'athena' && (
            <SQLQueryConfigurationButton
              dataSource={dataSource}
              value={configuration}
              onChange={onChangeConfiguration}
              disabled={!props.isEditable}
            />
          )}
      </div>
    </div>
  )
}

export default SQLBlock
