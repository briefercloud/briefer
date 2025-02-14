import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { range, sortWith, ascend } from 'ramda'
import * as Y from 'yjs'
import { v4 as uuidv4 } from 'uuid'
import { SizeMe } from 'react-sizeme'
import GridLayout from 'react-grid-layout'
import { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import { ApiDocument } from '@briefer/database'
import { useYDocState } from '@/hooks/useYDoc'
import {
  getBlocks,
  getDashboard,
  yDashboardToGridLayout,
  getDashboardItem,
  addDashboardItemToYDashboard,
  mergeGridLayoutIntoYDashboard,
  BlockType,
  removeDashboardBlock,
  ExecutionQueue,
  AITasks,
  YBlock,
} from '@briefer/editor'
import GridElement from './GridElement'
import Title from '../v2Editor/Title'
import { DraggingBlock } from '.'
import { APIDataSources } from '@/hooks/useDatasources'
import SimpleBar from 'simplebar-react'

export const MARGIN = 6
export const COLS_COUNT = 24

const BREAKPOINTS = {
  lg: 800,
  sm: 0,
}

// When editing, the breakpoints should be the same
// to avoid repositioning of the blocks when showing/hiding
// the sidebar
const BREAKPOINT_EDIT_COLS: Record<keyof typeof BREAKPOINTS, number> = {
  lg: 24,
  sm: 24,
}

const BREAKPOINT_COLS: Record<keyof typeof BREAKPOINTS, number> = {
  lg: 24,
  sm: 1,
}

function generateBackground(
  cellWidth: number,
  cellHeight: number,
  gridWidth: number
): string {
  const rects = range(0, COLS_COUNT).map((i) => {
    const x = i * (cellWidth + MARGIN) + MARGIN
    return `<rect stroke="#f2f1f3" stroke-width="2" fill="none" x="${x}" y="${MARGIN}" width="${cellWidth}" height="${cellHeight}" />`
  })

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg"  width="${gridWidth}" height="${
      cellHeight + MARGIN
    }">`,
    ...rects,
    `</svg>`,
  ].join('')

  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

export function getMins(t: BlockType): { minW: number; minH: number } {
  switch (t) {
    case BlockType.SQL:
      return { minW: 5, minH: 3 }
    case BlockType.Visualization:
    case BlockType.VisualizationV2:
    case BlockType.PivotTable:
      return { minW: 3, minH: 3 }
    case BlockType.Python:
    case BlockType.Input:
    case BlockType.DropdownInput:
    case BlockType.DateInput:
      return { minW: 3, minH: 2 }
    case BlockType.RichText:
      return { minW: 2, minH: 2 }
    case BlockType.DashboardHeader:
      return { minW: 2, minH: 1 }
    case BlockType.Writeback:
    case BlockType.FileUpload:
      return { minW: 0, minH: 0 }
  }
}

export function getDefaults(t: BlockType): { minW: number; minH: number } {
  switch (t) {
    case BlockType.SQL:
    case BlockType.Visualization:
    case BlockType.VisualizationV2:
    case BlockType.PivotTable:
    case BlockType.Python:
      return { minW: 8, minH: 4 }
    case BlockType.Input:
    case BlockType.DropdownInput:
    case BlockType.DateInput:
      return { minW: 3, minH: 2 }
    case BlockType.RichText:
      return { minW: 2, minH: 2 }
    case BlockType.DashboardHeader:
      return { minW: 4, minH: 1 }
    case BlockType.FileUpload:
    case BlockType.Writeback:
      return { minW: 0, minH: 0 }
  }
}

interface InnerProps {
  width: number
  yDoc: Y.Doc
  dataSources: APIDataSources
  document: ApiDocument
  draggingBlock: DraggingBlock | null
  userId: string | null
  isEditing: boolean
  executionQueue: ExecutionQueue
  aiTasks: AITasks
  onExpand: (block: YBlock) => void

  // We use this to trigger actions when a new block is added
  latestBlockId: string | null
}

const WhiteCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-md h-full shadow-md">{children}</div>
)

const TransparentCard = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-sm h-[calc(100%-4px)] outline outline-4 outline-offset-0 bg-dashboard-gray outline-dashboard-gray">
    {children}
  </div>
)

function DashboardViewInner(props: InnerProps) {
  const { state: blocks } = useYDocState(props.yDoc, getBlocks)
  const { state: dashboard } = useYDocState(props.yDoc, getDashboard)

  const layout = useMemo(
    () =>
      sortWith(
        [ascend((item) => item.y), ascend((item) => item.x)],
        yDashboardToGridLayout(dashboard.value)
      ),
    [dashboard]
  )

  const onLayoutChange = useCallback(
    (_layout: GridLayout.Layout[], allLayouts: GridLayout.Layouts) => {
      mergeGridLayoutIntoYDashboard(dashboard.value, allLayouts.lg)
    },
    [dashboard]
  )

  const onDelete = useCallback(
    (id: string) => {
      dashboard.value.delete(id)
      const blockId = getDashboardItem(dashboard.value, id)?.blockId
      if (!blockId) {
        return
      }

      removeDashboardBlock(blocks.value, blockId)
    },
    [dashboard, blocks]
  )

  const children = useMemo(
    () =>
      layout.map((item) => {
        const dashItem = getDashboardItem(dashboard.value, item.i)

        const block = dashItem
          ? blocks.value.get(dashItem.blockId) ?? null
          : null

        const type = block?.getAttribute('type')

        const hasTransparentCard = type
          ? [
              BlockType.Input,
              BlockType.DropdownInput,
              BlockType.DateInput,
              BlockType.DashboardHeader,
            ].includes(type)
          : false

        const WrapperCard = hasTransparentCard ? TransparentCard : WhiteCard

        return (
          <div key={item.i}>
            <WrapperCard>
              <GridElement
                block={block}
                onDelete={onDelete}
                yDoc={props.yDoc}
                document={props.document}
                dataSources={props.dataSources}
                item={item}
                isEditingDashboard={props.isEditing}
                latestBlockId={props.latestBlockId}
                userId={props.userId}
                executionQueue={props.executionQueue}
                aiTasks={props.aiTasks}
                onExpand={props.onExpand}
              />
            </WrapperCard>
          </div>
        )
      }),
    [
      dashboard,
      blocks,
      onDelete,
      props.yDoc,
      props.document,
      props.dataSources,
      props.isEditing,
      layout,
      props.userId,
      props.executionQueue,
    ]
  )

  const [colsCount, setColsCount] = useState(BREAKPOINT_COLS.lg)
  const onBreakpointChange = useCallback(
    (_newBreakpoint: string, newCols: number) => {
      setColsCount(newCols)
    },
    []
  )

  const { cellWidth, cellHeight } = useMemo(() => {
    const marginWidth = MARGIN * (colsCount + 1)
    const cellWidth = (props.width - marginWidth) / colsCount
    const cellHeight = Math.max(50, cellWidth)

    return { cellWidth, cellHeight }
  }, [props.width, colsCount])

  const onDrop = useCallback(
    (_layout: GridLayout.Layout[], item: GridLayout.Layout, e: DragEvent) => {
      const blockId = e.dataTransfer?.getData('text/plain')
      if (!blockId) {
        return
      }

      const id = uuidv4()
      addDashboardItemToYDashboard(dashboard.value, {
        id,
        blockId,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        ...(props.draggingBlock ? getMins(props.draggingBlock.type) : {}),
      })
    },
    [dashboard, props.draggingBlock]
  )

  const style = useMemo(
    () => ({
      minHeight: 1280,
      background: generateBackground(cellWidth, cellHeight, props.width),
    }),
    [cellWidth, props.width]
  )

  const onDropDragOver = useCallback(
    (_e: GridLayout.DragOverEvent) => {
      const size = { w: 8, h: 6 }

      if (props.draggingBlock) {
        const mins = getDefaults(props.draggingBlock.type)
        size.w = Math.max(
          Math.ceil(props.draggingBlock.width / cellWidth),
          mins.minW
        )
        size.h = Math.max(
          Math.ceil(props.draggingBlock.height / cellHeight),
          mins.minH
        )
      }

      return size
    },
    [cellWidth, props.draggingBlock]
  )

  return (
    <GridLayout.Responsive
      rowHeight={cellHeight}
      width={props.width}
      layouts={{ lg: layout }}
      margin={[MARGIN, MARGIN]}
      onLayoutChange={onLayoutChange}
      breakpoints={BREAKPOINTS}
      cols={props.isEditing ? BREAKPOINT_EDIT_COLS : BREAKPOINT_COLS}
      onBreakpointChange={onBreakpointChange}
      isDraggable={props.isEditing}
      isDroppable={props.isEditing}
      isResizable={props.isEditing}
      resizeHandles={['sw', 'se']}
      onDrop={onDrop}
      onDropDragOver={onDropDragOver}
      style={props.isEditing ? style : {}}
    >
      {children}
    </GridLayout.Responsive>
  )
}

interface Props {
  className?: string
  yDoc: Y.Doc
  dataSources: APIDataSources
  document: ApiDocument
  draggingBlock: DraggingBlock | null
  isEditing: boolean
  latestBlockId: string | null
  userRole: string
  userId: string | null
  executionQueue: ExecutionQueue
  aiTasks: AITasks
  onExpand: (block: YBlock) => void
}
export default function DashboardView(props: Props) {
  return (
    <SimpleBar
      id="dashboard-wrapper"
      data-dashboard-ready="true"
      className={clsx('px-8 py-6 font-sans', props.className)}
    >
      <div className="pb-8 px-1">
        <Title
          style="font-weight: bold; font-size: 2.5rem;"
          content={props.yDoc.getXmlFragment('title')}
          isLoading={false}
          isEditable={props.isEditing && props.userRole !== 'viewer'}
          isPDF={false}
        />
      </div>
      <SizeMe monitorWidth>
        {({ size }) => {
          if (!size.width) {
            return <div />
          }

          return <DashboardViewInner {...props} width={size.width} />
        }}
      </SizeMe>
    </SimpleBar>
  )
}
