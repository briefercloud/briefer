import * as Y from 'yjs'
import {
  DropdownInputBlock,
  YBlock,
  appendDropdownInputOptions,
  getDropdownInputAttributes,
  removeDropdownInputOption,
  setDropdownColumnName,
  setDropdownDataFrameName,
  setDropdownType,
} from '@briefer/editor'
import { Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { CheckIcon, DatabaseZapIcon, KeyboardIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { DataFrame } from '@briefer/types'
import { useYMemo } from '@/hooks/useYMemo'
import Dropdown from '@/components/Dropdown'

type Props = {
  block: Y.XmlElement<DropdownInputBlock>
  blocks: Y.Map<YBlock>
  onRun: (block: Y.XmlElement<DropdownInputBlock>) => void
  dataframes: Y.Map<DataFrame>
}

export default function DropdownSettings(props: Props) {
  const attrs = getDropdownInputAttributes(props.block, props.blocks)

  const onChangeDropdownType = useCallback((type: 'static' | 'dynamic') => {
    setDropdownType(props.block, type)
  }, [])

  return (
    <div className="bg-gray-50 px-3 py-3 border border-gray-200 flex flex-col gap-y-2 rounded-md shadow-sm">
      <span className="text-xs font-semibold py-1 flex gap-x-1 text-gray-400">
        <Cog6ToothIcon className="w-4 h-4" />
        Dropdown settings
      </span>

      <span className="isolate inline-flex rounded-md shadow-sm w-full">
        <button
          type="button"
          onClick={() => onChangeDropdownType('static')}
          className={clsx(
            'relative inline-flex items-center justify-between rounded-l-md px-3 py-2 text-xs ring-1 ring-inset ring-gray-300 hover:bg-ceramic-50 focus:z-10 w-full',
            attrs.dropdownType === 'static'
              ? 'bg-ceramic-50 text-gray-900 font-medium'
              : 'bg-white text-gray-500'
          )}
          disabled={attrs.dropdownType === 'static'}
        >
          <span className="flex gap-x-2 items-center">
            <KeyboardIcon
              strokeWidth={attrs.dropdownType === 'static' ? 2 : 1}
              className="w-4 h-4"
            />
            Static
          </span>
          {attrs.dropdownType === 'static' && (
            <CheckIcon strokeWidth={3} className="w-4 h-4 text-ceramic-400" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onChangeDropdownType('dynamic')}
          className={clsx(
            'relative -ml-px inline-flex items-center justify-between rounded-r-md px-3 py-2 text-xs ring-1 ring-inset ring-gray-300 hover:bg-ceramic-50 focus:z-10 w-full',
            attrs.dropdownType === 'dynamic'
              ? 'bg-ceramic-50 text-gray-900 font-medium'
              : 'bg-white text-gray-500'
          )}
          disabled={attrs.dropdownType === 'dynamic'}
        >
          <span className="flex gap-x-2 items-center">
            <DatabaseZapIcon
              strokeWidth={attrs.dropdownType === 'dynamic' ? 2 : 1}
              className="w-4 h-4"
            />
            Dynamic
          </span>
          {attrs.dropdownType === 'dynamic' && (
            <CheckIcon strokeWidth={3} className="w-4 h-4 text-ceramic-400" />
          )}
        </button>
      </span>

      {attrs.dropdownType === 'static' ? (
        <StaticInput
          options={attrs.options}
          block={props.block}
          blocks={props.blocks}
          onRun={props.onRun}
        />
      ) : (
        <DynamicInput
          block={props.block}
          blocks={props.blocks}
          onRun={props.onRun}
          dataframes={props.dataframes}
        />
      )}
    </div>
  )
}

type StaticInputProps = {
  options: string[]
  block: Y.XmlElement<DropdownInputBlock>
  blocks: Y.Map<YBlock>
  onRun: (block: Y.XmlElement<DropdownInputBlock>) => void
}

const StaticInput = (props: StaticInputProps) => {
  const [unfinishedOption, setUnfinishedOption] = useState('')

  const onChangeUnfinishedOption = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUnfinishedOption(e.target.value)
    },
    []
  )

  const onRemoveOption = useCallback(
    (option: string) => {
      if (removeDropdownInputOption(props.block, option)) {
        props.onRun(props.block)
      }
    },
    [props.block, props.onRun]
  )

  const onOptionsInputBlur = useCallback(() => {
    const option = unfinishedOption.trim()
    if (option.length > 0) {
      if (
        appendDropdownInputOptions(props.block, props.blocks, [option], false)
      ) {
        props.onRun(props.block)
      }
      setUnfinishedOption('')
    }
  }, [unfinishedOption, props.block, props.blocks, props.onRun])

  const onOptionsInputKeydown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        onOptionsInputBlur()
      }
    },
    [onOptionsInputBlur]
  )

  return (
    <div className="pt-2">
      <span className="block text-xs font-medium leading-6 text-gray-700 py-0.5">
        Static options
      </span>
      <div
        className={clsx(
          props.options.length > 0 ? 'p-2' : 'py-0.5',
          'flex flex-wrap border border-gray-200  rounded-md shadow-sm bg-white'
        )}
      >
        <div className="flex flex-wrap">
          {props.options.map((option, index) => (
            <div className="px-1 py-1">
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 px-2 py-1 rounded-sm flex items-center gap-x-1 text-xs"
              >
                <span>{option}</span>
                <button
                  type="button"
                  onClick={() => onRemoveOption(option)}
                  className="rounded-full mt-0.5 p-0.5 hover:bg-gray-200"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <input
          type="text"
          value={unfinishedOption}
          onChange={onChangeUnfinishedOption}
          className="flex-1 border-0 focus:ring-0 focus:outline-0 rounded-md text-sm placeholder-gray-400 bg-transparent"
          onKeyDown={onOptionsInputKeydown}
          onBlur={onOptionsInputBlur}
          placeholder="Type an option and press enter or tab"
        />
      </div>
    </div>
  )
}

type DynamicInputProps = {
  block: Y.XmlElement<DropdownInputBlock>
  blocks: Y.Map<YBlock>
  onRun: (block: Y.XmlElement<DropdownInputBlock>) => void
  dataframes: Y.Map<DataFrame>
}

const getCurrDataframe = (
  dfName: string | null,
  dataframes: Y.Map<DataFrame>
) => {
  if (dfName === null) {
    return null
  }

  const dataframe = dataframes.get(dfName)
  if (dataframe === undefined) {
    return null
  }

  return dataframe
}

const getCurrColumns = (currDataframe: DataFrame | null) => {
  if (!currDataframe) {
    return []
  }

  return currDataframe.columns
    .filter((column) => 'categories' in column)
    .map((column) => ({
      label: column.name.toString(),
      value: column.name.toString(),
    }))
}

const DynamicInput = (props: DynamicInputProps) => {
  const attrs = useYMemo(
    props.blocks,
    (blocks) => getDropdownInputAttributes(props.block, blocks),
    [props.block]
  )

  const dataframes = useYMemo(
    props.dataframes,
    (dataframes) =>
      Array.from(dataframes.values()).map((df) => ({
        label: df.name,
        value: df.name,
      })),
    []
  )
  const currDataframe = useYMemo(
    props.dataframes,
    (dataframes) => getCurrDataframe(attrs.dataframeName, dataframes),
    [attrs.dataframeName, props.dataframes]
  )
  const columns = getCurrColumns(currDataframe)

  const onChangeDataFrameName = useCallback(
    (name: string) => {
      setDropdownDataFrameName(props.block, name)
    },
    [props.block]
  )

  const onChangeColumnName = useCallback(
    (name: string) => {
      setDropdownColumnName(props.block, name)
    },
    [props.block, props.onRun, currDataframe, props.blocks]
  )

  useEffect(() => {
    const currCol = currDataframe?.columns.find(
      (col) => col.name === attrs.columnName
    )
    const categories =
      currCol && 'categories' in currCol ? currCol.categories ?? [] : []
    appendDropdownInputOptions(
      props.block,
      props.blocks,
      categories.map((c) => c.toString()),
      true
    )

    props.onRun(props.block)
  }, [currDataframe, attrs.columnName, props.block, props.blocks, props.onRun])

  return (
    <div className="flex flex-col gap-y-3 pt-2">
      <Dropdown
        disabled={dataframes.length === 0}
        label="Dataframe"
        options={dataframes}
        placeholder={
          dataframes.length === 0 ? 'No dataframes' : 'Select a dataframe'
        }
        value={attrs.dataframeName ?? ''}
        onChange={onChangeDataFrameName}
      />

      <Dropdown
        disabled={attrs.dataframeName === null}
        value={attrs.columnName ?? ''}
        label="Column"
        placeholder="Select a column"
        options={columns}
        onChange={onChangeColumnName}
      />
    </div>
  )
}
