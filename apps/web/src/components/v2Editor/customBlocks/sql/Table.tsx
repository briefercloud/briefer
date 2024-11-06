import { DataFrameColumn, Json } from '@briefer/types'
import clsx from 'clsx'
import { Cell, Column, Table2, TableLoadingOption, ColumnHeaderCell } from '@blueprintjs/table'
import { Menu, MenuItem } from '@blueprintjs/core'
import '@blueprintjs/table/lib/css/table.css'
import '@blueprintjs/core/lib/css/blueprint.css'
import ScrollBar from '@/components/ScrollBar'
import { useCallback, useState, useMemo } from 'react'

interface Props {
  rows: Record<string, Json>[]
  columns: DataFrameColumn[]
  isDashboard: boolean
}

function Table(props: Props) {
  // Constants for column width calculations
  const MIN_COLUMN_WIDTH = 150
  const CHAR_WIDTH_PX = 8  // Approximate width of a character in the current font
  const COLUMN_PADDING_PX = 64  // Space for menu icon and padding

  const [columnOrder, setColumnOrder] = useState<number[]>(
    props.columns.map((_, index) => index)
  )

  // Calculate minimum column widths based on column names
  const columnWidths = useMemo(() => {
    return columnOrder.map(index => {
      const columnName = props.columns[index].name
      return Math.max(MIN_COLUMN_WIDTH, columnName.length * CHAR_WIDTH_PX + COLUMN_PADDING_PX)
    })
  }, [columnOrder, props.columns])

  const cellRenderer = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const column = props.columns[columnOrder[columnIndex]]
      const value = props.rows[rowIndex][column.name]
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value?.toString()
      
      return (
        <Cell className="px-4 py-2 text-sm font-normal text-gray-700">
          <div className="truncate">
            {displayValue}
          </div>
        </Cell>
      )
    },
    [props.rows, props.columns, columnOrder]
  )

  const handleColumnsReordered = useCallback(
    (oldIndex: number, newIndex: number) => {
      requestAnimationFrame(() => {
        setColumnOrder(prevOrder => {
          const newColumnOrder = [...prevOrder]
          const [movedColumn] = newColumnOrder.splice(oldIndex, 1)
          newColumnOrder.splice(newIndex, 0, movedColumn)
          return newColumnOrder
        })
      })
    },
    []
  )

  const moveColumnToFront = useCallback(
    (columnIndex: number) => {
      requestAnimationFrame(() => {
        setColumnOrder(prevOrder => {
          const newColumnOrder = [...prevOrder]
          const [movedColumn] = newColumnOrder.splice(columnIndex, 1)
          newColumnOrder.unshift(movedColumn)
          return newColumnOrder
        })
      })
    },
    []
  )

  const moveColumnToBack = useCallback(
    (columnIndex: number) => {
      requestAnimationFrame(() => {
        setColumnOrder(prevOrder => {
          const newColumnOrder = [...prevOrder]
          const [movedColumn] = newColumnOrder.splice(columnIndex, 1)
          newColumnOrder.push(movedColumn)
          return newColumnOrder
        })
      })
    },
    []
  )

  const columnHeaderRenderer = useCallback(
    (columnIndex: number) => {
      const column = props.columns[columnOrder[columnIndex]]
      return (
        <ColumnHeaderCell
          name={column.name}
          className="bg-gray-50 px-4 py-2"
          nameRenderer={(name) => (
            <div className="font-semibold text-sm text-gray-900">
              {name}
            </div>
          )}
          menuRenderer={() => (
            <Menu>
              <MenuItem
                icon="arrow-left"
                text="Move to Front"
                onClick={() => moveColumnToFront(columnIndex)}
              />
              <MenuItem
                icon="arrow-right"
                text="Move to Back"
                onClick={() => moveColumnToBack(columnIndex)}
              />
            </Menu>
          )}
        />
      )
    },
    [columnOrder, props.columns, moveColumnToFront, moveColumnToBack]
  )


  return (
    <ScrollBar
      className={clsx(
        props.isDashboard ? 'h-full' : 'h-[500px]',
        'overflow-scroll ph-no-capture'
      )}
    >
      <Table2
        numRows={props.rows.length}
        enableColumnReordering={true}
        enableColumnResizing={true}
        enableRowResizing={false}
          enableGhostCells={false}
        enableFocusedCell={false}
        enableMultipleSelection={true}
        columnWidths={columnWidths}
        onColumnsReordered={handleColumnsReordered}
        loadingOptions={TableLoadingOption.NONE}
        className="!w-full text-xs font-mono"
        cellRendererDependencies={[columnOrder]}
      >
        {columnOrder.map((orderIndex, visibleIndex) => {
          const column = props.columns[orderIndex]
          return (
            <Column
              key={`${column.name}-${orderIndex}`}
              name={column.name}
              cellRenderer={(rowIndex) => cellRenderer(rowIndex, visibleIndex)}
              columnHeaderCellRenderer={() => columnHeaderRenderer(visibleIndex)}
            />
          )
        })}
      </Table2>
    </ScrollBar>
  )
}

export default Table