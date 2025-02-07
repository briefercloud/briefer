import * as Y from 'yjs'
import { Menu, Transition } from '@headlessui/react'
import clsx from 'clsx'
import { PlusIcon } from '@heroicons/react/20/solid'
import {
  BlockType,
  YBlock,
  YBlockGroup,
  addGroupedBlock,
  getBlockFlatPosition,
  getBlocks,
  getClosestDataframe,
  getLayout,
} from '@briefer/editor'
import { useCallback, useMemo, useRef } from 'react'
import {
  ChartBarIcon,
  CodeBracketIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import { APIDataSources } from '@/hooks/useDatasources'
import useDropdownPosition from '@/hooks/dropdownPosition'
import { createPortal } from 'react-dom'
import { Table2Icon } from 'lucide-react'
import { FeatureFlags } from '@briefer/types'
import useFeatureFlags from '@/hooks/useFeatureFlags'

type Item = {
  name: string
  type: BlockType
  description: string
  icon: JSX.Element
}
const items = (ff: FeatureFlags): Item[] => [
  {
    name: 'SQL',
    type: BlockType.SQL,
    description: 'Write a query against a data source',
    icon: <TableCellsIcon width={18} height={18} />,
  },
  {
    name: 'Python',
    type: BlockType.Python,
    description: 'Run Python code',
    icon: <CodeBracketIcon width={18} height={18} />,
  },
  {
    name: 'Visualization',
    type: ff.visualizationsV2
      ? BlockType.VisualizationV2
      : BlockType.Visualization,
    description: 'Add a graph to your page',
    icon: <ChartBarIcon width={18} height={18} />,
  },
  {
    name: 'Pivot',
    type: BlockType.PivotTable,
    description: 'Add a pivot table to your page',
    icon: <Table2Icon width={18} height={18} />,
  },
]

interface NewBlockMenuItemProps {
  item: Item
  onAdd: (item: Item) => void
}
function NewBlockMenuItem(props: NewBlockMenuItemProps) {
  const onAdd = useCallback(() => {
    props.onAdd(props.item)
  }, [props])

  return (
    <Menu.Item>
      {({ active }) => (
        <button
          className={clsx(
            active ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-700',
            'flex items-center gap-x-4 w-full px-4 py-1 leading-4 rounded-md'
          )}
          onClick={onAdd}
        >
          {props.item.icon}
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium text-gray-500">
              {props.item.name}
            </span>
            <span className="text-xs text-gray-400">
              {props.item.description}
            </span>
          </div>
        </button>
      )}
    </Menu.Item>
  )
}

interface Props {
  workspaceId: string
  yDoc: Y.Doc
  blockGroupId: string
  lastBlockId: string
  dataSources: APIDataSources
}
function NewTabButton(props: Props) {
  const ff = useFeatureFlags(props.workspaceId)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const { onOpen, dropdownPosition, containerRef } = useDropdownPosition(
    buttonRef,
    'bottom'
  )

  const onAdd = useCallback(
    (item: Item) => {
      const layout = getLayout(props.yDoc)
      const blocks = getBlocks(props.yDoc)

      switch (item.type) {
        case BlockType.SQL:
          addGroupedBlock(
            layout,
            blocks,
            props.blockGroupId,
            props.lastBlockId,
            {
              type: item.type,
              dataSourceId: props.dataSources.get(0)?.config.data.id ?? null,
              isFileDataSource: false,
            },
            'after'
          )
          break
        case BlockType.Visualization:
        case BlockType.VisualizationV2:
        case BlockType.PivotTable: {
          const flatPosition = getBlockFlatPosition(
            props.lastBlockId,
            layout,
            blocks
          )
          const dataframe = getClosestDataframe(props.yDoc, flatPosition)
          addGroupedBlock(
            layout,
            blocks,
            props.blockGroupId,
            props.lastBlockId,
            { type: item.type, dataframeName: dataframe?.name ?? null },
            'after'
          )
          break
        }
        case BlockType.DashboardHeader:
          break
        default:
          addGroupedBlock(
            layout,
            blocks,
            props.blockGroupId,
            props.lastBlockId,
            { type: item.type },
            'after'
          )
          break
      }
    },
    [props.yDoc, props.blockGroupId, props.lastBlockId, ff]
  )

  const menuItems = useMemo(() => items(ff), [ff])

  return (
    <Menu as="div" className="relative">
      <Menu.Button
        ref={buttonRef}
        onClick={onOpen}
        className="cursor-pointer text-xs px-1.5 rounded-t-sm flex items-center text-gray-400 hover:text-gray-600 h-full"
      >
        <PlusIcon className="w-3 h-3" />
      </Menu.Button>
      {createPortal(
        <Transition
          as="div"
          className="absolute mt-1 right-0 z-30 w-72 xl:w-86 "
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          style={{
            top: dropdownPosition.top,
            right: dropdownPosition.right,
          }}
        >
          <Menu.Items
            as="div"
            className="rounded-md bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none font-sans py-1.5 px-1.5 flex flex-col gap-y-2"
            ref={containerRef}
          >
            {menuItems.map((item) => (
              <NewBlockMenuItem key={item.type} item={item} onAdd={onAdd} />
            ))}
          </Menu.Items>
        </Transition>,
        document.body
      )}
    </Menu>
  )
}

export default NewTabButton
