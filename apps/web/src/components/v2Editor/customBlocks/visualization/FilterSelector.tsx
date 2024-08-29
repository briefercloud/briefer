import {
  useCallback,
  useState,
  useEffect,
  ChangeEventHandler,
  useMemo,
  useRef,
} from 'react'
import {
  DataFrameColumn,
  VisualizationDateFilterOperator,
  VisualizationNumberFilterOperator,
  VisualizationStringFilterOperator,
  numberFilterOperators,
  stringFilterOperators,
  dateFilterOperators,
  VisualizationNumberFilter,
  VisualizationStringFilter,
  VisualizationDateFilter,
  toDate,
  DataFrame,
  VisualizationFilter,
  NumpyNumberTypes,
  NumpyStringTypes,
  NumpyJsonTypes,
  NumpyDateTypes,
  NumpyBoolTypes,
  VisualizationStringFilterMultiValuesOperator,
  NumpyTimeDeltaTypes,
} from '@briefer/types'
import { Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/20/solid'
import AxisSelector from '../../../AxisSelector'
import Combobox from './Combobox'
import clsx from 'clsx'
import MultiCombobox from './MultiCombobox'
import { preventPropagation } from '@/utils/events'
import { identity } from 'ramda'
import ReactDOM from 'react-dom'
import useDropdownPosition from '@/hooks/dropdownPosition'

function isNumberOperator(
  operator:
    | VisualizationNumberFilterOperator
    | VisualizationStringFilterOperator
    | VisualizationDateFilterOperator
): operator is VisualizationNumberFilterOperator {
  return VisualizationNumberFilterOperator.safeParse(operator).success
}

function isStringOperator(
  operator:
    | VisualizationNumberFilterOperator
    | VisualizationStringFilterOperator
    | VisualizationDateFilterOperator
): operator is VisualizationStringFilterOperator {
  return VisualizationStringFilterOperator.safeParse(operator).success
}

function isDateOperator(
  operator:
    | VisualizationNumberFilterOperator
    | VisualizationStringFilterOperator
    | VisualizationDateFilterOperator
): operator is VisualizationDateFilterOperator {
  return VisualizationDateFilterOperator.safeParse(operator).success
}

function numberOperatorSymbol(
  operator: VisualizationNumberFilterOperator
): string {
  switch (operator) {
    case 'eq':
      return '='
    case 'ne':
      return '!='
    case 'gt':
      return '>'
    case 'lt':
      return '<'
    case 'gte':
      return '>='
    case 'lte':
      return '<='
    case 'isNull':
      return 'is null'
    case 'isNotNull':
      return 'is not null'
  }
}
function numberOperatorLabel(
  operator: VisualizationNumberFilterOperator
): string {
  switch (operator) {
    case 'eq':
      return 'Equals'
    case 'ne':
      return 'Not Equals'
    case 'gt':
      return 'Greater Than'
    case 'lt':
      return 'Less Than'
    case 'gte':
      return 'Greater Than or Equals'
    case 'lte':
      return 'Less Than or Equals'
    case 'isNull':
      return 'Is Null'
    case 'isNotNull':
      return 'Is Not Null'
  }
}

function stringOperatorSymbol(
  operator: VisualizationStringFilterOperator
): string {
  switch (operator) {
    case 'eq':
      return '='
    case 'ne':
      return '!='
    case 'contains':
      return 'contains'
    case 'notContains':
      return 'not contains'
    case 'startsWith':
      return 'starts with'
    case 'endsWith':
      return 'ends with'
    case 'in':
      return 'in'
    case 'notIn':
      return 'not in'
    case 'isNull':
      return 'is null'
    case 'isNotNull':
      return 'is not null'
  }
}
function stringOperatorLabel(
  operator: VisualizationStringFilterOperator
): string {
  switch (operator) {
    case 'eq':
      return 'Equals'
    case 'ne':
      return 'Not Equals'
    case 'contains':
      return 'Contains'
    case 'notContains':
      return 'Not Contains'
    case 'startsWith':
      return 'Starts With'
    case 'endsWith':
      return 'Ends With'
    case 'in':
      return 'In'
    case 'notIn':
      return 'Not In'
    case 'isNull':
      return 'Is Null'
    case 'isNotNull':
      return 'Is Not Null'
  }
}

function dateOperatorSymbol(operator: VisualizationDateFilterOperator): string {
  switch (operator) {
    case 'eq':
      return '='
    case 'ne':
      return '!='
    case 'before':
      return '<'
    case 'after':
      return '>'
    case 'beforeOrEq':
      return '<='
    case 'afterOrEq':
      return '>='
    case 'isNull':
      return 'is null'
    case 'isNotNull':
      return 'is not null'
  }
}
function dateOperatorLabel(operator: VisualizationDateFilterOperator): string {
  switch (operator) {
    case 'eq':
      return 'Equals'
    case 'ne':
      return 'Not Equals'
    case 'before':
      return 'Before'
    case 'after':
      return 'After'
    case 'beforeOrEq':
      return 'Before or Equals'
    case 'afterOrEq':
      return 'After or Equals'
    case 'isNull':
      return 'Is Null'
    case 'isNotNull':
      return 'Is Not Null'
  }
}

function getOperatorLabel(
  operator:
    | VisualizationStringFilterOperator
    | VisualizationNumberFilterOperator
    | VisualizationDateFilterOperator
): string {
  if (isNumberOperator(operator)) {
    return numberOperatorLabel(operator)
  }

  if (isStringOperator(operator)) {
    return stringOperatorLabel(operator)
  }

  return dateOperatorLabel(operator)
}

function searchOperator<
  T extends
    | VisualizationNumberFilterOperator
    | VisualizationStringFilterOperator
    | VisualizationDateFilterOperator
>(options: T[], query: string): T[] {
  return options.filter((c) => {
    if (isNumberOperator(c)) {
      return (
        numberOperatorLabel(c).toLowerCase().includes(query.toLowerCase()) ||
        numberOperatorSymbol(c).toLowerCase().includes(query.toLowerCase())
      )
    }

    if (isStringOperator(c)) {
      return (
        stringOperatorLabel(c).toLowerCase().includes(query.toLowerCase()) ||
        stringOperatorSymbol(c).toLowerCase().includes(query.toLowerCase())
      )
    }

    return (
      dateOperatorLabel(c).toLowerCase().includes(query.toLowerCase()) ||
      dateOperatorSymbol(c).toLowerCase().includes(query.toLowerCase())
    )
  })
}

function getOperatorOptions(columnType: DataFrameColumn['type']) {
  if (NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(columnType).success) {
    return numberFilterOperators
  }

  if (NumpyStringTypes.or(NumpyJsonTypes).safeParse(columnType).success) {
    return stringFilterOperators
  }

  if (NumpyDateTypes.safeParse(columnType).success) {
    return dateFilterOperators
  }

  // TODO: add filtering capabilities for boolean types
  if (NumpyBoolTypes.safeParse(columnType).success) {
    return []
  }

  // TODO: this should never happen, we should be alerted
  return []
}

interface Props {
  dataframe: Pick<DataFrame, 'name' | 'columns'>
  filter: VisualizationFilter
  onChange: (filter: VisualizationFilter) => void
  onRemove: (filter: VisualizationFilter) => void
  isInvalid: boolean
  disabled?: boolean
}

type Operator =
  | VisualizationStringFilterOperator
  | VisualizationNumberFilterOperator
  | VisualizationDateFilterOperator
function FilterSelector(props: Props) {
  const onRemove = useCallback(() => {
    props.onRemove(props.filter)
  }, [props.onRemove, props.filter])

  const [column, setColumn] = useState<DataFrameColumn | null>(
    props.filter.column
  )

  const [operator, setOperator] = useState<Operator | null>(
    props.filter.operator
  )

  const [value, setValue] = useState<string | string[]>(
    Array.isArray(props.filter.value)
      ? props.filter.value
      : props.filter.value?.toString() ??
          (props.filter.operator
            ? ['in', 'notIn'].includes(props.filter.operator)
              ? []
              : ''
            : '')
  )
  const onChangeValue: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      setValue(event.target.value)
    },
    [setValue]
  )

  useEffect(() => {
    if (!column || !operator) {
      return
    }

    if (
      NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(column.type).success
    ) {
      if (!isNumberOperator(operator)) {
        setOperator('eq')
      }
      return
    }

    if (NumpyStringTypes.or(NumpyJsonTypes).safeParse(column.type).success) {
      if (!isStringOperator(operator)) {
        setOperator('eq')
      }
      return
    }

    if (NumpyDateTypes.safeParse(column.type).success) {
      if (!isDateOperator(operator)) {
        setOperator('eq')
      }
      return
    }
  }, [column, operator])

  useEffect(() => {
    if (!column || !operator) {
      return
    }

    const timeout = setTimeout(() => {
      if (
        NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(column.type).success
      ) {
        if (isNumberOperator(operator)) {
          const filter = VisualizationNumberFilter.safeParse({
            id: props.filter.id,
            column,
            operator,
            value: parseFloat(value.toString()),
          })
          if (filter.success && !Number.isNaN(filter.data.value)) {
            props.onChange(filter.data)
            return
          }
        }
      }

      if (NumpyStringTypes.or(NumpyJsonTypes).safeParse(column.type).success) {
        if (isStringOperator(operator)) {
          const filter = VisualizationStringFilter.safeParse({
            id: props.filter.id,
            column,
            operator,
            value,
          })
          if (filter.success) {
            props.onChange(filter.data)
            return
          }
        }
      }

      if (NumpyDateTypes.safeParse(column.type).success) {
        if (isDateOperator(operator)) {
          const filter = VisualizationDateFilter.safeParse({
            id: props.filter.id,
            column,
            operator,
            value: toDate(value.toString())?.toISOString() ?? value,
          })
          if (filter.success) {
            props.onChange(filter.data)
            return
          }
        }
      }

      props.onChange({
        type: 'unfinished-visualization-filter',
        id: props.filter.id,
        column,
        operator,
        value,
      })
    }, 1000)

    return () => {
      clearTimeout(timeout)
    }
  }, [column, operator, value])

  const invalidReason = useMemo(() => {
    if (!props.isInvalid || !column || !operator) {
      return null
    }

    const columnExists = props.dataframe.columns.some(
      (c) => c.name === column.name
    )
    if (!columnExists) {
      return 'invalid-column' as const
    }

    if (
      NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(column.type).success
    ) {
      if (value === '') {
        return 'empty-value' as const
      }

      if (Number.isNaN(Number(value))) {
        return 'invalid-value' as const
      }
      return null
    }

    if (NumpyStringTypes.or(NumpyJsonTypes).safeParse(column.type).success) {
      if ((Array.isArray(value) && value.length === 0) || value === '') {
        return 'empty-value' as const
      }

      return null
    }

    if (NumpyDateTypes.safeParse(column.type).success) {
      if (value === '') {
        return 'empty-value' as const
      }

      const date = toDate(value.toString())
      if (!date) {
        return 'invalid-value' as const
      }

      return null
    }

    return null
  }, [props.isInvalid, column, operator, value, props.dataframe])

  const onChangeOperator = useCallback(
    (newOp: Operator | null) => {
      const wasMultiValue =
        VisualizationStringFilterMultiValuesOperator.safeParse(operator).success
      const isMultiValue =
        VisualizationStringFilterMultiValuesOperator.safeParse(newOp).success

      if (wasMultiValue && isMultiValue) {
        if (!Array.isArray(value)) {
          setValue(value === '' ? [] : [value])
        }
      } else if (wasMultiValue && !isMultiValue) {
        if (Array.isArray(value)) {
          setValue(value[0] ?? '')
        }
      } else if (!wasMultiValue && isMultiValue) {
        if (typeof value === 'string') {
          setValue(value === '' ? [] : [value])
        }
      } else if (!wasMultiValue && !isMultiValue) {
        if (Array.isArray(value)) {
          setValue(value[0] ?? '')
        }
      }

      if (column && (newOp === 'isNull' || newOp === 'isNotNull')) {
        if (
          NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(column.type)
            .success
        ) {
          setValue('0')
        }

        if (
          NumpyStringTypes.or(NumpyJsonTypes).safeParse(column.type).success
        ) {
          setValue('filter')
        }

        if (NumpyDateTypes.safeParse(column.type).success) {
          setValue(new Date().toISOString())
        }
      }
      setOperator(newOp)
    },
    [operator, value]
  )

  const buttonRef = useRef<HTMLButtonElement>(null)
  const { onOpen, dropdownPosition } = useDropdownPosition(buttonRef)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) {
      return
    }

    const onClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        // only close if no one else handles this event
        requestAnimationFrame(() => {
          if (event.defaultPrevented) return
          setOpen(false)
        })
      }
    }

    document.addEventListener('click', onClickOutside)

    return () => {
      document.removeEventListener('click', onClickOutside)
    }
  }, [menuRef, open])

  const onClickButton = useCallback(() => {
    if (!props.disabled) {
      onOpen()
      setOpen(true)
    }
  }, [props.disabled, onOpen])

  return (
    <div className="relative text-xs group">
      {invalidReason && (
        <div className="w-64 font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col items-center justify-center gap-y-1 text-center">
          {invalidReason === 'invalid-column' ? (
            <span>
              The selected column does not belong to the{' '}
              <span className="font-mono">{props.dataframe.name}</span>{' '}
              dataframe.
            </span>
          ) : invalidReason === 'empty-value' ? (
            <span>
              The value for the selected column of type{' '}
              <span className="font-mono">{column?.type}</span> cannot be empty.
            </span>
          ) : (
            <span>
              The value <span className="font-mono">{value}</span> is invalid
              for the selected column of type{' '}
              <span className="font-mono">{column?.type}</span>.
            </span>
          )}
        </div>
      )}

      <button
        className={clsx(
          'flex items-center gap-x-2.5 py-1.5 px-2 rounded-sm border',
          props.isInvalid && column
            ? 'text-red-500 bg-red-50 border-red-200 hover:border-red-400/60'
            : 'text-gray-500 bg-gray-50 hover:border-gray-400/60 border-gray-200'
        )}
        disabled={props.disabled}
        ref={buttonRef}
        onClick={onClickButton}
      >
        <div className="flex gap-x-1 whitespace-nowrap">
          <span>{column?.name ?? 'New filter'}</span>
          <span
            className={clsx(
              operator === 'isNull' || operator === 'isNotNull'
                ? 'pl-0.5'
                : 'px-0.5',
              props.isInvalid ? 'text-red-400' : 'text-gray-400'
            )}
          >
            {operator
              ? isNumberOperator(operator)
                ? numberOperatorSymbol(operator)
                : isStringOperator(operator)
                ? stringOperatorSymbol(operator)
                : dateOperatorSymbol(operator)
              : ''}
          </span>
          {operator !== 'isNull' && operator !== 'isNotNull' && (
            <span>
              {Array.isArray(value)
                ? value.length > 1
                  ? `[${value.join(', ')}]`
                  : value[0]
                : value}
            </span>
          )}
        </div>
        <span className="p-0.5 rounded-full hover:bg-red-100  hover:text-red-700">
          <XMarkIcon className="h-3 w-3" onClick={onRemove} />
        </span>
      </button>

      {ReactDOM.createPortal(
        <Transition
          show={open}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
          className="absolute z-[2000] -translate-x-1/2"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: buttonRef.current?.getBoundingClientRect().width,
          }}
        >
          <div
            className={clsx(
              'absolute py-4 px-2 left-0 z-20 mt-2 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none px-4',

              VisualizationStringFilterMultiValuesOperator.safeParse(operator)
                .success
                ? 'w-72'
                : 'w-56'
            )}
            ref={menuRef}
          >
            <div className="flex flex-col gap-y-3">
              <AxisSelector
                label="Column"
                value={column}
                columns={props.dataframe.columns}
                onChange={setColumn}
                defaultValue={null}
              />

              {column && (
                <>
                  <Combobox<
                    | VisualizationNumberFilterOperator
                    | VisualizationDateFilterOperator
                    | VisualizationStringFilterOperator
                  >
                    icon={() => null}
                    label="Operator"
                    value={operator}
                    options={getOperatorOptions(column.type)}
                    onChange={onChangeOperator}
                    search={searchOperator}
                    getLabel={getOperatorLabel}
                    placeholder="Operator"
                    disabled={props.disabled}
                  />
                  {operator !== 'isNull' && operator !== 'isNotNull' && (
                    <>
                      {VisualizationStringFilterMultiValuesOperator.safeParse(
                        operator
                      ).success ? (
                        <MultiCombobox
                          label="Value"
                          value={Array.from(value)}
                          options={
                            'categories' in column
                              ? column.categories?.map((c) => c.toString()) ??
                                []
                              : []
                          }
                          onChange={setValue}
                          search={(options, query) =>
                            options.filter((c) => c.includes(query))
                          }
                          getLabel={(value) => value}
                          icon={() => null}
                          placeholder="Value"
                          disabled={props.disabled}
                          valueFromQuery={identity}
                        />
                      ) : (
                        <div>
                          <label className="text-xs font-medium leading-6 text-gray-900">
                            Value
                          </label>
                          <input
                            className="w-full truncate border-0 text-xs  rounded-md ring-1 ring-inset ring-gray-200 focus-within:ring-1 focus-within:ring-inset focus-within:ring-gray-300 bg-white text-gray-800"
                            type="text"
                            value={
                              Array.isArray(value) ? value[0] ?? null : value
                            }
                            onChange={onChangeValue}
                            placeholder="Value"
                            onKeyDown={preventPropagation}
                            disabled={props.disabled}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </Transition>,
        document.body
      )}
    </div>
  )
}

export default FilterSelector
