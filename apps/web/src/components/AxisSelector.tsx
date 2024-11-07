import Combobox from './v2Editor/customBlocks/visualization/Combobox'
import { useEffect, useMemo } from 'react'
import { DataFrameColumn } from '@briefer/types'
import { getColumnTypeIcon } from './v2Editor/customBlocks/sql/Table'

function ColumnIcon({
  type,
  className,
}: {
  type: DataFrameColumn['type']
  className?: string
}) {
  const Icon = getColumnTypeIcon(type)
  if (!Icon) {
    return null
  }

  return <Icon className={className} />
}

function search(options: (DataFrameColumn | null)[], query: string) {
  return options.filter((c) => {
    return c?.name.toString().toLowerCase().includes(query.toLowerCase())
  })
}

type AxisSelectorProps = {
  label?: string | JSX.Element
  value: DataFrameColumn | null
  defaultValue: DataFrameColumn | null
  columns: (DataFrameColumn | null)[]
  onChange: (column: DataFrameColumn | null) => void
  disabled?: boolean
}

export default function AxisSelector(props: AxisSelectorProps) {
  // Use the value from the columns array so that the value equality check works
  const value = useMemo(
    () => props.columns.find((c) => c?.name === props.value?.name) ?? null,
    [props.columns, props.value]
  )
  useEffect(() => {
    if (value === null && props.defaultValue !== null && !props.disabled) {
      props.onChange(props.defaultValue)
    }
  }, [props.defaultValue, value, props.onChange, props.disabled])

  return (
    <Combobox<DataFrameColumn | null>
      label={props.label}
      value={value}
      options={props.columns}
      onChange={props.onChange}
      search={search}
      getLabel={(value) => value?.name.toString() ?? 'None'}
      icon={(value) =>
        value ? (
          <ColumnIcon type={value.type} className="h-3 w-3 text-gray-500" />
        ) : null
      }
      placeholder="Column"
      disabled={props.disabled}
    />
  )
}
