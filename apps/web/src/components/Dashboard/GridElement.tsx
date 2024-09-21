import * as Y from 'yjs'
import {
  BlockType,
  DateInputBlock as DateInputBlockT,
  YBlock,
  getBlocks,
  getDataframes,
  getLayout,
  requestDateInputRun,
  requestRun,
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
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'

interface Props {
  item: GridLayout.Layout
  block: YBlock | null
  onDelete: (id: string) => void
  yDoc: Y.Doc
  document: ApiDocument
  dataSources: APIDataSources
  isEditingDashboard: boolean
  latestBlockId: string | null
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
  const { startedAt: environmentStartedAt } = useEnvironmentStatus(
    props.document.workspaceId
  )

  // set editing when adding a new block to the dashboard
  useEffect(() => {
    if (props.latestBlockId === props.block?.getAttribute('id')) {
      setIsEditingBlock(true)
    }
  }, [props.latestBlockId, props.block?.getAttribute('id')])

  const [isEditingBlock, setIsEditingBlock] = useState(false)

  const onRun = useCallback(
    <B extends YBlock>(block: B, customCallback?: (block: B) => void) => {
      requestRun(
        block,
        blocks.value,
        layout.value,
        environmentStartedAt,
        false,
        customCallback
      )
    },
    [blocks.value, layout.value, environmentStartedAt]
  )

  const onSaveDateInput = useCallback(
    (block: Y.XmlElement<DateInputBlockT>) => {
      requestDateInputRun(block, blocks.value)
    },
    [blocks.value]
  )

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
            onRun={() => {}}
            onTry={() => {}}
            isPublicMode={false}
            dashboardMode={props.isEditingDashboard ? 'editing' : 'live'}
            hasMultipleTabs={false}
            isBlockHiddenInPublished={false}
            onToggleIsBlockHiddenInPublished={() => {}}
            onSchemaExplorer={() => {}}
            insertBelow={() => {}}
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
            onRun={() => {}}
            onTry={() => {}}
            isPDF={false}
            dashboardPlace="view"
            isPublicMode={false}
            hasMultipleTabs={false}
            isBlockHiddenInPublished={false}
            onToggleIsBlockHiddenInPublished={() => {}}
          />
        ),
        onVisualization: (block) => (
          <VisualizationBlock
            document={props.document}
            dataframes={dataframes.value}
            block={block}
            dragPreview={null}
            isEditable={false}
            onAddGroupedBlock={() => {}}
            onRun={() => {}}
            isDashboard={true}
            isPublicMode={false}
            hasMultipleTabs={false}
            isBlockHiddenInPublished={false}
            onToggleIsBlockHiddenInPublished={() => {}}
            isCursorWithin={false}
            isCursorInserting={false}
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
            onRun={onRun}
            dashboardMode={props.isEditingDashboard ? 'editing' : 'live'}
            hasMultipleTabs={false}
            isBlockHiddenInPublished={false}
            onToggleIsBlockHiddenInPublished={() => {}}
            isCursorWithin={false}
            isCursorInserting={false}
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
            onRun={() => {}}
            isDashboard={true}
            isCursorWithin={false}
            isCursorInserting={false}
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
            onRun={() => {}}
            dataframes={dataframes.value}
            isDashboard={true}
            isCursorWithin={false}
            isCursorInserting={false}
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
            onRun={onSaveDateInput}
            isDashboard={true}
            isCursorWithin={false}
            isCursorInserting={false}
          />
        ),
        onDashboardHeader: (block) => (
          <DashboardHeader
            block={block}
            isEditing={isEditingBlock}
            onFinishedEditing={() => setIsEditingBlock(false)}
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
      onRun,
      onSaveDateInput,
    ]
  )

  const onDelete = useCallback(() => {
    props.onDelete(props.item.i)
  }, [props.onDelete, props.item.i])

  const blockType = props.block?.getAttribute('type')
  const hasTitle = blockType && !NO_TITLE_BLOCKS.includes(blockType)
  const titleContent = props.block?.getAttribute('title')

  const canEdit = blockType && blockType === BlockType.DashboardHeader
  const showEdit = canEdit && !isEditingBlock

  return (
    <div className="relative group h-full">
      {props.block ? (
        <ScrollBar
          className="w-full h-full rounded-md overflow-hidden flex flex-col"
          disabled={
            props.block.getAttribute('type') === BlockType.Visualization
          }
        >
          {hasTitle && titleContent && (
            <h2 className="text-gray-700 font-medium text-left text-sm truncate min-h-6 px-3.5 py-2.5">
              {titleContent}
            </h2>
          )}

          <div className="h-full overflow-hidden">
            {renderItem(props.block, props.item)}
          </div>
        </ScrollBar>
      ) : (
        <div className="bg-gray-200 overflow-hidden">{props.item.i}</div>
      )}

      {props.isEditingDashboard && (
        <>
          <div className="absolute top-0 right-0 bottom-2 left-0 z-10 bg-white opacity-0 hover:cursor-grab" />
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
