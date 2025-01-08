import {
  Bars3CenterLeftIcon,
  ChartBarIcon,
  CircleStackIcon,
  CodeBracketIcon,
  PencilSquareIcon,
  PlusIcon,
  ChevronDownIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useCallback, useEffect, useRef } from 'react'
import { useState } from 'react'
import { BlockType } from '@briefer/editor'
import { CalendarIcon, QueueListIcon } from '@heroicons/react/24/solid'
import { Menu, Transition } from '@headlessui/react'
import { Table2Icon } from 'lucide-react'

const useClickOutside = (
  ref: React.RefObject<HTMLDivElement>,
  callback: () => void
) => {
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback()
      }
    },
    [ref, callback]
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [handleClickOutside])
}

interface Props {
  alwaysOpen: boolean
  onAddBlock: (type: BlockType) => void
  isEditable: boolean
  writebackEnabled: boolean
  isLast: boolean
}

function PlusButton(props: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [showOptions, setShowOptions] = useState(false)

  const toggleOptions = useCallback(() => {
    setShowOptions((prev) => !prev)
  }, [setShowOptions])

  useClickOutside(wrapperRef, () => {
    setShowOptions(false)
  })

  const addBlockHandler = useCallback(
    (type: BlockType) => {
      props.onAddBlock(type)
      setShowOptions(false)
    },
    [props.onAddBlock]
  )

  const btnDivProps = props.isLast ? { id: 'last-plus-button' } : {}

  return (
    <div
      {...btnDivProps}
      className="w-full group relative py-2"
      ref={wrapperRef}
    >
      <button
        className={clsx(
          'flex items-center justify-center gap-x-2 group-hover:opacity-100 transition-opacity duration-200 w-full h-6',
          !props.isEditable && 'invisible',
          props.alwaysOpen || showOptions || props.isLast
            ? 'opacity-100'
            : 'opacity-0'
        )}
        onClick={toggleOptions}
      >
        <div className="w-full h-[1px] bg-gray-200" />
        <div className="flex text-gray-400 justify-center items-center gap-x-1 text-[10px] whitespace-nowrap">
          <PlusIcon className="h-3 w-3 text-gray-400" />
          <span>Add block</span>
        </div>
        <div className="w-full h-[1px] bg-gray-200" />
      </button>

      {props.isEditable && (showOptions || props.alwaysOpen) && (
        <BlockList
          onAddBlock={addBlockHandler}
          writebackEnabled={props.writebackEnabled}
        />
      )}
    </div>
  )
}

const TriangleUp = () => {
  return (
    <div className="h-3 w-3 bg-white border-t border-l border-gray-200 rotate-45 translate-y-1/2"></div>
  )
}

interface BlockListProps {
  onAddBlock: (type: BlockType) => void
  writebackEnabled: boolean
}
function BlockList(props: BlockListProps) {
  const onAddText = useCallback(() => {
    props.onAddBlock(BlockType.RichText)
  }, [props.onAddBlock])
  const onAddSQL = useCallback(() => {
    props.onAddBlock(BlockType.SQL)
  }, [props.onAddBlock])
  const onAddPython = useCallback(() => {
    props.onAddBlock(BlockType.Python)
  }, [props.onAddBlock])
  const onAddVisualization = useCallback(() => {
    props.onAddBlock(BlockType.VisualizationV2)
  }, [props.onAddBlock])
  const onAddPivotTable = useCallback(() => {
    props.onAddBlock(BlockType.PivotTable)
  }, [props.onAddBlock])
  const onAddInput = useCallback(() => {
    props.onAddBlock(BlockType.Input)
  }, [props.onAddBlock])
  const onAddDropdownInput = useCallback(() => {
    props.onAddBlock(BlockType.DropdownInput)
  }, [props.onAddBlock])
  const onAddWriteback = useCallback(() => {
    props.onAddBlock(BlockType.Writeback)
  }, [props.onAddBlock])
  const onAddDateInput = useCallback(() => {
    props.onAddBlock(BlockType.DateInput)
  }, [props.onAddBlock])

  return (
    <div className="w-full absolute z-30 -translate-y-2">
      <div className="w-full flex justify-center relative z-30">
        <TriangleUp />
      </div>
      <div className="w-full bg-white py-1 rounded-md border border-gray-200 flex items-center justify-center divide-x divide-gray-200 shadow-lg">
        <BlockSuggestion
          id="add-block-text"
          icon={<Bars3CenterLeftIcon className="w-4 h-4" />}
          onAdd={onAddText}
          text="Text"
        />
        <BlockSuggestion
          id="add-block-query"
          icon={<CircleStackIcon className="w-4 h-4" />}
          onAdd={onAddSQL}
          text="Query"
        />
        <BlockSuggestion
          id="add-block-python"
          icon={<CodeBracketIcon className="w-4 h-4" />}
          onAdd={onAddPython}
          text="Python"
        />
        <BlockSuggestion
          id="add-block-visualization"
          icon={<ChartBarIcon className="w-4 h-4" />}
          onAdd={onAddVisualization}
          text="Visualization"
        />
        <BlockSuggestion
          id="add-block-pivot"
          icon={<Table2Icon className="w-4 h-4" />}
          onAdd={onAddPivotTable}
          text="Pivot"
        />
        {props.writebackEnabled && (
          <BlockSuggestion
            id="add-block-writeback"
            icon={<ArrowUpTrayIcon className="w-4 h-4" />}
            onAdd={onAddWriteback}
            text="Writeback"
          />
        )}
        <MultiBlockSuggestion
          icon={<PencilSquareIcon className="w-4 h-4" />}
          text="Input"
          onAdd={onAddInput}
          options={[
            {
              icon: <PencilSquareIcon className="w-4 h-4" />,
              text: 'Text',
              onClick: onAddInput,
            },
            {
              icon: <QueueListIcon className="w-4 h-4" />,
              text: 'Dropdown',
              onClick: onAddDropdownInput,
            },
            {
              icon: <CalendarIcon className="w-4 h-4" />,
              text: 'Date',
              onClick: onAddDateInput,
            },
          ]}
        />
      </div>
    </div>
  )
}

type BlockSuggestionProps = {
  id: string
  icon: JSX.Element
  text: string
  onAdd: () => void
}

function BlockSuggestion(props: BlockSuggestionProps) {
  const onClick = useCallback(() => {
    props.onAdd()
  }, [props.onAdd])

  return (
    <div id={props.id} className="w-full text-sm px-1 relative z-30">
      <button
        className="w-full transition-colors transition-100 flex items-center justify-center gap-x-2 p-2 rounded-md text-gray-400 bg-white hover:bg-gray-100 hover:text-gray-700"
        onClick={onClick}
      >
        {props.icon}
        <span>{props.text}</span>
      </button>
    </div>
  )
}

interface MultiBlockSuggestionProps {
  icon: JSX.Element
  text: string
  onAdd: () => void
  options: { icon: JSX.Element; text: string; onClick: () => void }[]
}
function MultiBlockSuggestion(props: MultiBlockSuggestionProps) {
  return (
    <Menu as="div" className="w-full text-sm px-1 relative z-30">
      <Menu.Button className="w-full transition-colors transition-100 flex items-center justify-center gap-x-2 p-2 rounded-md text-gray-400 bg-white hover:bg-gray-100 hover:text-gray-700 relative">
        {props.icon}
        <span>{props.text}</span>
        <ChevronDownIcon className="w-4 h-4" />
      </Menu.Button>
      <Transition
        as="div"
        className="absolute z-40 right-0"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Menu.Items
          as="div"
          className="w-44 mt-2 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none font-sans divide-y divide-gray-200"
        >
          {props.options.map((option, index) => (
            <Menu.Item key={index}>
              {({ active }) => (
                <button
                  className={clsx(
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                    index === 0 ? 'rounded-t-md' : '',
                    index === props.options.length - 1 ? 'rounded-b-md' : '',
                    'flex items-center gap-x-2 w-full text-sm px-4 py-3'
                  )}
                  onClick={option.onClick}
                >
                  {option.icon}
                  {option.text}
                </button>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  )
}

export default PlusButton
