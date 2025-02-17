import { Awareness } from 'y-protocols/awareness'
import clsx from 'clsx'
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ConnectDragPreview,
  DropTargetMonitor,
  useDrag,
  useDrop,
} from 'react-dnd'
import { useLastUpdatedAt, useYDocState } from '@/hooks/useYDoc'
import * as Y from 'yjs'
import Title from './Title'
import DragHandle from './DragHandle'
import {
  addBlockGroup,
  updateOrder,
  groupBlockGroups,
  checkCanDropBlockGroup,
  removeBlockGroup,
  YBlock,
  checkCanDropBlock,
  groupBlocks,
  BlockType,
  addGroupedBlock,
  switchBlockType,
  getPrettyTitle,
  duplicateTab,
  duplicateBlockGroup,
  removeBlock,
  addBlockGroupAfterBlock,
  getBaseAttributes,
  TabRef as TabRefT,
  YBlockGroup,
  canReorderTab,
  getCurrentTabId,
  reorderTab,
  switchActiveTab,
  ungroupTab,
  getTabsFromBlockGroupId,
  toggleIsBlockHiddenInPublished,
  getTabsFromBlockGroup,
  getBlockGroup,
  RemoveBlockGroupResult,
  RemoveBlockDashboardConflictResult,
  getNextBlockIdAfterDelete,
  isRunnableBlock,
  ExecutionQueue,
  AITasks,
  getClosestDataframe,
  getBlockFlatPosition,
} from '@briefer/editor'
import EnvBar from '../EnvBar'
import PlusButton from './PlusButton'
import RichTextBlock from './customBlocks/richText'
import SQLBlock from './customBlocks/sql'
import { ApiDocument, UserWorkspaceRole } from '@briefer/database'
import PythonBlock from './customBlocks/python'
import VisualizationBlock from './customBlocks/visualization'
import { DataFrame, ElementType } from '@briefer/types'
import {
  Bars3CenterLeftIcon,
  ChartPieIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleStackIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  QueueListIcon,
  CommandLineIcon as CommandLineSmallIcon,
  ArrowUpTrayIcon,
  CalendarIcon,
} from '@heroicons/react/20/solid'
import { ContentSkeleton } from './ContentSkeleton'
import InputBlock from './customBlocks/input'
import FileUploadBlock from './customBlocks/fileUpload'
import ExecIndicator from './ExecIndicator'
import DropdownInputBlock from './customBlocks/dropdownInput'
import DateInputBlock from './customBlocks/dateInput'
import NewTabButton from './NewTabButton'
import useScrollDetection from '@/hooks/useScrollDetection'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { APIDataSources } from '@/hooks/useDatasources'
import { IProvider } from '@/hooks/useYProvider'
import { widthClasses } from './constants'
import { descend, head, sortWith } from 'ramda'
import WritebackBlock from './customBlocks/writeback'
import RemoveBlockDashboardConflictDialog from './RemoveBlockDashboardConflictDialog'
import RemoveTabDashboardConflictDialog from './RemoveTabDashboardConflictDialog'
import PivotTableBlock from './customBlocks/pivotTable'
import useHotkeys from '@/hooks/useHotkeys'
import { HotkeysProvider } from 'react-hotkeys-hook'
import useEditorAwareness, {
  EditorAwarenessProvider,
} from '@/hooks/useEditorAwareness'
import { SQLExtensionProvider } from './CodeEditor/sql'
import VisualizationV2Block from './customBlocks/visualizationV2'
import useSideBar from '@/hooks/useSideBar'
import { createPortal } from 'react-dom'
import { Transition } from '@headlessui/react'
import {
  BarsArrowDownIcon,
  FolderIcon,
  MinusCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'

// The react-dnd package does not export this...
type Identifier = string | symbol

const layoutGetter = (yDoc: Y.Doc) => yDoc.getArray<YBlockGroup>('layout')
const blocksGetter = (yDoc: Y.Doc) => yDoc.getMap<YBlock>('blocks')
const dataframesGetter = (yDoc: Y.Doc) => yDoc.getMap<DataFrame>('dataframes')

const Dropzone = ({
  index,
  isLast,
  isEditable,
  onDropItem,
  onCheckCanDrop,
  onAddBlock,
  writebackEnabled,
  workspaceId,
}: {
  index: number
  isLast: boolean
  isEditable: boolean
  onDropItem: (
    blockGroupId: string,
    blockId: string,
    targetIndex: number,
    type: Identifier | null
  ) => void
  onCheckCanDrop: (
    id: string,
    index: number,
    type: Identifier | null
  ) => boolean
  onAddBlock: (type: BlockType, index: number) => void
  writebackEnabled: boolean
  workspaceId: string
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: [ElementType.Block, ElementType.BlockGroup],
      drop: (
        { blockGroupId, blockId }: { blockGroupId: string; blockId: string },
        monitor
      ) => onDropItem(blockGroupId, blockId, index, monitor.getItemType()),
      canDrop: ({ blockGroupId }, monitor) =>
        onCheckCanDrop(blockGroupId, index, monitor.getItemType()),
      collect: (monitor) => ({
        isOver: monitor.isOver() ?? false,
        canDrop: monitor.canDrop() ?? false,
      }),
    }),
    [index, updateOrder, onCheckCanDrop, onDropItem]
  )

  const addBlockHandler = useCallback(
    (type: BlockType) => {
      onAddBlock(type, index)
    },
    [onAddBlock, index]
  )

  return (
    <div
      ref={(d) => {
        drop(d)
      }}
      className={clsx('w-full', isOver && canDrop ? 'bg-ceramic-300' : '')}
    >
      <PlusButton
        workspaceId={workspaceId}
        isLast={isLast}
        alwaysOpen={false}
        onAddBlock={addBlockHandler}
        isEditable={isEditable}
        writebackEnabled={writebackEnabled}
      />
    </div>
  )
}

export function getTabIcon(
  blockType: BlockType
): React.ComponentType<React.SVGProps<SVGSVGElement>> {
  switch (blockType) {
    case BlockType.RichText:
      return Bars3CenterLeftIcon
    case BlockType.SQL:
      return CircleStackIcon
    case BlockType.Python:
      return CommandLineSmallIcon
    case BlockType.Visualization:
    case BlockType.VisualizationV2:
      return ChartPieIcon
    case BlockType.Input:
      return PencilSquareIcon
    case BlockType.DropdownInput:
      return QueueListIcon
    case BlockType.DateInput:
      return CalendarIcon
    case BlockType.FileUpload:
      return DocumentArrowUpIcon
    case BlockType.DashboardHeader:
      return ExclamationTriangleIcon
    case BlockType.Writeback:
      return ArrowUpTrayIcon
    case BlockType.PivotTable:
      // TODO: PivotTable icon
      return Bars3CenterLeftIcon
  }
}

interface TabProps {
  tabRef: TabRefT
  blocks: Y.Map<YBlock>
  onSwitchActiveTab: (tabId: string) => void
  onReorderTab: (
    blockGroupId: string,
    blockId: string,
    targetId: string,
    side: 'left' | 'right'
  ) => void
  onCheckCanReorderTab: (
    blockGroupId: string,
    blockId: string,
    targetId: string,
    side: 'left' | 'right'
  ) => boolean
  isFirst?: boolean
  isDraggable: boolean
  executionQueue: ExecutionQueue
  onRun: (blockId: string) => void
  onRunOnwards: (blockId: string) => void
  onDuplicateTab: (blockId: string) => void
  onDeleteTab: (blockId: string) => void
}
function Tab(props: TabProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [draggingSide, setDraggingSide] = useState<'left' | 'right'>('left')

  const getDraggingSide = useCallback(
    (monitor: DropTargetMonitor) => {
      const offset = monitor.getClientOffset()
      const buttonPos = buttonRef.current?.getBoundingClientRect()

      // check if dragging to the left or right of the button
      if (offset && buttonPos) {
        const buttonCenter = buttonPos.x + buttonPos.width / 2
        if (offset.x < buttonCenter) {
          return 'left'
        } else {
          return 'right'
        }
      }
    },
    [buttonRef]
  )

  const [{ isDragging }, drag] = useDrag(
    () => ({
      canDrag: props.isDraggable,
      type: ElementType.Block,
      item: () => {
        return {
          blockGroupId: props.tabRef.blockGroupId,
          blockId: props.tabRef.blockId,
          dragSize: Math.ceil(
            buttonRef.current?.getBoundingClientRect().width ?? 0
          ),
        }
      },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [props.tabRef.blockGroupId, props.tabRef.blockId]
  )

  const [{ isOver, canDrop, dragSize }, drop] = useDrop(
    () => ({
      accept: ElementType.Block,
      drop: (
        {
          blockGroupId,
          blockId,
        }: {
          blockGroupId: string
          blockId: string
          dragSize: number
        },
        monitor
      ) => {
        const side = getDraggingSide(monitor)
        if (!side) {
          return
        }

        props.onReorderTab(blockGroupId, blockId, props.tabRef.blockId, side)
      },
      canDrop: ({ blockId }, monitor) => {
        const side = getDraggingSide(monitor)
        if (!side) {
          return false
        }

        return props.onCheckCanReorderTab(
          props.tabRef.blockGroupId,
          blockId,
          props.tabRef.blockId,
          side
        )
      },
      hover: (_item, monitor) => {
        const side = getDraggingSide(monitor)
        if (side) {
          setDraggingSide(side)
        }
      },
      collect: (monitor) => {
        return {
          isOver: monitor.isOver() ?? false,
          canDrop: monitor.canDrop() ?? false,
          dragSize: monitor.getItem()?.dragSize ?? 0,
        }
      },
    }),

    [props.tabRef.blockGroupId, props.tabRef.blockId]
  )

  useEffect(() => {
    if (!props.isDraggable) {
      return
    }

    drag(buttonRef)
  }, [props.isDraggable, drag, buttonRef])

  const Icon = getTabIcon(props.tabRef.type)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
  } | null>(null)
  const onRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const onRun = useCallback(() => {
    props.onRun(props.tabRef.blockId)
    setContextMenu(null)
  }, [props.onRun])

  const onRunOnwards = useCallback(() => {
    props.onRunOnwards(props.tabRef.blockId)
    setContextMenu(null)
  }, [props.onRunOnwards])

  const onDuplicateTab = useCallback(() => {
    props.onDuplicateTab(props.tabRef.blockId)
    setContextMenu(null)
  }, [props.onDuplicateTab])

  const onDeleteTab = useCallback(() => {
    props.onDeleteTab(props.tabRef.blockId)
    setContextMenu(null)
  }, [props.onDeleteTab])

  const contextMenuRef = useRef<HTMLDivElement>(null)
  useOnClickOutside(
    () => setContextMenu(null),
    contextMenuRef,
    contextMenu !== null
  )

  return (
    <>
      <div
        ref={(d) => {
          drop(d)
        }}
        className="h-full flex text-xs"
      >
        {draggingSide === 'left' && isOver && canDrop && (
          <div
            className={`bg-ceramic-100`}
            style={{ width: `${dragSize}px` }}
          />
        )}
        <button
          key={props.tabRef.blockId}
          ref={buttonRef}
          onClick={() => props.onSwitchActiveTab(props.tabRef.blockId)}
          className={clsx(
            'flex gap-x-2 items-center border-l border-r border-t border-gray-200 px-2.5 py-1.5 rounded-t-sm whitespace-nowrap',
            props.tabRef.isCurrent
              ? 'bg-white text-gray-950'
              : 'bg-gray-50 text-gray-400 hover:bg-gray-100',
            isDragging ? 'opacity-0' : '',
            !props.isFirst ? '-ml-[1px]' : ''
          )}
          onContextMenu={onRightClick}
        >
          <div className="flex items-center gap-x-1">
            <Icon
              className={clsx(
                'h-3 w-3',
                props.tabRef.isCurrent ? 'text-gray-600' : 'text-gray-300'
              )}
            />
            {props.tabRef.title || getPrettyTitle(props.tabRef.type)}{' '}
            {props.tabRef.isHiddenInPublished && (
              <span
                className={clsx(
                  'pl-0.5 text-[10px]',
                  props.tabRef.isCurrent ? 'text-gray-400' : 'text-gray-300'
                )}
              >
                hidden
              </span>
            )}
          </div>
          <ExecIndicator
            tabRef={props.tabRef}
            blocks={props.blocks}
            executionQueue={props.executionQueue}
          />
        </button>
        {draggingSide === 'right' && isOver && canDrop && (
          <div
            className={`bg-ceramic-100`}
            style={{ width: `${dragSize}px` }}
          />
        )}
      </div>
      {createPortal(
        <Transition
          as="div"
          className="absolute z-30"
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          style={{ left: contextMenu?.x, top: contextMenu?.y }}
          show={contextMenu !== null}
          ref={contextMenuRef}
        >
          <div className="rounded-md bg-white shadow-[0_4px_12px_#CFCFCF] ring-1 ring-gray-100 focus:outline-none font-sans divide-y divide-gray-200 flex flex-col text-xs text-gray-600">
            <div className="flex flex-col divide-y divide-gray-200">
              <div className="py-0.5 px-0.5">
                <button
                  className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                  onClick={onRun}
                >
                  <PlayIcon className="h-4 w-4" />
                  <span>Run tab</span>
                </button>
                <button
                  className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                  onClick={onRunOnwards}
                >
                  <BarsArrowDownIcon className="h-4 w-4" />
                  <span>Run onwards</span>
                </button>
              </div>
              <div className="py-0.5 px-0.5">
                <button
                  className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                  onClick={onDuplicateTab}
                >
                  <FolderIcon className="h-4 w-4" />
                  <span>Duplicate tab</span>
                </button>
              </div>
              <div className="py-0.5 px-0.5">
                <button
                  className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                  onClick={onDeleteTab}
                >
                  <MinusCircleIcon className="h-4 w-4" />
                  <span>Delete tab</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>,
        document.body
      )}
    </>
  )
}

const DraggableTabbedBlock = (props: {
  id: string
  document: ApiDocument
  isEditable: boolean
  isApp: boolean
  onGroup: (
    blockGroupId: string,
    blockId: string,
    targetId: string,
    type: Identifier | null
  ) => void
  onAddGroupedBlock: (
    type: BlockType,
    blockGroupId: string,
    blockId: string,
    position: 'before' | 'after'
  ) => void
  onRemoveBlockGroup: (id: string) => void
  onRemoveBlock: (blockGroupId: string, id: string) => void
  awareness: Awareness
  dataSources: APIDataSources
  dataframes: Y.Map<DataFrame>
  isPublicViewer: boolean
  onDuplicateBlockGroup: (id: string) => void
  onDuplicateBlock: (blockGroupId: string, blockId: string) => void
  yDoc: Y.Doc
  isPDF: boolean
  onSchemaExplorer: (dataSourceId: string | null) => void
  insertBelow: () => void
  userId: string | null
  executionQueue: ExecutionQueue
  aiTasks: AITasks
  isFullScreen: boolean
}) => {
  const { state: layout } = useYDocState<Y.Array<YBlockGroup>>(
    props.yDoc,
    layoutGetter
  )
  const { state: blocks } = useYDocState<Y.Map<YBlock>>(
    props.yDoc,
    blocksGetter
  )

  const { startedAt: environmentStartedAt } = useEnvironmentStatus(
    props.document.workspaceId
  )

  const [{ isDragging }, drag, dragPreview] = useDrag(
    () => ({
      canDrag: props.isEditable && !props.isApp,
      type: ElementType.BlockGroup,
      previewOptions: {
        captureDraggingState: true,
      },
      item: () => ({ blockGroupId: props.id }),
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [props.id]
  )

  const tabRefs = useMemo(
    () =>
      getTabsFromBlockGroupId(layout.value, blocks.value, props.id).filter(
        (t) => (props.isApp ? !t.isHiddenInPublished : true)
      ),
    [props.id, layout, blocks]
  )
  const hasMultipleTabs = tabRefs.length > 1

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: [ElementType.Block, ElementType.BlockGroup],
      drop: (
        {
          blockGroupId: droppedBlockGroupId,
          blockId: droppedBlockId,
        }: { blockGroupId: string; blockId: string },
        monitor
      ) => {
        const droppedType = monitor.getItemType()
        props.onGroup(
          droppedBlockGroupId,
          droppedBlockId,
          props.id,
          droppedType
        )
      },
      canDrop: ({ blockGroupId }) => blockGroupId !== props.id,
      collect: (monitor) => ({
        isOver: monitor.isOver() ?? false,
        canDrop: monitor.canDrop() ?? false,
      }),
    }),
    [props.id, props.onGroup]
  )

  const addGroupedBlock = useCallback(
    (blockId: string, blockType: BlockType, position: 'before' | 'after') => {
      return props.onAddGroupedBlock(blockType, props.id, blockId, position)
    },
    [props.onAddGroupedBlock, props.id]
  )

  const onFileUploadBlockPythonUsage = useCallback(
    (block: Y.XmlElement<FileUploadBlock>, filename: string, type: string) => {
      const fileExtension =
        type === 'application/json'
          ? 'json'
          : type === 'text/csv'
          ? 'csv'
          : type === 'application/vnd.ms-excel'
          ? 'xls'
          : type ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ? 'xlsx'
          : ''

      const source =
        fileExtension !== ''
          ? `import pandas as pd
df = pd.read_${fileExtension}('${filename}')
df`
          : `file = open('${filename}').read()
file`

      const blockId = addBlockGroupAfterBlock(
        layout.value,
        blocks.value,
        {
          type: BlockType.Python,
          source,
        },
        getBaseAttributes(block).id
      )

      const pythonBlock = blocks.value.get(blockId)
      if (!pythonBlock) {
        return
      }

      props.executionQueue.enqueueBlock(
        pythonBlock,
        props.userId,
        environmentStartedAt,
        { _tag: 'python', isSuggestion: false }
      )
    },
    [layout, blocks, props.executionQueue, props.userId, environmentStartedAt]
  )

  const onFileUploadBlockQueryUsage = useCallback(
    (block: Y.XmlElement<FileUploadBlock>, filename: string) => {
      const table = filename
        // replace `\` with `\\`
        .replace(/\\/g, '\\\\')
        // replace `'` with `''`
        .replace(/'/g, "''")
        // replace `"` with `\"`
        .replace(/"/g, '\\"')

      const extension = filename.split('.').pop()
      let source = `SELECT * FROM '${table}' LIMIT 1000000`
      if (extension === 'xlsx') {
        source = `SELECT * FROM st_read('${table}') LIMIT 1000000`
      }

      const blockId = addBlockGroupAfterBlock(
        layout.value,
        blocks.value,
        {
          type: BlockType.SQL,
          dataSourceId: null,
          isFileDataSource: true,
          source,
        },
        getBaseAttributes(block).id
      )

      const sqlBlock = blocks.value.get(blockId)
      if (!sqlBlock) {
        return
      }

      props.executionQueue.enqueueBlock(
        sqlBlock,
        props.userId,
        environmentStartedAt,
        { _tag: 'sql', isSuggestion: false, selectedCode: null }
      )
    },
    [layout, blocks, props.executionQueue, props.userId, environmentStartedAt]
  )

  const onToggleIsBlockHiddenInPublished = useCallback(
    (blockId: string) => {
      const blockGroup = layout.value
        .toArray()
        .find((bg) => bg.getAttribute('id') === props.id)
      if (!blockGroup) {
        return
      }

      toggleIsBlockHiddenInPublished(blockGroup, blockId)
    },
    [layout, props.id]
  )

  const currentBlockId = useMemo(
    () => getCurrentTabId(layout.value, props.id, blocks.value, props.isApp),
    [layout, blocks, props.isApp]
  )

  const nodes = useMemo(() => {
    if (tabRefs.length === 0) {
      return <div>Block group is empty</div>
    }

    return tabRefs.map((tab) => (
      <TabRef
        key={tab.blockId}
        blocks={blocks.value}
        tab={tab}
        isEditable={props.isEditable}
        hasMultipleTabs={hasMultipleTabs}
        layout={layout.value}
        isPublicViewer={props.isPublicViewer}
        document={props.document}
        dataSources={props.dataSources}
        onToggleIsBlockHiddenInPublished={onToggleIsBlockHiddenInPublished}
        onSchemaExplorer={props.onSchemaExplorer}
        insertBelow={props.insertBelow}
        isPDF={props.isPDF}
        addGroupedBlock={addGroupedBlock}
        dataframes={props.dataframes}
        isApp={props.isApp}
        onFileUploadBlockPythonUsage={onFileUploadBlockPythonUsage}
        onFileUploadBlockQueryUsage={onFileUploadBlockQueryUsage}
        currentBlockId={currentBlockId}
        dragPreview={dragPreview}
        userId={props.userId}
        executionQueue={props.executionQueue}
        aiTasks={props.aiTasks}
        isFullScreen={props.isFullScreen}
      />
    ))
  }, [
    tabRefs,
    blocks,
    props.isEditable,
    hasMultipleTabs,
    layout,
    props.isPublicViewer,
    props.document,
    props.dataSources,
    onToggleIsBlockHiddenInPublished,
    props.onSchemaExplorer,
    props.insertBelow,
    props.isPDF,
    addGroupedBlock,
    props.dataframes,
    props.isApp,
    onFileUploadBlockPythonUsage,
    onFileUploadBlockQueryUsage,
    currentBlockId,
    dragPreview,
    props.userId,
    props.executionQueue,
  ])

  const onSwitchActiveTab = useCallback(
    (tabId: string) => {
      props.yDoc.transact(() => {
        switchActiveTab(layout.value, props.id, tabId)
      })
    },
    [props.yDoc, layout.value, props.id]
  )

  const onReorderTab = useCallback(
    (
      blockGroupId: string,
      blockId: string,
      targetId: string,
      side: 'left' | 'right'
    ) => {
      props.yDoc.transact(() => {
        return reorderTab(layout.value, blockGroupId, blockId, targetId, side)
      })
    },
    [props.yDoc, layout]
  )

  const onCheckCanReorderTab = useCallback(
    (
      blockGroupId: string,
      blockId: string,
      targetId: string,
      side: 'left' | 'right'
    ) => {
      return canReorderTab(layout.value, blockGroupId, blockId, targetId, side)
    },
    [layout]
  )

  const onDeleteCurrentTab = useCallback(() => {
    if (!currentBlockId) {
      return
    }

    props.onRemoveBlock(props.id, currentBlockId)
  }, [currentBlockId, props.id, props.onRemoveBlock])

  const onDeleteTab = useCallback(
    (blockId: string) => {
      props.onRemoveBlock(props.id, blockId)
    },
    [props.id, props.onRemoveBlock]
  )

  const onRunTab = useCallback(
    (blockId: string) => {
      const block = blocks.value.get(blockId)
      if (!block) {
        return
      }

      const metadata =
        props.executionQueue.getExecutionQueueMetadataForBlock(block)
      if (!metadata) {
        return
      }

      props.executionQueue.enqueueBlock(
        blockId,
        props.userId,
        environmentStartedAt,
        metadata
      )
    },
    [blocks, props.executionQueue, props.userId, environmentStartedAt]
  )

  const onRunOnwardsTab = useCallback(
    (blockId: string) => {
      const block = blocks.value.get(blockId)
      if (!block) {
        return
      }

      const metadata =
        props.executionQueue.getExecutionQueueMetadataForBlock(block)
      if (!metadata) {
        return
      }

      props.executionQueue.enqueueBlockOnwards(
        blockId,
        props.userId,
        environmentStartedAt,
        metadata
      )
    },
    [blocks, props.executionQueue, props.userId, environmentStartedAt]
  )

  const runAllTabs = useCallback(() => {
    props.executionQueue.enqueueBlockGroup(props.yDoc, props.id, props.userId)
  }, [props.executionQueue, props.yDoc, props.id])

  const runBelowBlock = useCallback(() => {
    const blockGroup = getBlockGroup(layout.value, props.id)
    if (!blockGroup) {
      return
    }

    const current = blockGroup.getAttribute('current')
    if (!current) {
      return
    }

    const currentBlockId = current.getAttribute('id')
    if (!currentBlockId) {
      return
    }

    const block = blocks.value.get(currentBlockId)
    if (!block) {
      return
    }

    const metadata =
      props.executionQueue.getExecutionQueueMetadataForBlock(block)
    if (!metadata) {
      return
    }

    props.executionQueue.enqueueBlockOnwards(
      currentBlockId,
      props.userId,
      environmentStartedAt,
      metadata
    )
  }, [
    layout,
    blocks,
    props.executionQueue,
    props.id,
    props.userId,
    environmentStartedAt,
  ])

  const popupContainerRef = useRef<HTMLDivElement>(null)

  const onDuplicateBlockGroup = useCallback(() => {
    props.onDuplicateBlockGroup(props.id)
  }, [props.id, props.onDuplicateBlockGroup])

  const onDuplicateCurrentTab = useCallback(() => {
    if (!currentBlockId) {
      return
    }

    props.onDuplicateBlock(props.id, currentBlockId)
  }, [currentBlockId, props.id, props.onDuplicateBlock])

  const onDuplicateTab = useCallback(
    (blockId: string) => {
      props.onDuplicateBlock(props.id, blockId)
    },
    [props.id, props.onDuplicateBlock]
  )

  const onRemoveBlockGroup = useCallback(() => {
    props.onRemoveBlockGroup(props.id)
  }, [props.id, props.onRemoveBlockGroup])

  const tabContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (hasMultipleTabs) {
      dragPreview(tabContainerRef.current)
    }
  }, [hasMultipleTabs, dragPreview, tabContainerRef])

  const {
    isScrollable,
    isScrolledAllTheWayLeft,
    isScrolledAllTheWayRight,
    onClickScrollLeft,
    onClickScrollRight,
  } = useScrollDetection(tabContainerRef)

  const onHideAllTabs = useCallback(() => {
    props.yDoc.transact(() => {
      const blockGroup = getBlockGroup(layout.value, props.id)
      if (!blockGroup) {
        return
      }

      const tabs = getTabsFromBlockGroup(blockGroup, blocks.value)
      tabs.forEach((tab) => {
        const isHidden = tab.isHiddenInPublished
        if (!isHidden) {
          toggleIsBlockHiddenInPublished(blockGroup, tab.blockId)
        }
      })
    })
  }, [layout, blocks, props.id])

  const hasRunnableBlocks = useMemo(() => {
    return tabRefs.some((tab) => {
      const block = blocks.value.get(tab.blockId)
      return block && isRunnableBlock(block)
    })
  }, [tabRefs, blocks])

  const [isSideBarOpen] = useSideBar()

  return (
    <div className="flex group/wrapper gap-x-1 relative">
      <div
        // this calc is here because CSS sucks
        className={clsx(
          'flex flex-col gap-y-1 absolute -translate-x-[calc(100%+4px)] h-full',
          {
            hidden: !props.isEditable || props.isApp,
          }
        )}
        ref={(d) => {
          drag(d)
        }}
      >
        <DragHandle
          hasRunnableBlocks={hasRunnableBlocks}
          hasMultipleTabs={hasMultipleTabs}
          isDragging={isDragging}
          onRunBelowBlock={runBelowBlock}
          onRunAllTabs={runAllTabs}
          onDuplicateTab={hasMultipleTabs ? onDuplicateCurrentTab : null}
          onDuplicateBlock={onDuplicateBlockGroup}
          onDeleteTab={hasMultipleTabs ? onDeleteCurrentTab : null}
          onDeleteBlock={onRemoveBlockGroup}
          targetRef={popupContainerRef}
          onHideAllTabs={onHideAllTabs}
          menuPosition={isSideBarOpen ? 'left' : 'right'}
        />
      </div>
      <div className="flex-grow max-w-full">
        {hasMultipleTabs && !props.isPDF && (
          <div className="print:hidden flex">
            <div
              className="flex max-w-full overflow-x-scroll no-scrollbar scroll-smooth"
              ref={tabContainerRef}
            >
              {isScrollable && !isScrolledAllTheWayLeft && (
                <button
                  className="sticky left-0 h-full bg-white border-t border-r border-l border-gray-200"
                  onClick={onClickScrollLeft}
                >
                  <ChevronLeftIcon className="h-5 w-5 text-gray-400" />
                </button>
              )}
              {tabRefs.map((tabRef, i) => (
                <Tab
                  key={tabRef.blockId}
                  tabRef={tabRef}
                  isFirst={i === 0}
                  onSwitchActiveTab={onSwitchActiveTab}
                  onReorderTab={onReorderTab}
                  onCheckCanReorderTab={onCheckCanReorderTab}
                  isDraggable={hasMultipleTabs && !props.isApp}
                  blocks={blocks.value}
                  executionQueue={props.executionQueue}
                  onRun={onRunTab}
                  onRunOnwards={onRunOnwardsTab}
                  onDuplicateTab={onDuplicateTab}
                  onDeleteTab={onDeleteTab}
                />
              ))}
              {isScrollable && !isScrolledAllTheWayRight && (
                <button
                  className="sticky right-0 h-full bg-white border-t border-r border-l border-gray-200"
                  onClick={onClickScrollRight}
                >
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                </button>
              )}
            </div>
            {!props.isApp && (
              <NewTabButton
                workspaceId={props.document.workspaceId}
                yDoc={props.yDoc}
                blockGroupId={props.id}
                lastBlockId={tabRefs[tabRefs.length - 1].blockId}
                dataSources={props.dataSources}
              />
            )}
          </div>
        )}
        <div
          className="relative"
          ref={(d) => {
            drop(d)
          }}
        >
          <div
            className={clsx(
              'absolute top-0 left-0 h-full w-full z-30 opacity-50 pointer-events-none',
              isOver && canDrop
                ? 'bg-ceramic-100'
                : isDragging
                ? 'opacity-50'
                : ''
            )}
          />
          {props.isPDF ? (
            <div className="flex flex-col gap-y-10">{nodes}</div>
          ) : (
            nodes
          )}
        </div>
      </div>
    </div>
  )
}

const V2EditorRow = (props: {
  index: number
  totalBlocks: number
  document: ApiDocument
  yDoc: Y.Doc
  blockId: string
  isEditable: boolean
  isApp: boolean
  onDropItem: (
    blockGroupId: string,
    blockId: string,
    targetIndex: number,
    type: Identifier | null
  ) => void
  onCheckCanDrop: (
    id: string,
    index: number,
    type: Identifier | null
  ) => boolean
  onRemoveBlock: (blockGroupId: string, id: string) => void
  onRemoveBlockGroup: (id: string) => void
  onGroup: (
    blockGroupId: string,
    blockId: string,
    targetId: string,
    type: Identifier | null
  ) => void
  onAddBlock: (type: BlockType, index: number) => void
  onAddGroupedBlock: (
    type: BlockType,
    blockGroupId: string,
    blockId: string,
    position: 'before' | 'after'
  ) => void
  awareness: Awareness
  dataSources: APIDataSources
  dataframes: Y.Map<DataFrame>
  isPublicViewer: boolean
  onDuplicateBlock: (blockGroupId: string, blockId: string) => void
  onDuplicateBlockGroup: (id: string) => void
  isPDF: boolean
  writebackEnabled: boolean
  onSchemaExplorer: (dataSourceId: string | null) => void
  insertBelow: () => void
  userId: string | null
  executionQueue: ExecutionQueue
  aiTasks: AITasks
  isFullScreen: boolean
}) => {
  const isLast = props.index === props.totalBlocks - 1
  return (
    <div>
      {props.index === 0 && (
        <Dropzone
          workspaceId={props.document.workspaceId}
          index={props.index}
          isLast={false}
          isEditable={props.isEditable && !props.isApp}
          onAddBlock={props.onAddBlock}
          onDropItem={props.onDropItem}
          onCheckCanDrop={props.onCheckCanDrop}
          writebackEnabled={props.writebackEnabled}
        />
      )}
      <DraggableTabbedBlock
        id={props.blockId}
        document={props.document}
        isEditable={props.isEditable}
        isApp={props.isApp}
        onAddGroupedBlock={props.onAddGroupedBlock}
        onRemoveBlock={props.onRemoveBlock}
        onRemoveBlockGroup={props.onRemoveBlockGroup}
        onGroup={props.onGroup}
        awareness={props.awareness}
        dataSources={props.dataSources}
        dataframes={props.dataframes}
        isPublicViewer={props.isPublicViewer}
        onDuplicateBlock={props.onDuplicateBlock}
        onDuplicateBlockGroup={props.onDuplicateBlockGroup}
        yDoc={props.yDoc}
        isPDF={props.isPDF}
        onSchemaExplorer={props.onSchemaExplorer}
        insertBelow={props.insertBelow}
        userId={props.userId}
        executionQueue={props.executionQueue}
        aiTasks={props.aiTasks}
        isFullScreen={props.isFullScreen}
      />
      <div className={clsx(isLast ? 'pt-2' : '')}>
        <Dropzone
          workspaceId={props.document.workspaceId}
          index={props.index + 1}
          isLast={isLast}
          isEditable={props.isEditable && !props.isApp}
          onAddBlock={props.onAddBlock}
          onDropItem={props.onDropItem}
          onCheckCanDrop={props.onCheckCanDrop}
          writebackEnabled={props.writebackEnabled}
        />
      </div>
    </div>
  )
}

const NO_DS_TEXT = `-- No data sources connected. Please add one using the "data sources" menu on the bottom left
-- Alternatively, you can upload files using the "Files" button on the bottom bar.`

const DEMO_DS_TEXT = `-- We have selected a demo data source. Feel free to query it for testing purposes.
-- Please add your own data source using the "data sources" menu on the bottom left.
-- Alternatively, you can upload files using the "Files" button on the bottom bar.`

interface Props {
  isPublicViewer: boolean
  document: ApiDocument
  dataSources: APIDataSources
  isDeleted: boolean
  onRestoreDocument: () => void
  isEditable: boolean
  isPDF: boolean
  isApp: boolean
  userId: string | null
  role: UserWorkspaceRole
  isFullScreen: boolean
  yDoc: Y.Doc
  provider: IProvider
  isSyncing: boolean
  onOpenFiles: () => void
  onSchemaExplorer: (dataSourceId: string | null) => void
  scrollViewRef: React.RefObject<HTMLDivElement>
  executionQueue: ExecutionQueue
  aiTasks: AITasks
}
const Editor = (props: Props) => {
  const { state: layout } = useYDocState<Y.Array<YBlockGroup>>(
    props.yDoc,
    layoutGetter
  )
  const { state: blocks } = useYDocState<Y.Map<YBlock>>(
    props.yDoc,
    blocksGetter
  )
  const { state: dataframes } = useYDocState<Y.Map<DataFrame>>(
    props.yDoc,
    dataframesGetter
  )

  const editorWrapperRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!props.isSyncing) {
      editorWrapperRef.current?.setAttribute('data-editor-ready', 'true')
    }
  }, [editorWrapperRef, props.isSyncing])

  const [newSQLDatasourceId, newSQLDatasourceIsDemo] = useMemo(() => {
    const dataSource =
      head(
        sortWith(
          [
            // put default data source first
            descend((d) => (d.config.data.isDefault ? 1 : 0)),
            // put demo data source last
            descend((d) => (d.config.data.isDemo ? 0 : 1)),
            // put newer data sources first
            descend((d) => d.config.data.createdAt),
          ],
          props.dataSources.toArray()
        )
      )?.config.data ?? null

    if (dataSource) {
      return [dataSource.id, dataSource.isDemo]
    }

    return [null, false]
  }, [props.dataSources])

  const [editorState, editorAPI] = useEditorAwareness()

  const onAddBlock = useCallback(
    (type: BlockType, index: number) => {
      return props.yDoc.transact(() => {
        let newBlockId: string | null = null
        switch (type) {
          case BlockType.SQL:
            newBlockId = addBlockGroup(
              layout.value,
              blocks.value,
              {
                type,
                dataSourceId: newSQLDatasourceId,
                isFileDataSource: false,
                source:
                  newSQLDatasourceId === null
                    ? NO_DS_TEXT
                    : newSQLDatasourceIsDemo
                    ? DEMO_DS_TEXT
                    : undefined,
              },
              index
            )
            break
          case BlockType.VisualizationV2:
          case BlockType.Visualization:
          case BlockType.PivotTable: {
            const dataframe = getClosestDataframe(props.yDoc, index)
            newBlockId = addBlockGroup(
              layout.value,
              blocks.value,
              { type, dataframeName: dataframe?.name ?? null },
              index
            )
            break
          }
          case BlockType.DashboardHeader:
            break
          default:
            newBlockId = addBlockGroup(
              layout.value,
              blocks.value,
              { type },
              index
            )
            break
        }

        if (newBlockId) {
          editorAPI.insert(newBlockId, {
            scrollIntoView: true,
          })
        }

        return newBlockId
      })
    },
    [
      props.yDoc,
      layout.value,
      blocks.value,
      props.dataSources,
      newSQLDatasourceId,
      editorAPI.insert,
    ]
  )

  const addBlockShortcut = useCallback(
    (blockType: BlockType, pos: 'above' | 'below') => {
      const nextIndex = layout.value.toArray().findIndex((bg) => {
        const tabs = getTabsFromBlockGroup(bg, blocks.value)
        return tabs.some((t) => t.blockId === editorState.cursorBlockId)
      })

      if (nextIndex === -1) {
        return
      }

      onAddBlock(blockType, pos === 'above' ? nextIndex : nextIndex + 1)
    },
    [layout.value, blocks.value, editorState.cursorBlockId, onAddBlock]
  )

  const insertBelow = useCallback(() => {
    if (!editorState.cursorBlockId) {
      return
    }

    const blockType = blocks.value
      .get(editorState.cursorBlockId)
      ?.getAttribute('type')
    if (!blockType) {
      return
    }

    addBlockShortcut(blockType, 'below')
  }, [editorState.cursorBlockId, blocks.value, addBlockShortcut])

  const focusCursorBlock = useCallback(() => {
    if (editorState.cursorBlockId) {
      editorAPI.insert(editorState.cursorBlockId, { scrollIntoView: true })
    }
  }, [editorState.cursorBlockId, editorAPI.insert])

  const [removeBlockDialog, setRemoveBlockDialog] =
    useState<RemoveBlockDashboardConflictResult | null>(null)
  const onRemoveBlock = useCallback(
    (blockGroupId: string, blockId: string) => {
      const result = removeBlock(props.yDoc, blockGroupId, blockId, false)
      if (result._tag !== 'success') {
        setRemoveBlockDialog(result)
      }
    },
    [props.yDoc, blocks, setRemoveBlockDialog]
  )

  const [removeBlockGroupDialog, setRemoveBlockGroupDialog] =
    useState<RemoveBlockGroupResult | null>(null)
  const onRemoveBlockGroup = useCallback(
    (blockId: string) => {
      const result = removeBlockGroup(props.yDoc, blockId, false)
      if (result._tag !== 'success') {
        setRemoveBlockGroupDialog(result)
      }
    },
    [props.yDoc, blocks, setRemoveBlockGroupDialog]
  )

  const deleteBlockShortcut = useCallback(() => {
    if (!editorState.cursorBlockId) {
      return
    }

    const blockGroupId = layout.value
      .toArray()
      .find((bg) => {
        const tabs = getTabsFromBlockGroup(bg, blocks.value)
        return tabs.some((t) => t.blockId === editorState.cursorBlockId)
      }, null)
      ?.getAttribute('id')

    if (!blockGroupId) {
      return
    }

    const nextCursorBlockId = getNextBlockIdAfterDelete(
      layout.value,
      blocks.value,
      editorState.cursorBlockId
    )

    // If block has one tab, remove whole block group
    if (
      getTabsFromBlockGroupId(layout.value, blocks.value, blockGroupId).length >
      1
    ) {
      onRemoveBlock(blockGroupId, editorState.cursorBlockId)

      if (nextCursorBlockId) {
        switchActiveTab(layout.value, blockGroupId, nextCursorBlockId)
      }
    } else {
      onRemoveBlockGroup(blockGroupId)
    }

    if (nextCursorBlockId) {
      editorAPI.focus(nextCursorBlockId, { scrollIntoView: true })
    }
  }, [
    layout,
    blocks,
    editorState,
    onRemoveBlock,
    onRemoveBlockGroup,
    editorAPI.focus,
  ])

  useHotkeys({
    moveCursor: editorAPI.move,
    addBlock: addBlockShortcut,
    deleteBlock: deleteBlockShortcut,
    focusCursorBlock,
  })

  const onAddGroupedBlock = useCallback(
    (
      type: BlockType,
      blockGroupId: string,
      blockId: string,
      position: 'before' | 'after'
    ) => {
      props.yDoc.transact(() => {
        switch (type) {
          case BlockType.SQL:
            addGroupedBlock(
              layout.value,
              blocks.value,
              blockGroupId,
              blockId,
              {
                type,
                dataSourceId: newSQLDatasourceId,
                isFileDataSource: false,
              },
              position
            )
            break
          case BlockType.VisualizationV2:
          case BlockType.Visualization:
          case BlockType.PivotTable: {
            const blockPos = getBlockFlatPosition(
              blockId,
              layout.value,
              blocks.value
            )
            const dataframe = getClosestDataframe(
              props.yDoc,
              Math.max(position === 'before' ? blockPos - 1 : blockPos + 1, 0)
            )

            addGroupedBlock(
              layout.value,
              blocks.value,
              blockGroupId,
              blockId,
              { type, dataframeName: dataframe?.name ?? null },
              position
            )
            break
          }
          case BlockType.DashboardHeader:
            break
          default:
            addGroupedBlock(
              layout.value,
              blocks.value,
              blockGroupId,
              blockId,
              { type },
              position
            )
            break
        }
      })
    },
    [props.yDoc, layout, blocks, props.dataSources, newSQLDatasourceId]
  )

  const onDropItem = useCallback(
    (
      blockGroupId: string,
      blockId: string,
      targetIndex: number,
      type: Identifier | null
    ) => {
      props.yDoc.transact(() => {
        if (type === ElementType.BlockGroup) {
          updateOrder(layout.value, blockGroupId, targetIndex)
        } else if (type === ElementType.Block) {
          ungroupTab(layout.value, blockGroupId, blockId, targetIndex)
        }
      })
    },
    [props.yDoc, layout]
  )

  const onGroup = useCallback(
    (
      blockGroupId: string,
      blockId: string,
      targetId: string,
      type: Identifier | null
    ) => {
      props.yDoc.transact(() => {
        if (type === ElementType.Block) {
          groupBlocks(layout.value, blockGroupId, blockId, targetId)
        } else if (type === ElementType.BlockGroup) {
          groupBlockGroups(layout.value, blockGroupId, targetId)
        }
      })
    },
    [props.yDoc, layout]
  )

  const onCheckCanDrop = useCallback(
    (blockGroupId: string, index: number, type: Identifier | null) => {
      if (type === ElementType.Block) {
        return checkCanDropBlock(layout.value, blockGroupId, index)
      } else if (type === ElementType.BlockGroup) {
        return checkCanDropBlockGroup(layout.value, blockGroupId, index)
      }
      return false
    },
    [layout]
  )

  const onDuplicateBlockGroup = useCallback(
    (blockGroupId: string) => {
      props.yDoc.transact(() => {
        duplicateBlockGroup(layout.value, blocks.value, blockGroupId, true)
      })
    },
    [layout, blocks]
  )

  const onDuplicateBlock = useCallback(
    (blockGroupId: string, blockId: string) => {
      props.yDoc.transact(() => {
        duplicateTab(layout.value, blocks.value, blockGroupId, blockId, true)
      })
    },
    [layout, blocks]
  )

  const hasWriteback = useMemo(
    () =>
      props.dataSources.some(
        (ds) => ds.config.type === 'psql' || ds.config.type === 'bigquery'
      ),
    [props.dataSources]
  )

  const domBlocks = useMemo(() => {
    return layout.value.toArray().map((blockGroup, i) => {
      const blockId = blockGroup.getAttribute('id')
      const tabs = getTabsFromBlockGroup(blockGroup, blocks.value).filter((t) =>
        props.isApp ? !t.isHiddenInPublished : true
      )
      if (!blockId || tabs.length === 0) {
        if (i === 0) {
          return <div key={i} className="h-10" />
        }

        return null
      }

      return (
        <V2EditorRow
          yDoc={props.yDoc}
          document={props.document}
          key={i}
          blockId={blockId}
          index={i}
          totalBlocks={layout.value.length}
          isEditable={props.isEditable}
          isApp={props.isApp}
          onAddBlock={onAddBlock}
          onAddGroupedBlock={onAddGroupedBlock}
          onDropItem={onDropItem}
          onCheckCanDrop={onCheckCanDrop}
          onRemoveBlockGroup={onRemoveBlockGroup}
          onRemoveBlock={onRemoveBlock}
          onGroup={onGroup}
          awareness={props.provider.awareness}
          dataSources={props.dataSources}
          dataframes={dataframes.value}
          isPublicViewer={props.isPublicViewer}
          onDuplicateBlock={onDuplicateBlock}
          onDuplicateBlockGroup={onDuplicateBlockGroup}
          isPDF={props.isPDF}
          writebackEnabled={true}
          onSchemaExplorer={props.onSchemaExplorer}
          insertBelow={insertBelow}
          userId={props.userId}
          executionQueue={props.executionQueue}
          aiTasks={props.aiTasks}
          isFullScreen={props.isFullScreen}
        />
      )
    })
  }, [
    props.document,
    props.yDoc,
    layout,
    dataframes,
    onDropItem,
    onCheckCanDrop,
    onRemoveBlockGroup,
    onRemoveBlock,
    onGroup,
    onAddBlock,
    props.isEditable,
    props.isPDF,
    props.isApp,
    props.onSchemaExplorer,
    props.userId,
  ])

  const addBlockToBottom = useCallback(
    (type: BlockType) => {
      onAddBlock(type, layout.value.length)
    },
    [onAddBlock, layout]
  )

  const lastUpdatedAt = useLastUpdatedAt(props.yDoc)

  return (
    <div className="editor-v2 flex flex-col flex-grow justify-center font-primary subpixel-antialiased h-full w-full">
      {props.isDeleted && (
        <div className="bg-yellow-50 py-6 border-b border-yellow-200">
          <div className="flex justify-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm leading-5 text-yellow-700">
                This document is deleted.{' '}
                <button
                  className="hover:underline text-primary-600 hover:text-primary-800 font-medium"
                  onClick={props.onRestoreDocument}
                >
                  Restore.
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        id="editor-scrollview"
        ref={props.scrollViewRef}
        className={clsx(
          'flex h-full justify-center',
          props.isFullScreen ? 'px-20' : 'sm:px-0 px-4',
          {
            'overflow-y-auto overflow-x-hidden': !props.isPDF,
          }
        )}
      >
        <div
          id="editor-wrapper"
          ref={editorWrapperRef}
          className={clsx(
            'flex-grow h-full py-2',
            props.isFullScreen ? 'w-full' : widthClasses
          )}
        >
          <div className={!props.isPDF ? 'pt-12' : ''}>
            <Title
              content={props.yDoc.getXmlFragment('title')}
              isLoading={props.isSyncing}
              isEditable={
                props.isEditable && !props.isApp && props.role !== 'viewer'
              }
              isPDF={props.isPDF}
            />
          </div>

          <ContentSkeleton visible={props.isSyncing} />

          <HotkeysProvider initiallyActiveScopes={['editor']}>
            {!props.isSyncing && (
              <>
                {domBlocks}

                {domBlocks.length === 0 && (
                  <div className="w-full">
                    <PlusButton
                      workspaceId={props.document.workspaceId}
                      isLast
                      alwaysOpen
                      onAddBlock={addBlockToBottom}
                      isEditable={props.isEditable}
                      writebackEnabled={hasWriteback}
                    />
                  </div>
                )}
              </>
            )}
          </HotkeysProvider>

          {!props.isPDF && <div className="pb-72" />}
        </div>
      </div>
      {!props.isPublicViewer && !props.isPDF && (
        <EnvBar
          onOpenFiles={props.onOpenFiles}
          publishedAt={props.isApp ? props.document.publishedAt : null}
          lastUpdatedAt={lastUpdatedAt}
          isViewer={props.role === 'viewer'}
        />
      )}
      <RemoveBlockDashboardConflictDialog
        yDoc={props.yDoc}
        state={
          removeBlockGroupDialog?._tag === 'dashboard-conflict'
            ? removeBlockGroupDialog
            : null
        }
        onClose={() => setRemoveBlockGroupDialog(null)}
      />
      <RemoveTabDashboardConflictDialog
        yDoc={props.yDoc}
        state={
          removeBlockDialog?._tag === 'dashboard-conflict'
            ? removeBlockDialog
            : null
        }
        onClose={() => setRemoveBlockDialog(null)}
      />
    </div>
  )
}

interface TabRefProps {
  blocks: Y.Map<YBlock>
  tab: TabRefT
  isEditable: boolean
  hasMultipleTabs: boolean
  layout: Y.Array<YBlockGroup>
  isPublicViewer: boolean
  document: ApiDocument
  dataSources: APIDataSources
  onToggleIsBlockHiddenInPublished: (blockId: string) => void
  onSchemaExplorer: (dataSourceId: string | null) => void
  insertBelow: () => void
  isPDF: boolean
  addGroupedBlock: (
    blockId: string,
    blockType: BlockType,
    position: 'before' | 'after'
  ) => void
  dataframes: Y.Map<DataFrame>
  isApp: boolean
  onFileUploadBlockPythonUsage: (
    block: Y.XmlElement<FileUploadBlock>,
    filename: string,
    type: string
  ) => void
  onFileUploadBlockQueryUsage: (
    block: Y.XmlElement<FileUploadBlock>,
    filename: string
  ) => void
  currentBlockId: string | undefined
  dragPreview: ConnectDragPreview | null
  userId: string | null
  executionQueue: ExecutionQueue
  aiTasks: AITasks
  isFullScreen: boolean
}
function TabRef(props: TabRefProps) {
  const [editorState] = useEditorAwareness()

  const block = props.blocks.get(props.tab.blockId)
  if (!block) {
    return <div>Block not found</div>
  }
  const isCursorWithin = editorState.cursorBlockId === props.tab.blockId
  const isCursorInserting = editorState.mode === 'insert'

  const jsx = switchBlockType(block, {
    onRichText: (block) => (
      <RichTextBlock
        block={block}
        isEditable={props.isEditable}
        belongsToMultiTabGroup={props.hasMultipleTabs}
        dragPreview={props.hasMultipleTabs ? null : props.dragPreview}
        dashboardMode={null}
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
      />
    ),
    onSQL: (block) => (
      <SQLBlock
        block={block}
        layout={props.layout}
        blocks={props.blocks}
        isPublicMode={props.isPublicViewer}
        isEditable={props.isEditable}
        document={props.document}
        dataSources={props.dataSources}
        dragPreview={props.hasMultipleTabs ? null : props.dragPreview}
        dashboardMode={null}
        hasMultipleTabs={props.hasMultipleTabs}
        isBlockHiddenInPublished={props.tab.isHiddenInPublished}
        onToggleIsBlockHiddenInPublished={
          props.onToggleIsBlockHiddenInPublished
        }
        onSchemaExplorer={props.onSchemaExplorer}
        insertBelow={props.insertBelow}
        userId={props.userId}
        executionQueue={props.executionQueue}
        aiTasks={props.aiTasks}
        isFullScreen={props.isFullScreen}
      />
    ),
    onPython: (block) => (
      <PythonBlock
        isPublicMode={props.isPublicViewer}
        block={block}
        blocks={props.blocks}
        isEditable={props.isEditable}
        document={props.document}
        dragPreview={props.hasMultipleTabs ? null : props.dragPreview}
        isPDF={props.isPDF}
        dashboardMode={null}
        hasMultipleTabs={props.hasMultipleTabs}
        isBlockHiddenInPublished={props.tab.isHiddenInPublished}
        onToggleIsBlockHiddenInPublished={
          props.onToggleIsBlockHiddenInPublished
        }
        insertBelow={props.insertBelow}
        userId={props.userId}
        executionQueue={props.executionQueue}
        aiTasks={props.aiTasks}
        isFullScreen={props.isFullScreen}
      />
    ),
    onVisualization: (block) => (
      <VisualizationBlock
        isPublicMode={props.isPublicViewer}
        isEditable={props.isEditable}
        document={props.document}
        onAddGroupedBlock={props.addGroupedBlock}
        block={block}
        blocks={props.blocks}
        dataframes={props.dataframes}
        dragPreview={props.hasMultipleTabs ? null : props.dragPreview}
        isDashboard={false}
        hasMultipleTabs={props.hasMultipleTabs}
        isBlockHiddenInPublished={props.tab.isHiddenInPublished}
        onToggleIsBlockHiddenInPublished={
          props.onToggleIsBlockHiddenInPublished
        }
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
        userId={props.userId}
        executionQueue={props.executionQueue}
        isFullScreen={props.isFullScreen}
      />
    ),
    onVisualizationV2: (block) => (
      <VisualizationV2Block
        isPublicMode={props.isPublicViewer}
        isEditable={props.isEditable}
        document={props.document}
        onAddGroupedBlock={props.addGroupedBlock}
        block={block}
        blocks={props.blocks}
        dataframes={props.dataframes}
        dragPreview={props.hasMultipleTabs ? null : props.dragPreview}
        dashboardMode={null}
        hasMultipleTabs={props.hasMultipleTabs}
        isBlockHiddenInPublished={props.tab.isHiddenInPublished}
        onToggleIsBlockHiddenInPublished={
          props.onToggleIsBlockHiddenInPublished
        }
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
        userId={props.userId}
        executionQueue={props.executionQueue}
        isFullScreen={props.isFullScreen}
      />
    ),
    onInput: (block) => (
      <InputBlock
        block={block}
        blocks={props.blocks}
        dragPreview={props.dragPreview}
        belongsToMultiTabGroup={props.hasMultipleTabs}
        isEditable={props.isEditable}
        isApp={props.isApp}
        dashboardMode={null}
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
        userId={props.userId}
        workspaceId={props.document.workspaceId}
        executionQueue={props.executionQueue}
      />
    ),
    onDropdownInput: (block) => (
      <DropdownInputBlock
        block={block}
        blocks={props.blocks}
        dragPreview={props.dragPreview}
        belongsToMultiTabGroup={props.hasMultipleTabs}
        isEditable={props.isEditable}
        isApp={props.isApp}
        dataframes={props.dataframes}
        dashboardMode={null}
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
        userId={props.userId}
        workspaceId={props.document.workspaceId}
        executionQueue={props.executionQueue}
      />
    ),
    onDateInput: (block) => (
      <DateInputBlock
        block={block}
        blocks={props.blocks}
        dragPreview={props.dragPreview}
        belongsToMultiTabGroup={props.hasMultipleTabs}
        isEditable={props.isEditable}
        isApp={props.isApp}
        dashboardMode={null}
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
        userId={props.userId}
        workspaceId={props.document.workspaceId}
        executionQueue={props.executionQueue}
      />
    ),
    onFileUpload: (block) => (
      <FileUploadBlock
        block={block}
        workspaceId={props.document.workspaceId}
        documentId={props.document.id}
        isEditable={props.isEditable}
        isPublicViewer={props.isPublicViewer}
        dragPreview={props.dragPreview}
        hasMultipleTabs={props.hasMultipleTabs}
        onPythonUsage={(filename, type) =>
          props.onFileUploadBlockPythonUsage(block, filename, type)
        }
        onQueryUsage={(filename) =>
          props.onFileUploadBlockQueryUsage(block, filename)
        }
        isBlockHiddenInPublished={props.tab.isHiddenInPublished}
        onToggleIsBlockHiddenInPublished={
          props.onToggleIsBlockHiddenInPublished
        }
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
      />
    ),
    onDashboardHeader: () => null,
    onWriteback: (block) => (
      <WritebackBlock
        workspaceId={props.document.workspaceId}
        block={block}
        hasMultipleTabs={props.hasMultipleTabs}
        isEditable={props.isEditable}
        dragPreview={props.dragPreview}
        dataSources={props.dataSources}
        dataframes={props.dataframes}
        isBlockHiddenInPublished={props.tab.isHiddenInPublished}
        onToggleIsBlockHiddenInPublished={
          props.onToggleIsBlockHiddenInPublished
        }
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
        userId={props.userId}
        executionQueue={props.executionQueue}
        isFullScreen={props.isFullScreen}
      />
    ),
    onPivotTable: (block) => (
      <PivotTableBlock
        workspaceId={props.document.workspaceId}
        block={block}
        blocks={props.blocks}
        hasMultipleTabs={props.hasMultipleTabs}
        isEditable={props.isEditable}
        onAddGroupedBlock={props.addGroupedBlock}
        dragPreview={props.dragPreview}
        dataframes={props.dataframes}
        isBlockHiddenInPublished={props.tab.isHiddenInPublished}
        onToggleIsBlockHiddenInPublished={
          props.onToggleIsBlockHiddenInPublished
        }
        dashboardMode={null}
        isCursorWithin={isCursorWithin}
        isCursorInserting={isCursorInserting}
        userId={props.userId}
        executionQueue={props.executionQueue}
        isFullScreen={props.isFullScreen}
      />
    ),
  })

  return (
    <div
      key={props.tab.blockId}
      className={
        props.tab.blockId === props.currentBlockId || props.isPDF
          ? ''
          : 'h-0 overflow-hidden'
      }
    >
      {jsx}
    </div>
  )
}

export default function V2Editor(
  props: Omit<Props, 'scrollViewRef'> & { children?: ReactNode }
) {
  const scrollViewRef = useRef<HTMLDivElement>(null)
  return (
    <EditorAwarenessProvider scrollViewRef={scrollViewRef} yDoc={props.yDoc}>
      <SQLExtensionProvider workspaceId={props.document.workspaceId}>
        <Editor {...props} scrollViewRef={scrollViewRef} />
        {props.children}
      </SQLExtensionProvider>
    </EditorAwarenessProvider>
  )
}
