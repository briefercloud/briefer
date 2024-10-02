import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  PlayIcon,
  StopIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid'
import * as Y from 'yjs'
import {
  type PythonBlock,
  setTitle,
  getPythonBlockExecStatus,
  execStatusIsDisabled,
  getPythonAISuggestions,
  isPythonBlockEditWithAIPromptOpen,
  isPythonBlockAIEditing,
  getPythonBlockEditWithAIPrompt,
  requestPythonFixWithAI,
  requestPythonEditWithAI,
  closePythonEditWithAIPrompt,
  getPythonSource,
  isFixingPythonWithAI,
  togglePythonEditWithAIPromptOpen,
  getBaseAttributes,
  getPythonAttributes,
  createComponentState,
  YBlock,
} from '@briefer/editor'
import clsx from 'clsx'
import type { ApiDocument, ApiWorkspace } from '@briefer/database'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { useCallback, useEffect, useMemo } from 'react'
import useCodeEditor from '@/hooks/useV2CodeEditor'
import { DiffEditor, Editor } from '@monaco-editor/react'
import {
  ExecutingPythonText,
  LoadingEnvText,
  PythonSucceededText,
} from '@/components/ExecutionStatusText'
import { ConnectDragPreview } from 'react-dnd'
import ApproveDiffButons from '../../ApproveDiffButtons'
import EditWithAIForm from '../../EditWithAIForm'
import { PythonExecTooltip } from '../../ExecTooltip'
import { useMonacoContext } from '@/components/MonacoProvider'
import { PythonOutputs } from './PythonOutput'
import ScrollBar from '@/components/ScrollBar'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import useEditorAwareness from '@/hooks/useEditorAwareness'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import useProperties from '@/hooks/useProperties'
import { SaveReusableComponentButton } from '@/components/ReusableComponents'
import { useReusableComponents } from '@/hooks/useReusableComponents'

interface Props {
  document: ApiDocument
  block: Y.XmlElement<PythonBlock>
  blocks: Y.Map<YBlock>
  isEditable: boolean
  dragPreview: ConnectDragPreview | null
  onRun: (block: Y.XmlElement<PythonBlock>) => void
  onTry: (block: Y.XmlElement<PythonBlock>) => void
  isPublicMode: boolean
  isPDF: boolean
  dashboardPlace: 'controls' | 'view' | null
  hasMultipleTabs: boolean
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: (blockId: string) => void
  isCursorWithin: boolean
  isCursorInserting: boolean
  selectBelow?: () => void
  insertBelow?: () => void
}
function PythonBlock(props: Props) {
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

  const { status: envStatus, loading: envLoading } = useEnvironmentStatus(
    props.document.workspaceId
  )

  const toggleResultHidden = useCallback(() => {
    props.block.doc?.transact(() => {
      const currentIsResultHidden = props.block.getAttribute('isResultHidden')
      props.block.setAttribute('isResultHidden', !currentIsResultHidden)
    })
  }, [props.block])

  const toggleCodeHidden = useCallback(() => {
    props.block.doc?.transact(() => {
      const currentIsCodeHidden = props.block.getAttribute('isCodeHidden')
      props.block.setAttribute('isCodeHidden', !currentIsCodeHidden)
    })
  }, [props.block])

  const status = props.block.getAttribute('status')

  const onRun = useCallback(() => {
    props.onRun(props.block)
  }, [props.block, props.onRun])

  const onTry = useCallback(() => {
    props.onTry(props.block)
  }, [props.block, props.onTry])

  const onRunAbort = useCallback(() => {
    if (status === 'running' || status === 'running-suggestion') {
      props.block.setAttribute('status', 'abort-requested')
    } else {
      onRun()
    }
  }, [status, props.block, onRun])

  const execStatus = getPythonBlockExecStatus(props.block)
  const statusIsDisabled = execStatusIsDisabled(execStatus)

  const onToggleEditWithAIPromptOpen = useCallback(() => {
    if (!hasOaiKey) {
      return
    }

    togglePythonEditWithAIPromptOpen(props.block)
  }, [props.block, hasOaiKey])

  const { id: blockId, componentId } = getPythonAttributes(props.block)
  const [
    { data: components },
    { create: createReusableComponent, update: updateReusableComponent },
  ] = useReusableComponents(props.document.workspaceId)
  const component = useMemo(
    () => components.find((c) => c.id === componentId),
    [components, componentId]
  )

  const {
    editor,
    isEditorFocused,
    onMount: onMountEditor,
    onMountDiffEditor,
    editorOptions,
    diffEditorOptions,
    focusEditor,
    key: editorKey,
    reLayout,
    acceptDiffEditor,
  } = useCodeEditor(
    blockId,
    getPythonSource(props.block),
    getPythonAISuggestions(props.block),
    onRun,
    statusIsDisabled,
    !props.isEditable,
    onToggleEditWithAIPromptOpen,
    props.selectBelow,
    props.insertBelow
  )

  const source = props.block.getAttribute('source')
  const lastQuery = props.block.getAttribute('lastQuery')
  const lastQueryTime = props.block.getAttribute('lastQueryTime')
  const queryStatusText = useMemo(() => {
    if (status === 'running' || status === 'running-suggestion') {
      if (envStatus === 'Starting') {
        return <LoadingEnvText />
      } else {
        return <ExecutingPythonText />
      }
    }

    if (status === 'idle') {
      if (source?.toJSON() === lastQuery && lastQueryTime) {
        return <PythonSucceededText lastExecutionTime={lastQueryTime} />
      }
    }

    return null
  }, [status, lastQuery, lastQueryTime, source, envStatus])

  const isCodeHidden = props.block.getAttribute('isCodeHidden')
  const isResultHidden = props.block.getAttribute('isResultHidden')

  const { title } = getBaseAttributes(props.block)
  const onChangeTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(props.block, e.target.value)
    },
    [props.block]
  )

  const results = props.block.getAttribute('result') ?? []
  const aiSuggestions = getPythonAISuggestions(props.block)
  const editWithAIPrompt = getPythonBlockEditWithAIPrompt(props.block)
  const isAIEditing = isPythonBlockAIEditing(props.block)

  const onCloseEditWithAIPrompt = useCallback(() => {
    closePythonEditWithAIPrompt(props.block, false)
    focusEditor()
  }, [props.block, focusEditor])

  const onSubmitEditWithAI = useCallback(() => {
    requestPythonEditWithAI(props.block)
  }, [props.block])

  const onAcceptAISuggestion = useCallback(() => {
    acceptDiffEditor()
    props.block.setAttribute('aiSuggestions', null)
  }, [acceptDiffEditor, props.block])

  const onRejectAISuggestion = useCallback(() => {
    props.block.setAttribute('aiSuggestions', null)
  }, [props.block])

  const onFixWithAI = useCallback(() => {
    if (!hasOaiKey) {
      return
    }

    requestPythonFixWithAI(props.block)
  }, [props.block, hasOaiKey])

  useEffect(() => {
    reLayout()

    if (props.isCursorWithin && !props.isCursorInserting) {
      focusEditor()
    }
  }, [reLayout, aiSuggestions])

  const diffButtonsVisible =
    aiSuggestions !== null &&
    (status === 'idle' ||
      status === 'running-suggestion' ||
      status === 'try-suggestion-requested')

  const [, { setModelDocumentBlock, removeModelDocumentBlock }] =
    useMonacoContext()

  useEffect(() => {
    const model = editor?.getModel()
    if (!model) {
      return
    }

    setModelDocumentBlock(model.id, props.document.id, blockId)

    return () => {
      removeModelDocumentBlock(model.id)
    }
  }, [
    editor,
    props.document.id,
    blockId,
    setModelDocumentBlock,
    removeModelDocumentBlock,
  ])

  const onToggleIsBlockHiddenInPublished = useCallback(() => {
    props.onToggleIsBlockHiddenInPublished(blockId)
  }, [props.onToggleIsBlockHiddenInPublished, blockId])

  const { setInteractionState } = useEditorAwareness()
  const onClickWithin = useCallback(() => {
    setInteractionState({
      cursorBlockId: blockId ?? null,
      scrollIntoView: false,
      mode: 'normal',
    })
  }, [blockId, setInteractionState])

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
          type: 'python',
        },
        props.document.title
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

  if (props.dashboardPlace) {
    return (
      <PythonOutputs
        className="flex flex-col h-full ph-no-capture"
        outputs={results}
        isFixWithAILoading={isFixingPythonWithAI(props.block)}
        onFixWithAI={onFixWithAI}
        isPDF={props.isPDF}
        isDashboardView={props.dashboardPlace === 'view'}
        lazyRender={props.dashboardPlace === 'controls'}
        canFixWithAI={hasOaiKey}
        blockId={blockId}
      />
    )
  }

  return (
    <div
      className="bg-white relative group/block"
      onClick={onClickWithin}
      data-block-id={blockId}
    >
      <div
        className={clsx(
          'rounded-md border',
          props.isBlockHiddenInPublished && 'border-dashed',
          props.hasMultipleTabs ? 'rounded-tl-none' : 'rounded-tl-md',
          {
            'border-ceramic-400 shadow-sm': isEditorFocused && props.isEditable,
            'border-blue-400 shadow-sm':
              props.isCursorWithin && !props.isCursorInserting,
            'border-gray-200': !isEditorFocused && !props.isCursorWithin,
          }
        )}
      >
        <div
          className={clsx('rounded-md', { 'bg-gray-100': statusIsDisabled })}
        >
          <div
            className="py-3"
            ref={(d) => {
              props.dragPreview?.(d)
            }}
          >
            <div className="flex items-center justify-between px-3 pr-3 gap-x-4 h-[1.6rem] font-sans">
              <div className="select-none text-gray-300 text-xs flex items-center h-full w-full">
                <button
                  className="print:hidden h-4 w-4 hover:text-gray-400 rounded-sm mr-0.5"
                  onClick={toggleCodeHidden}
                >
                  {isCodeHidden ? <ChevronRightIcon /> : <ChevronDownIcon />}
                </button>
                <input
                  type="text"
                  className={clsx(
                    'font-sans bg-transparent pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-500 hover:ring-1 focus:ring-1 ring-inset placeholder:text-gray-400 focus:ring-inset h-full py-0 text-xs disabled:ring-0 h-full'
                  )}
                  placeholder="Python"
                  value={title}
                  disabled={!props.isEditable}
                  onChange={onChangeTitle}
                />
              </div>
            </div>
          </div>
          <div
            className={clsx(
              'print:hidden',
              isCodeHidden ? 'invisible h-0 overflow-hidden' : 'py-5'
            )}
          >
            <div
              className={clsx(
                aiSuggestions === null && 'invisible h-0 overflow-hidden'
              )}
            >
              <DiffEditor
                key={editorKey}
                className="ph-no-capture"
                language="python"
                onMount={onMountDiffEditor}
                options={diffEditorOptions}
              />
            </div>
            <div
              className={clsx(
                aiSuggestions !== null && 'invisible h-0 overflow-hidden'
              )}
            >
              <Editor
                key={editorKey}
                // className="ph-no-capture"
                language="python"
                onMount={onMountEditor}
                options={editorOptions}
              />
            </div>
          </div>
          <ApproveDiffButons
            visible={diffButtonsVisible}
            canTry={status === 'idle'}
            onTry={onTry}
            onAccept={onAcceptAISuggestion}
            onReject={onRejectAISuggestion}
          />
          {isPythonBlockEditWithAIPromptOpen(props.block) ? (
            <EditWithAIForm
              loading={isAIEditing}
              disabled={isAIEditing || aiSuggestions !== null}
              onSubmit={onSubmitEditWithAI}
              onClose={onCloseEditWithAIPrompt}
              value={editWithAIPrompt}
            />
          ) : (
            <div
              className={clsx('print:hidden px-3 pb-3', {
                hidden: isCodeHidden,
              })}
            >
              <div className="flex justify-between text-xs">
                <div className="flex items-center">{queryStatusText}</div>
                {aiSuggestions === null &&
                  !props.isPublicMode &&
                  props.isEditable &&
                  !isFixingPythonWithAI(props.block) && (
                    <button
                      disabled={!props.isEditable}
                      onClick={onToggleEditWithAIPromptOpen}
                      className={clsx(
                        !props.isEditable || !hasOaiKey
                          ? 'cursor-not-allowed bg-gray-200'
                          : 'cusor-pointer hover:bg-gray-50 hover:text-gray-700',
                        'flex items-center border rounded-sm border-gray-200 px-2 py-1 gap-x-2 text-gray-400 group relative font-sans'
                      )}
                    >
                      <SparklesIcon className="w-3 h-3" />
                      <span>Edit with AI</span>
                      <div
                        className={clsx(
                          'font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col items-center justify-center gap-y-1 z-20',
                          hasOaiKey ? 'w-28' : 'w-40'
                        )}
                      >
                        <span>
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
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>

        <div
          className={clsx('p-3 text-xs border-t border-gray-200', {
            hidden: results.length === 0,
          })}
        >
          <div className="print:hidden flex text-gray-300 items-center gap-x-1">
            <button
              className="h-4 w-4 hover:text-gray-400"
              onClick={toggleResultHidden}
            >
              {isResultHidden ? <ChevronRightIcon /> : <ChevronDownIcon />}
            </button>
            <span>{isResultHidden ? 'Output collapsed' : 'Output'}</span>
          </div>

          <ScrollBar
            className={clsx('overflow-scroll ph-no-capture', {
              hidden: isResultHidden,
              'px-4 pt-5 pb-2': !props.isPDF,
            })}
          >
            <PythonOutputs
              outputs={results}
              isFixWithAILoading={isFixingPythonWithAI(props.block)}
              onFixWithAI={onFixWithAI}
              canFixWithAI={hasOaiKey}
              isPDF={props.isPDF}
              isDashboardView={false}
              lazyRender={!props.isPDF}
              blockId={blockId}
            />
          </ScrollBar>
        </div>
      </div>

      <div
        className={clsx(
          'absolute h-full transition-opacity opacity-0 group-hover/block:opacity-100 pl-1.5 right-0 top-0 translate-x-full flex flex-col gap-y-1',
          isEditorFocused || statusIsDisabled ? 'opacity-100' : 'opacity-0',
          !props.isEditable ? 'hidden' : 'block'
        )}
      >
        <button
          onClick={onRunAbort}
          disabled={status !== 'idle' && status !== 'running'}
          className={clsx(
            {
              'bg-gray-200 cursor-not-allowed':
                status !== 'idle' && status !== 'running',
              'bg-red-200': status === 'running' && envStatus === 'Running',
              'bg-yellow-300': status === 'running' && envStatus !== 'Running',
              'bg-primary-200': status === 'idle',
            },
            'rounded-sm h-6 min-w-6 flex items-center justify-center relative group'
          )}
        >
          {status !== 'idle' ? (
            <div>
              {execStatus === 'enqueued' ? (
                <ClockIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <StopIcon className="w-3 h-3 text-gray-500" />
              )}
              <PythonExecTooltip
                envStatus={envStatus}
                envLoading={envLoading}
                execStatus={execStatus}
                status={status}
              />
            </div>
          ) : (
            <RunPythonTooltip />
          )}
        </button>
        <HiddenInPublishedButton
          isBlockHiddenInPublished={props.isBlockHiddenInPublished}
          onToggleIsBlockHiddenInPublished={onToggleIsBlockHiddenInPublished}
          hasMultipleTabs={props.hasMultipleTabs}
        />
        <SaveReusableComponentButton
          isComponent={blockId === component?.blockId}
          onSave={onSaveReusableComponent}
          disabled={!props.isEditable || isComponentInstance}
          isComponentInstance={isComponentInstance}
        />
      </div>
    </div>
  )
}

function RunPythonTooltip() {
  return (
    <div>
      <PlayIcon className="w-3 h-3 text-gray-500" />
      <div className="font-sans pointer-events-none absolute -top-1 left-1/2 -translate-y-full -translate-x-1/2 w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1">
        <span>Run code</span>
        <span className="inline-flex gap-x-1 items-center text-gray-400">
          <span>⌘</span>
          <span>+</span>
          <span>Enter</span>
        </span>
      </div>
    </div>
  )
}

export default PythonBlock
