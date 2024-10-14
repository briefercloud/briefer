import { Cog6ToothIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid'
import * as Y from 'yjs'
import {
  YBlock,
  type DropdownInputBlock,
  getDropdownInputAttributes,
  updateDropdownInputLabel,
  updateDropdownInputValue,
  getDropdownInputVariableExecStatus,
  getDropdownInputValueExecStatus,
  dropdownInputToggleConfigOpen,
  dropdownInputRequestSaveValue,
  updateDropdownInputVariable,
  dropdownInputRequestSaveVariable,
} from '@briefer/editor'
import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import Spin from '@/components/Spin'
import { ConnectDragPreview } from 'react-dnd'
import { ClockIcon } from '@heroicons/react/20/solid'
import DropdownSettings from './dropdownSettings'
import { DataFrame } from '@briefer/types'
import useEditorAwareness from '@/hooks/useEditorAwareness'
import { Combobox } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/20/solid'

function errorMessage(
  error: DropdownInputBlock['variable']['error'],
  options: DropdownInputBlock['options']
): React.ReactNode {
  switch (error) {
    case 'invalid-variable-name':
      return (
        <>
          The variable name is invalid:
          <br />
          It should start with a letter or underscore, followed by letters,
          digits, or underscores. Spaces are not allowed.
        </>
      )
    case 'invalid-value': {
      return (
        <>
          The value is invalid:
          <br />
          It must be one of the following:
          <br />
          {options.map((option) => (
            <div key={option}>{option}</div>
          ))}
        </>
      )
    }
    case 'unexpected-error':
      return (
        <>
          Unexpected error occurred while updating the input. Click this icon to
          retry.
        </>
      )
  }
}

interface Props {
  block: Y.XmlElement<DropdownInputBlock>
  blocks: Y.Map<YBlock>
  dragPreview: ConnectDragPreview | null
  belongsToMultiTabGroup: boolean
  isEditable: boolean
  isApp: boolean
  isDashboard: boolean
  dataframes: Y.Map<DataFrame>
  onRun: (block: Y.XmlElement<DropdownInputBlock>) => void
  isCursorWithin: boolean
  isCursorInserting: boolean
}
function DropdownInputBlock(props: Props) {
  const blockId = props.block.getAttribute('id')
  const attrs = getDropdownInputAttributes(props.block, props.blocks)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(attrs.value.newValue ?? '')

  const filteredOptions =
    query === ''
      ? attrs.options
      : attrs.options.filter((option) =>
          option.toLowerCase().includes(query.toLowerCase())
        )

  const onChangeLabel = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateDropdownInputLabel(props.block, e.target.value)
    },
    [props.block]
  )

  const onRetryValue = useCallback(() => {
    dropdownInputRequestSaveValue(props.block)
  }, [props.block])

  const toggleConfigOpen = useCallback(() => {
    dropdownInputToggleConfigOpen(props.block)
  }, [props.block])

  const isLoadingDropdownInputValue =
    getDropdownInputValueExecStatus(props.block) !== 'idle'

  const dropdownInputValueExecStatus = getDropdownInputValueExecStatus(
    props.block
  )
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateDropdownInputValue(props.block, {
        newValue: e.target.value,
      })
      props.onRun(props.block)
    },
    [props.block, props.onRun]
  )

  const dropdownInputVariableExecStatus = getDropdownInputVariableExecStatus(
    props.block,
    props.blocks
  )

  const onChangeVariable = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateDropdownInputVariable(props.block, props.blocks, {
        newValue: e.target.value,
      })
    },
    [props.block, props.blocks]
  )

  const onBlurVariable: React.FocusEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      if (attrs.variable.newValue !== attrs.variable.value) {
        updateDropdownInputVariable(props.block, props.blocks, {
          newValue: e.target.value.trim(),
          status: 'save-requested',
          error: null,
        })
      }
    },
    [props.block, props.blocks, attrs]
  )

  const onRetryVariable = useCallback(() => {
    dropdownInputRequestSaveVariable(props.block)
  }, [props.block])

  const selectRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (props.isCursorWithin && props.isCursorInserting) {
      selectRef.current?.focus()
    }
  }, [props.isCursorWithin, props.isCursorInserting])

  const { setInteractionState } = useEditorAwareness()
  const onFocus = useCallback(() => {
    setInteractionState({
      mode: 'insert',
      cursorBlockId: blockId ?? '',
      scrollIntoView: false,
    })
  }, [blockId, setInteractionState])

  const onBlur = useCallback(() => {
    setInteractionState((prev) => ({
      ...prev,
      mode: 'normal',
      scrollIntoView: false,
    }))
  }, [setInteractionState])

  const unfocusOnEscape = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (e.key === 'Escape') {
        selectRef.current?.blur()
      }
    },
    []
  )

  return (
    <div
      className={clsx(
        'w-full',
        props.belongsToMultiTabGroup && 'border p-4 rounded-tr-md rounded-b-md',
        props.isCursorWithin && !props.isCursorInserting
          ? 'border-blue-400'
          : 'border-gray-200'
      )}
      data-block-id={blockId}
    >
      <div
        className={!props.isDashboard ? 'w-1/2' : ''}
        ref={(d) => {
          if (props.dragPreview) {
            props.dragPreview(d)
          }
        }}
      >
        <div className="flex justify-between items-center pb-1.5">
          <div className="flex items-center flex-grow space-x-1">
            <input
              data-bounding-rect="true"
              className="block ring-0 text-sm font-medium leading-6 text-gray-900 w-full focus:ring-0 border-0 p-0 bg-transparent"
              type="text"
              value={attrs.label}
              onChange={onChangeLabel}
              disabled={!props.isEditable || props.isApp}
            />
            {!props.isApp && props.isEditable && (
              <div className="flex items-center space-x-1">
                <button onClick={toggleConfigOpen}>
                  <Cog6ToothIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
                <div
                  className={clsx(!props.isEditable && 'hidden', 'relative')}
                >
                  <input
                    className={clsx(
                      'ring-0 px-1 py-0.5 rounded-md text-ceramic-500 bg-ceramic-100 text-xs font-medium min-w-12 min-h-4 focus:ring-0 border-0 block text-right',
                      {
                        'text-red-500 bg-red-100':
                          attrs.variable.error &&
                          dropdownInputVariableExecStatus === 'idle',
                        'text-ceramic-500 bg-ceramic-100':
                          !attrs.variable.error &&
                          dropdownInputVariableExecStatus === 'idle',
                        'text-gray-300 bg-gray-100':
                          dropdownInputVariableExecStatus === 'loading',
                      }
                    )}
                    type="text"
                    value={attrs.variable.newValue}
                    onChange={onChangeVariable}
                    onBlur={onBlurVariable}
                    disabled={dropdownInputVariableExecStatus !== 'idle'}
                  />
                  <div className="absolute inset-y-0 pl-1 flex items-center group z-10">
                    {(attrs.variable.error ||
                      dropdownInputVariableExecStatus !== 'idle') &&
                      (dropdownInputVariableExecStatus === 'loading' ? (
                        <Spin />
                      ) : dropdownInputVariableExecStatus === 'enqueued' ? (
                        <ClockIcon className="w-4 h-4 text-gray-300" />
                      ) : attrs.variable.error ? (
                        <>
                          <button
                            disabled={attrs.variable.error === null}
                            onClick={onRetryVariable}
                          >
                            <ExclamationCircleIcon
                              className="h-3 w-3 text-red-300"
                              aria-hidden="true"
                            />
                          </button>
                          <div className="font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 w-72">
                            <span className="inline-flex gap-x-1 items-center text-gray-400 text-center">
                              {errorMessage(
                                attrs.variable.error,
                                attrs.options
                              )}
                            </span>
                          </div>
                        </>
                      ) : null)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col space-y-1">
          <div className="relative">
            <Combobox
              value={selected}
              onChange={(value) => {
                setSelected(value)
                updateDropdownInputValue(props.block, { newValue: value })
                props.onRun(props.block)
              }}
              disabled={
                dropdownInputValueExecStatus !== 'idle' ||
                (!props.isEditable && !props.isApp)
              }
            >
              <Combobox.Button as="div" className="block w-full">
                <div className="relative">
                  <Combobox.Input
                    onFocus={onFocus}
                    onBlur={onBlur}
                    className={clsx(
                      'block rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset w-full disabled:bg-gray-100 disabled:cursor-not-allowed bg-white',
                      attrs.value.error
                        ? 'ring-red-200 focus:ring-red-200'
                        : 'focus:ring-primary-200',
                      props.isCursorWithin &&
                        !props.isCursorInserting &&
                        !props.belongsToMultiTabGroup
                        ? 'ring-primary-400'
                        : 'ring-gray-200',
                      (isLoadingDropdownInputValue || attrs.value.error) &&
                        'bg-none' // this removes the caret
                    )}
                    displayValue={(value: string) => value}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div
                    className="inline-block absolute inset-y-0 right-0 px-2.5 bottom-1/2 transform translate-y-1/2"
                    onClick={() => setQuery('')}
                  >
                    <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Combobox.Button>
              <Combobox.Options
                ref={selectRef}
                onKeyDown={unfocusOnEscape}
                className={
                  'absolute mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm z-10'
                }
              >
                {filteredOptions.map((option) => (
                  <Combobox.Option
                    key={option}
                    value={option}
                    className={({ active }) =>
                      clsx(
                        'cursor-default select-none relative py-2 pl-10 pr-4',
                        active ? 'bg-ceramic-100 text-black' : 'text-gray-900'
                      )
                    }
                  >
                    {({ selected, active }) => (
                      <>
                        <span
                          className={clsx(
                            'block truncate',
                            selected ? 'font-medium' : 'font-normal'
                          )}
                        >
                          {option}
                        </span>
                        {selected ? (
                          <span
                            className={clsx(
                              'absolute inset-y-0 left-0 flex items-center pl-3',
                              active ? 'text-white' : 'text-blue-600'
                            )}
                          >
                            <CheckIcon
                              className="w-4 h-4"
                              aria-hidden="true"
                              color="black"
                            />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            </Combobox>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 group">
              {(attrs.value.error || dropdownInputValueExecStatus !== 'idle') &&
                (dropdownInputValueExecStatus === 'loading' ? (
                  <Spin />
                ) : dropdownInputValueExecStatus === 'enqueued' ? (
                  <ClockIcon className="w-4 h-4 text-gray-300" />
                ) : attrs.value.error ? (
                  <>
                    <button onClick={onRetryValue}>
                      <ExclamationCircleIcon
                        className="h-4 w-4 text-red-300"
                        aria-hidden="true"
                      />
                    </button>
                    <div className="font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 w-72">
                      <span className="inline-flex gap-x-1 items-center text-gray-400">
                        <span>
                          {errorMessage(attrs.value.error, attrs.options)}
                        </span>
                      </span>
                    </div>
                  </>
                ) : null)}
            </div>
          </div>
          {attrs.configOpen && !props.isApp && props.isEditable && (
            <DropdownSettings
              block={props.block}
              blocks={props.blocks}
              dataframes={props.dataframes}
              onRun={props.onRun}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default DropdownInputBlock
