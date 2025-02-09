import * as Y from 'yjs'
import {
  AITasks,
  BlockType,
  ExecutionQueue,
  YBlock,
  getBlocks,
  getDataframes,
  getLayout,
  switchBlockType,
} from '@briefer/editor'
import { useCallback, useEffect, useState } from 'react'
import GridLayout from 'react-grid-layout'
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import RichTextBlock from '../v2Editor/customBlocks/richText'
import SQLBlock from '../v2Editor/customBlocks/sql'
import { useYDocState } from '@/hooks/useYDoc'
import { ApiDocument } from '@briefer/database'
import VisualizationBlock from '../v2Editor/customBlocks/visualization'
import PythonBlock from '../v2Editor/customBlocks/python'
import InputBlock from '../v2Editor/customBlocks/input'
import DropdownInputBlock from '../v2Editor/customBlocks/dropdownInput'
import { APIDataSources } from '@/hooks/useDatasources'
import ScrollBar from '../ScrollBar'
import clsx from 'clsx'
import DashboardHeader from '../v2Editor/customBlocks/dashboardHeader'
import DateInputBlock from '../v2Editor/customBlocks/dateInput'
import PivotTableBlock from '../v2Editor/customBlocks/pivotTable'
import VisualizationV2Block from '../v2Editor/customBlocks/visualizationV2'

interface Props {
  item: GridLayout.Layout
  block: YBlock | null
  onDelete: (id: string) => void
  yDoc: Y.Doc
  document: ApiDocument
  dataSources: APIDataSources
  isEditingDashboard: boolean
  latestBlockId: string | null
  userId: string | null
  executionQueue: ExecutionQueue
  aiTasks: AITasks
}

const NO_TITLE_BLOCKS = [
  BlockType.Input,
  BlockType.DropdownInput,
  BlockType.FileUpload,
  BlockType.RichText,
]

function GridElement(props: Props) {
  const { state: layout } = useYDocState(props.yDoc, getLayout)
  const { state: blocks } = useYDocState(props.yDoc, getBlocks)
  const { state: dataframes } = useYDocState(props.yDoc, getDataframes)
  const { state: yLayout } = useYDocState(props.yDoc, getLayout)

  // set editing when adding a new block to the dashboard
  useEffect(() => {
    if (props.latestBlockId === props.block?.getAttribute('id')) {
      setIsEditingBlock(true)
    }
  }, [props.latestBlockId, props.block?.getAttribute('id')])

  const [isEditingBlock, setIsEditingBlock] = useState(false)

  const renderItem = useCallback(
    (block: YBlock, item: GridLayout.Layout) =>
      switchBlockType(block, {
        onRichText: (block) => (
          <RichTextBlock
            block={block}
            belongsToMultiTabGroup={false}
            isEditable={false}
            dragPreview={null}
            isDashboard={true}
            isCursorWithin={false}
            isCursorInserting={false}
          />
        ),
        onSQL: (block) => (
          <SQLBlock
            block={block}
            layout={yLayout.value}
            blocks={blocks.value}
            document={props.document}
            dataSources={props.dataSources}
            isEditable={false}
            dragPreview={null}
            isPublicMode={false}
            dashboardMode={props.isEditingDashboard ? 'editing' : 'live'}
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
        ),
        onPython: (block) => (
          <PythonBlock
            key={`${item.i}-${item.w}-${item.h}`}
            document={props.document}
            block={block}
            blocks={blocks.value}
            isEditable={false}
            dragPreview={null}
            isPDF={false}
            dashboardPlace="view"
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
          <VisualizationBlock
            document={props.document}
            dataframes={dataframes.value}
            block={block}
            blocks={blocks.value}
            dragPreview={null}
            isEditable={false}
            onAddGroupedBlock={() => {}}
            isDashboard={true}
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
        ),
        onVisualizationV2: (block) => (
          <VisualizationV2Block
            document={props.document}
            dataframes={dataframes.value}
            block={block}
            blocks={blocks.value}
            dragPreview={null}
            isEditable={false}
            onAddGroupedBlock={() => {}}
            isDashboard={true}
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
        ),
        onPivotTable: (block) => (
          <PivotTableBlock
            workspaceId={props.document.workspaceId}
            dataframes={dataframes.value}
            block={block}
            blocks={blocks.value}
            dragPreview={null}
            isEditable={false}
            onAddGroupedBlock={() => {}}
            dashboardMode={props.isEditingDashboard ? 'editing' : 'live'}
            hasMultipleTabs={false}
            isBlockHiddenInPublished={false}
            onToggleIsBlockHiddenInPublished={() => {}}
            isCursorWithin={false}
            isCursorInserting={false}
            userId={props.userId}
            executionQueue={props.executionQueue}
            isFullScreen={true}
          />
        ),
        onInput: (block) => (
          <InputBlock
            block={block}
            blocks={blocks.value}
            dragPreview={null}
            belongsToMultiTabGroup={false}
            isEditable={!props.isEditingDashboard}
            isApp={true}
            isDashboard={true}
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
            blocks={blocks.value}
            dragPreview={null}
            belongsToMultiTabGroup={false}
            isEditable={!props.isEditingDashboard}
            isApp={true}
            dataframes={dataframes.value}
            isDashboard={true}
            isCursorWithin={false}
            isCursorInserting={false}
            userId={props.userId}
            workspaceId={props.document.workspaceId}
            executionQueue={props.executionQueue}
          />
        ),
        onDateInput: (block) => (
          <DateInputBlock
            block={block}
            blocks={blocks.value}
            dragPreview={null}
            belongsToMultiTabGroup={false}
            isEditable={!props.isEditingDashboard}
            isApp={true}
            isDashboard={true}
            isCursorWithin={false}
            isCursorInserting={false}
            userId={props.userId}
            workspaceId={props.document.workspaceId}
            executionQueue={props.executionQueue}
          />
        ),
        onDashboardHeader: (block) => (
          <DashboardHeader
            block={block}
            isEditing={isEditingBlock}
            onFinishedEditing={() => setIsEditingBlock(false)}
            dashboardMode={props.isEditingDashboard ? 'editing' : 'live'}
          />
        ),
        onFileUpload: () => null,
        onWriteback: () => null,
      }),
    [
      props.document,
      props.dataSources,
      dataframes,
      blocks,
      yLayout,
      props.isEditingDashboard,
      isEditingBlock,
      props.userId,
      props.executionQueue,
    ]
  )

  const onDelete = useCallback(() => {
    props.onDelete(props.item.i)
  }, [props.onDelete, props.item.i])

  const blockType = props.block?.getAttribute('type')
  const hasTitle = blockType && !NO_TITLE_BLOCKS.includes(blockType)
  const titleContent = props.block?.getAttribute('title') || 'Untitled'

  const canEdit = blockType && blockType === BlockType.DashboardHeader
  const showEdit = canEdit && !isEditingBlock

  return (
    <div
      className={clsx(
        'relative group h-full',
        props.isEditingDashboard && 'cursor-move'
      )}
    >
      {props.block ? (
        <div
          className={clsx(
            'w-full h-full rounded-md overflow-hidden flex flex-col',
            props.isEditingDashboard && 'pointer-events-none'
          )}
        >
          {hasTitle && (
            <h2 className="text-gray-700 font-medium text-left text-sm truncate min-h-6 px-3.5 py-2.5">
              {titleContent}
            </h2>
          )}

          <div className="h-full overflow-hidden">
            {renderItem(props.block, props.item)}
          </div>
        </div>
      ) : (
        <div className="bg-gray-200 overflow-hidden">{props.item.i}</div>
      )}

      {props.isEditingDashboard && (
        <>
          <div
            className={clsx(
              'absolute -top-3 right-3 bg-white opacity-0 group-hover:opacity-100 z-20 border p-1 rounded-md shadow-sm flex gap-x-2 items-center',
              showEdit ? 'px-2' : ''
            )}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {showEdit && (
              <button
                className="flex items-center jutify-center cursor-pointer text-gray-500 hover:text-primary-600 h-4 w-4 text-xs"
                onClick={() => setIsEditingBlock(!isEditingBlock)}
              >
                <PencilIcon />
              </button>
            )}

            <button
              className="flex items-center jutify-center cursor-pointer text-gray-500 hover:text-red-600 h-4 w-4 text-xs"
              onClick={onDelete}
            >
              <TrashIcon />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default GridElement
