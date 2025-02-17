import * as Y from 'yjs'
import {
  Bars3CenterLeftIcon,
  ChartPieIcon,
  CircleStackIcon,
  CommandLineIcon,
  PencilSquareIcon,
  TableCellsIcon,
} from '@heroicons/react/24/solid'
import {
  AITasks,
  BlockType,
  ExecutionQueue,
  YBlock,
  YBlockGroup,
  addDashboardItemToYDashboard,
  addDashboardOnlyBlock,
  getBaseAttributes,
  getBlocks,
  getDashboard,
  getDashboardItem,
  getDataframes,
  getLayout,
  getPythonBlockResult,
  getSQLAttributes,
  switchBlockType,
} from '@briefer/editor'
import { useCallback, useMemo, useRef, useState } from 'react'
import PythonBlock from '../v2Editor/customBlocks/python'
import { ApiDocument } from '@briefer/database'
import SQLBlock from '../v2Editor/customBlocks/sql'
import VisualizationBlock from '../v2Editor/customBlocks/visualization'
import { DataFrame, exhaustiveCheck } from '@briefer/types'
import { useYDocState } from '@/hooks/useYDoc'
import RichTextBlock from '../v2Editor/customBlocks/richText'
import InputBlock from '../v2Editor/customBlocks/input'
import DropdownInputBlock from '../v2Editor/customBlocks/dropdownInput'
import DateInputBlock from '../v2Editor/customBlocks/dateInput'
import {
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { DraggingBlock } from '.'
import { APIDataSources } from '@/hooks/useDatasources'
import ScaleChild from '../ScaleChild'
import { Heading1Icon } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { getDefaults } from './DashboardView'
import PivotTableBlock from '../v2Editor/customBlocks/pivotTable'
import VisualizationV2Block from '../v2Editor/customBlocks/visualizationV2'
import MultiSelect from '../MultiSelect'
import clsx from 'clsx'
import SimpleBar from 'simplebar-react'

function getTypeLabel(t: BlockType) {
  switch (t) {
    case BlockType.VisualizationV2:
    case BlockType.Visualization:
      return 'Visualization'
    case BlockType.Python:
      return 'Python output'
    case BlockType.SQL:
      return 'Query results'
    case BlockType.PivotTable:
      return 'Pivot table'
    case BlockType.Input:
    case BlockType.DateInput:
    case BlockType.DropdownInput:
      return 'Input'
    case BlockType.RichText:
      return 'Rich Text'
    case BlockType.FileUpload:
      return 'File Upload'
    case BlockType.DashboardHeader:
      return 'Dashboard Header'
    case BlockType.Writeback:
      return 'Writeback'
  }
}

function getTypeIcon(t: BlockType): JSX.Element {
  switch (t) {
    case BlockType.VisualizationV2:
    case BlockType.Visualization:
      return <ChartPieIcon className="w-4 h-4 text-gray-500" />
    case BlockType.Python:
      return <CommandLineIcon className="w-4 h-4 text-gray-500" />
    case BlockType.SQL:
      return <CircleStackIcon className="w-4 h-4 text-gray-500" />
    case BlockType.PivotTable:
      return <TableCellsIcon className="w-4 h-4 text-gray-500" />
    case BlockType.Input:
    case BlockType.DateInput:
    case BlockType.DropdownInput:
      return <PencilSquareIcon className="w-4 h-4 text-gray-500" />
    case BlockType.RichText:
      return <Bars3CenterLeftIcon className="w-4 h-4 text-gray-500" />
    case BlockType.FileUpload:
    case BlockType.DashboardHeader:
    case BlockType.Writeback:
      return <></>
  }
}

const typeOptions = [
  BlockType.VisualizationV2,
  BlockType.Python,
  BlockType.SQL,
  BlockType.PivotTable,
  BlockType.Input,
]

interface Props {
  document: ApiDocument
  dataSources: APIDataSources
  yDoc: Y.Doc
  onDragStart: (draggingBlock: DraggingBlock) => void
  onAddBlock: (blockId: string) => void
  userId: string | null
  executionQueue: ExecutionQueue
  aiTasks: AITasks
  onToggleSchemaExplorer: (dataSourceId?: string | null) => void
  onExpand: (block: YBlock) => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}
function DashboardControls(props: Props) {
  const { state: dataframes } = useYDocState(props.yDoc, getDataframes)
  const { state: blocks } = useYDocState(props.yDoc, getBlocks)
  const { state: layout } = useYDocState(props.yDoc, getLayout)
  const { state: dashboard } = useYDocState(props.yDoc, getDashboard)
  const [search, setSearch] = useState('')
  const [types, setTypes] = useState<BlockType[]>([])
  const onToggleType = useCallback((t: BlockType) => {
    setTypes((types) => {
      if (types.includes(t)) {
        return types.filter((type) => type !== t)
      }

      return [...types, t]
    })
  }, [])

  const blocksInDashboard = useMemo(
    () =>
      new Set(
        Array.from(dashboard.value.values()).map((i) =>
          i.getAttribute('blockId')
        )
      ),
    [dashboard]
  )

  const addHeading = useCallback(() => {
    const blockId = addDashboardOnlyBlock(blocks.value, {
      type: BlockType.DashboardHeader,
      content: '',
    })

    const lastRow = Array.from(dashboard.value.values()).reduce<number>(
      (last, yItem) => {
        const itemId = yItem.getAttribute('id')
        if (!itemId) {
          return last
        }

        const item = getDashboardItem(dashboard.value, itemId)
        return Math.max(last, item?.y ?? 0)
      },
      0
    )

    addDashboardItemToYDashboard(dashboard.value, {
      id: uuidv4(),
      blockId,
      x: 0,
      y: lastRow + 1,
      w: 24,
      h: 1,
      ...getDefaults(BlockType.DashboardHeader),
    })

    props.onAddBlock(blockId)
  }, [blocks, dashboard, props.onAddBlock])

  const blocksList = useMemo(
    () =>
      layout.value
        .map((blockGroup) => {
          const groupBlocks =
            blockGroup.getAttribute('tabs')?.map((tab) => {
              const id = tab.getAttribute('id')
              if (!id || blocksInDashboard.has(id)) {
                return null
              }

              const block = blocks.value.get(id)
              if (!block) {
                return null
              }

              return switchBlockType(block, {
                onRichText: (_) => block,
                onSQL: (sBlock) => {
                  const { result } = getSQLAttributes(sBlock, blocks.value)
                  if (!result) {
                    return null
                  }

                  return block
                },
                onPython: (pBlock) => {
                  const results = getPythonBlockResult(pBlock)
                  if (results.length === 0) {
                    return null
                  }

                  return block
                },
                onVisualization: (_) => block,
                onVisualizationV2: (_) => block,
                onInput: (_) => block,
                onDropdownInput: (_) => block,
                onDateInput: (_) => block,
                onPivotTable: (block) => block,
                onFileUpload: (_) => null,
                onDashboardHeader: (_) => null,
                onWriteback: (_) => null,
              })
            }) ?? []

          return groupBlocks.filter((block): block is YBlock => {
            if (block === null) {
              return false
            }

            const attrs = getBaseAttributes(block)
            if (types.length > 0) {
              switch (attrs.type) {
                case BlockType.Visualization:
                case BlockType.VisualizationV2:
                  if (!types.includes(BlockType.Visualization)) {
                    return false
                  }
                  break
                case BlockType.Python:
                  if (!types.includes(BlockType.Python)) {
                    return false
                  }
                  break
                case BlockType.SQL:
                  if (!types.includes(BlockType.SQL)) {
                    return false
                  }
                  break
                case BlockType.Input:
                case BlockType.DateInput:
                case BlockType.DropdownInput:
                  if (!types.includes(BlockType.Input)) {
                    return false
                  }
                  break
                case BlockType.PivotTable:
                  if (!types.includes(BlockType.PivotTable)) {
                    return false
                  }
                  break
                case BlockType.RichText:
                case BlockType.Writeback:
                case BlockType.FileUpload:
                case BlockType.DashboardHeader:
                  // these do not show up in the list in the first place
                  break
                default:
                  exhaustiveCheck(attrs.type)
              }
            }

            const s = search.trim()
            if (s === '') {
              return true
            }

            const title = attrs.title.trim()
            return title.toLowerCase().includes(s.toLowerCase())
          })
        })
        .flat(),
    [blocks, layout, blocksInDashboard, search, types]
  )

  if (!props.isOpen) {
    return (
      <div className="pt-3 fixed right-0">
        <button
          onClick={props.onOpen}
          className="bg-white flex items-center rounded-l-sm px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 border border-r-0 border-gray-200 group max-w-11 hover:max-w-32 overflow-hidden transition-mw group duration-500"
        >
          <ChevronDoubleLeftIcon className="min-w-3 min-h-3" />
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap">
            Show Blocks
          </span>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="relative w-[400px] font-sans h-full">
        <button
          className="absolute z-10 top-12 transform rounded-full border border-gray-300 text-gray-400 bg-white hover:bg-ceramic-200 hover:border-ceramic-200 hover:text-ceramic-400 w-6 h-6 flex justify-center items-center left-0 -translate-x-1/2"
          onClick={props.onClose}
        >
          <ChevronDoubleRightIcon className="w-3 h-3" />
        </button>

        <div className="bg-white border-l border-gray-200 overflow-y-auto relative h-full flex flex-col justify-between">
          <div className="bg-gray-50 border-b border-gray-200 py-6 px-4 shadow-sm">
            <h2 className="font-syne text-lg font-medium text-gray-900 pb-4">
              Blocks
            </h2>
            <div className="flex flex-col space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Find block by title"
                  className="block w-full rounded-md border-0 pl-7 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-ceramic-200/70 text-xs h-[38px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <MagnifyingGlassIcon className="absolute top-1 left-2 w-4 h-4 text-gray-400 translate-y-1/2" />
              </div>
              <MultiSelect<BlockType>
                value={types}
                getLabel={getTypeLabel}
                getIcon={getTypeIcon}
                placeholder="Filter by type"
                options={typeOptions}
                onToggle={onToggleType}
              />
            </div>
          </div>
          <SimpleBar className="px-3 h-full overflow-y-auto no-scroll">
            <BlocksList
              document={props.document}
              list={blocksList}
              dataSources={props.dataSources}
              dataframes={dataframes.value}
              blocks={blocks.value}
              layout={layout.value}
              onDragStart={props.onDragStart}
              userId={props.userId}
              executionQueue={props.executionQueue}
              aiTasks={props.aiTasks}
              onExpand={props.onExpand}
            />
          </SimpleBar>
          <div className="bg-gray-50 p-4 border-t border-gray-200">
            <button
              className="flex items-center rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 border border-gray-200 disabled:cursor-not-allowed disabled:opacity-50 gap-x-2 w-full bg-white shadow-sm justify-center"
              onClick={addHeading}
            >
              <Heading1Icon strokeWidth={1} className="w-4 h-4" />
              <span>Add heading</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

interface BlocksListProps {
  document: ApiDocument
  dataSources: APIDataSources
  dataframes: Y.Map<DataFrame>
  list: YBlock[]
  blocks: Y.Map<YBlock>
  layout: Y.Array<YBlockGroup>
  onDragStart: (draggingBlock: DraggingBlock) => void
  userId: string | null
  executionQueue: ExecutionQueue
  aiTasks: AITasks
  onExpand: (block: YBlock) => void
}
function BlocksList(props: BlocksListProps) {
  return props.list.map((block, i) => {
    const { id } = getBaseAttributes(block)
    return (
      <BlockListItem
        className={clsx('mt-6', i === props.list.length - 1 && 'mb-6')}
        key={id}
        document={props.document}
        dataSources={props.dataSources}
        dataframes={props.dataframes}
        block={block}
        blocks={props.blocks}
        layout={props.layout}
        onDragStart={props.onDragStart}
        userId={props.userId}
        executionQueue={props.executionQueue}
        aiTasks={props.aiTasks}
        onExpand={props.onExpand}
      />
    )
  })
}

interface BlockListItemProps {
  document: ApiDocument
  dataSources: APIDataSources
  dataframes: Y.Map<DataFrame>
  block: YBlock
  blocks: Y.Map<YBlock>
  layout: Y.Array<YBlockGroup>
  onDragStart: (draggingBlock: DraggingBlock) => void
  userId: string | null
  executionQueue: ExecutionQueue
  aiTasks: AITasks
  onExpand: (block: YBlock) => void
  className?: string
}
function BlockListItem(props: BlockListItemProps) {
  const { id, type } = getBaseAttributes(props.block)
  const blockRef = useRef<HTMLDivElement>(null)

  const onDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.dataTransfer.setData('text/plain', id)

      const width = blockRef.current?.offsetWidth ?? 0
      const height = blockRef.current?.offsetHeight ?? 0
      props.onDragStart({ id, type, width, height })

      const dragImage = document.createElement('div')
      dragImage.className = 'shadow-md bg-white rounded-md overflow-hidden'
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      dragImage.style.left = '-1000px'
      dragImage.style.width = `${width}px`
      dragImage.style.height = `${height}px`
      dragImage.style.zIndex = '9999'
      dragImage.style.pointerEvents = 'none'
      dragImage.innerHTML = blockRef.current?.innerHTML ?? ''
      document.body.appendChild(dragImage)

      event.dataTransfer.setDragImage(dragImage, 0, 0)
      setTimeout(() => {
        document.body.removeChild(dragImage)
      }, 0)
    },
    [id, type, props.onDragStart, blockRef.current]
  )

  const jsx = useMemo(
    () =>
      switchBlockType(props.block, {
        onRichText: (block) => (
          <RichTextBlock
            block={block}
            belongsToMultiTabGroup={false}
            isEditable={false}
            dragPreview={null}
            dashboardMode={{ _tag: 'editing', position: 'sidebar' }}
            isCursorWithin={false}
            isCursorInserting={false}
          />
        ),
        onSQL: (block) => (
          <div className="w-full h-64">
            <SQLBlock
              block={block}
              blocks={props.blocks}
              layout={props.layout}
              document={props.document}
              dataSources={props.dataSources}
              isEditable={false}
              dragPreview={null}
              dashboardMode={{ _tag: 'editing', position: 'sidebar' }}
              isPublicMode={false}
              hasMultipleTabs={false}
              isBlockHiddenInPublished={false}
              onToggleIsBlockHiddenInPublished={() => {}}
              onSchemaExplorer={() => {}}
              insertBelow={() => {}}
              userId={props.userId}
              executionQueue={props.executionQueue}
              aiTasks={props.aiTasks}
              isFullScreen={true}
            />
          </div>
        ),
        onPython: (block) => (
          <PythonBlock
            document={props.document}
            block={block}
            blocks={props.blocks}
            isEditable={false}
            dragPreview={null}
            isPDF={false}
            dashboardMode={{ _tag: 'editing', position: 'sidebar' }}
            isPublicMode={false}
            hasMultipleTabs={false}
            isBlockHiddenInPublished={false}
            onToggleIsBlockHiddenInPublished={() => {}}
            userId={props.userId}
            executionQueue={props.executionQueue}
            aiTasks={props.aiTasks}
            isFullScreen={true}
          />
        ),
        onVisualization: (block) => (
          <div className="w-full h-96">
            <VisualizationBlock
              document={props.document}
              dataframes={props.dataframes}
              block={block}
              blocks={props.blocks}
              dragPreview={null}
              isEditable={false}
              onAddGroupedBlock={() => {}}
              isDashboard={true}
              renderer="svg"
              isPublicMode={false}
              hasMultipleTabs={false}
              isBlockHiddenInPublished={false}
              onToggleIsBlockHiddenInPublished={() => {}}
              isCursorWithin={false}
              isCursorInserting={false}
              userId={props.userId}
              executionQueue={props.executionQueue}
              isFullScreen={true}
            />
          </div>
        ),
        onVisualizationV2: (block) => (
          <div className="w-full h-96">
            <VisualizationV2Block
              document={props.document}
              dataframes={props.dataframes}
              block={block}
              blocks={props.blocks}
              dragPreview={null}
              isEditable={false}
              onAddGroupedBlock={() => {}}
              dashboardMode={{ _tag: 'editing', position: 'sidebar' }}
              isPublicMode={false}
              hasMultipleTabs={false}
              isBlockHiddenInPublished={false}
              onToggleIsBlockHiddenInPublished={() => {}}
              isCursorWithin={false}
              isCursorInserting={false}
              userId={props.userId}
              executionQueue={props.executionQueue}
              isFullScreen={true}
            />
          </div>
        ),
        onInput: (block) => (
          <InputBlock
            block={block}
            blocks={props.blocks}
            dragPreview={null}
            belongsToMultiTabGroup={false}
            isEditable={false}
            isApp={true}
            dashboardMode={{ _tag: 'editing', position: 'sidebar' }}
            isCursorWithin={false}
            isCursorInserting={false}
            userId={props.userId}
            workspaceId={props.document.workspaceId}
            executionQueue={props.executionQueue}
          />
        ),
        onDropdownInput: (block) => (
          <DropdownInputBlock
            block={block}
            blocks={props.blocks}
            dragPreview={null}
            belongsToMultiTabGroup={false}
            isEditable={false}
            isApp={true}
            dashboardMode={{ _tag: 'editing', position: 'sidebar' }}
            dataframes={props.dataframes}
            isCursorWithin={false}
            isCursorInserting={false}
            userId={props.userId}
            workspaceId={props.document.workspaceId}
            executionQueue={props.executionQueue}
          />
        ),
        onFileUpload: () => null,
        onDateInput: (block) => (
          <DateInputBlock
            block={block}
            blocks={props.blocks}
            workspaceId={props.document.workspaceId}
            dragPreview={null}
            belongsToMultiTabGroup={false}
            isEditable={false}
            isApp={true}
            dashboardMode={{ _tag: 'editing', position: 'sidebar' }}
            isCursorWithin={false}
            isCursorInserting={false}
            userId={props.userId}
            executionQueue={props.executionQueue}
          />
        ),
        onPivotTable: (block) => (
          <div className="w-full h-96">
            <PivotTableBlock
              workspaceId={props.document.workspaceId}
              dataframes={props.dataframes}
              block={block}
              blocks={props.blocks}
              dragPreview={null}
              isEditable={false}
              onAddGroupedBlock={() => {}}
              dashboardMode={{ _tag: 'editing', position: 'sidebar' }}
              hasMultipleTabs={false}
              isBlockHiddenInPublished={false}
              onToggleIsBlockHiddenInPublished={() => {}}
              isCursorWithin={false}
              isCursorInserting={false}
              userId={props.userId}
              executionQueue={props.executionQueue}
              isFullScreen={true}
            />
          </div>
        ),
        onDashboardHeader: () => null,
        onWriteback: () => null,
      }),
    [
      props.block,
      props.blocks,
      props.layout,
      props.dataSources,
      props.dataframes,
      props.document,
    ]
  )

  const blockTitle = props.block.getAttribute('title')

  const onPointerUp = useCallback(() => {
    switch (type) {
      case BlockType.Visualization:
      case BlockType.VisualizationV2:
      case BlockType.SQL:
      case BlockType.Input:
      case BlockType.DropdownInput:
      case BlockType.DateInput:
      case BlockType.PivotTable:
      case BlockType.Python:
      case BlockType.RichText:
      case BlockType.Writeback:
        props.onExpand(props.block)
        break
      case BlockType.FileUpload:
      case BlockType.DashboardHeader:
        return
      default:
        exhaustiveCheck(type)
    }
  }, [props.onExpand, props.block, type])

  return (
    <div
      key={id}
      className={clsx(
        'border border-gray-300 hover:border-ceramic-200 rounded-md bg-white relative p-2 overflow-x-hidden',
        props.className
      )}
      draggable={true}
      onDragStart={onDragStart}
      unselectable="on"
      onPointerUp={onPointerUp}
    >
      <div className="flex flex-col gap-y-6">
        <span className="text-gray-400 text-md font-medium">
          {blockTitle || 'Untitled'}
        </span>
        <ScaleChild
          width={768}
          disableScale={
            props.block.getAttribute('type') === BlockType.Visualization
          }
        >
          <div className="overflow-hidden" ref={blockRef}>
            {jsx}
          </div>
        </ScaleChild>
      </div>

      {/* add a transparent div to prevent any interaction with the block */}
      <div className="absolute top-0 bottom-0 left-0 right-0 z-10 group hover:bg-ceramic-100/50 hover:cursor-grab">
        <div className="flex items-center justify-center text-center text-ceramic-600 w-full h-full text-md invisible group-hover:visible font-medium">
          drag to dashboard or click to expand
        </div>
      </div>
    </div>
  )
}

export default DashboardControls
