import * as Y from 'yjs'
import {
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
import { DataFrame } from '@briefer/types'
import { useYDocState } from '@/hooks/useYDoc'
import RichTextBlock from '../v2Editor/customBlocks/richText'
import InputBlock from '../v2Editor/customBlocks/input'
import DropdownInputBlock from '../v2Editor/customBlocks/dropdownInput'
import DateInputBlock from '../v2Editor/customBlocks/dateInput'
import {
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
} from '@heroicons/react/24/outline'
import { DraggingBlock } from '.'
import { APIDataSources } from '@/hooks/useDatasources'
import ScaleChild from '../ScaleChild'
import ScrollBar from '../ScrollBar'
import { Heading1Icon } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { getDefaults } from './DashboardView'
import PivotTableBlock from '../v2Editor/customBlocks/pivotTable'

interface Props {
  document: ApiDocument
  dataSources: APIDataSources
  yDoc: Y.Doc
  onDragStart: (draggingBlock: DraggingBlock) => void
  onAddBlock: (blockId: string) => void
  userId: string | null
  executionQueue: ExecutionQueue
}
function DashboardControls(props: Props) {
  const { state: dataframes } = useYDocState(props.yDoc, getDataframes)
  const { state: blocks } = useYDocState(props.yDoc, getBlocks)
  const { state: layout } = useYDocState(props.yDoc, getLayout)
  const { state: dashboard } = useYDocState(props.yDoc, getDashboard)

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
                onInput: (_) => block,
                onDropdownInput: (_) => block,
                onDateInput: (_) => block,
                onPivotTable: (block) => block,
                onFileUpload: (_) => null,
                onDashboardHeader: (_) => null,
                onWriteback: (_) => null,
              })
            }) ?? []

          return groupBlocks.filter((block): block is YBlock => block !== null)
        })
        .flat(),
    [blocks, layout, blocksInDashboard]
  )

  const [open, setOpen] = useState(true)
  const onOpen = useCallback(() => {
    setOpen(true)
  }, [])

  const onClose = useCallback(() => {
    setOpen(false)
  }, [])

  if (!open) {
    return (
      <div className="pt-3 fixed right-0">
        <button
          onClick={onOpen}
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
    <div className="absolute 2xl:relative top-0 bottom-0 right-0 w-[400px] font-sans">
      <button
        className="absolute z-10 top-12 transform rounded-full border border-gray-300 text-gray-400 bg-white hover:bg-ceramic-200 hover:border-ceramic-200 hover:text-ceramic-400 w-6 h-6 flex justify-center items-center left-0 -translate-x-1/2"
        onClick={onClose}
      >
        <ChevronDoubleRightIcon className="w-3 h-3" />
      </button>

      <div className="bg-white border-l border-gray-200 overflow-y-auto relative h-full pt-6 pb-20 px-4 flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-syne text-lg font-medium text-gray-900">
            Blocks
          </h2>
          <button
            className="flex items-center rounded-sm px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 border border-gray-200 disabled:cursor-not-allowed disabled:opacity-50 gap-x-2"
            onClick={addHeading}
          >
            <Heading1Icon strokeWidth={1} className="w-4 h-4" />
            <span>Add heading</span>
          </button>
        </div>
        <ScrollBar className="overflow-auto">
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
          />
        </ScrollBar>
      </div>
    </div>
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
}
function BlocksList(props: BlocksListProps) {
  return (
    <div className="flex flex-col space-y-3">
      {props.list.map((block) => {
        const { id } = getBaseAttributes(block)
        return (
          <BlockListItem
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
          />
        )
      })}
    </div>
  )
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
            isDashboard={false}
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
              onTry={() => {}}
              dashboardMode="editing"
              isPublicMode={false}
              hasMultipleTabs={false}
              isBlockHiddenInPublished={false}
              onToggleIsBlockHiddenInPublished={() => {}}
              onSchemaExplorer={() => {}}
              insertBelow={() => {}}
              userId={props.userId}
              executionQueue={props.executionQueue}
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
            onTry={() => {}}
            isPDF={false}
            dashboardPlace="controls"
            isPublicMode={false}
            hasMultipleTabs={false}
            isBlockHiddenInPublished={false}
            onToggleIsBlockHiddenInPublished={() => {}}
            userId={props.userId}
            executionQueue={props.executionQueue}
          />
        ),
        onVisualization: (block) => (
          <div className="w-full h-96">
            <VisualizationBlock
              document={props.document}
              dataframes={props.dataframes}
              block={block}
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
            onRun={() => {}}
            isDashboard={true}
            isCursorWithin={false}
            isCursorInserting={false}
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
            isDashboard={true}
            onRun={() => {}}
            dataframes={props.dataframes}
            isCursorWithin={false}
            isCursorInserting={false}
          />
        ),
        onFileUpload: () => null,
        onDateInput: (block) => (
          <DateInputBlock
            block={block}
            blocks={props.blocks}
            dragPreview={null}
            belongsToMultiTabGroup={false}
            isEditable={false}
            isApp={true}
            isDashboard={true}
            onRun={() => {}}
            isCursorWithin={false}
            isCursorInserting={false}
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
              onRun={() => {}}
              dashboardMode="editing"
              hasMultipleTabs={false}
              isBlockHiddenInPublished={false}
              onToggleIsBlockHiddenInPublished={() => {}}
              isCursorWithin={false}
              isCursorInserting={false}
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

  return (
    <div
      key={id}
      className="border border-gray-200 hover:border-ceramic-200 rounded-md bg-white relative p-2 overflow-x-hidden"
      draggable={true}
      onDragStart={onDragStart}
      unselectable="on"
    >
      <div className="flex flex-col gap-y-3">
        <span className="text-gray-400 text-xs font-medium">
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
      <div className="absolute top-0 bottom-0 left-0 right-0 z-10 hover:bg-ceramic-100 hover:opacity-50 hover:cursor-grab" />
    </div>
  )
}

export default DashboardControls
