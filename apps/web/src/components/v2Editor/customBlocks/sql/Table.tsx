import { DataFrameColumn, Json } from '@briefer/types'
import clsx from 'clsx'
import ScrollBar from '@/components/ScrollBar'

interface Props {
  rows: Record<string, Json>[]
  columns: DataFrameColumn[]
  isDashboard: boolean
}
function Table(props: Props) {
  return (
    <ScrollBar
      className={clsx(
        props.isDashboard ? 'h-full' : 'max-h-[290px]',
        'overflow-auto ph-no-capture'
      )}
    >
      <table
        className="!w-full text-xs text-left table-auto border-spacing-0 border-separate font-mono"
        contentEditable={false}
      >
        <thead className="bg-gray-50 sticky top-0">
          <tr className="divide-x">
            {props.columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={clsx(
                  props.isDashboard ? 'border-b' : 'border-y',
                  'px-2 py-1.5 text-gray-500 whitespace-nowrap font-normal'
                )}
              >
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white overflow-y-scroll max-h-[500px]">
          {props.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="divide-x">
              {props.columns.map((column, cellIndex) => {
                const cell = row[column.name]

                return (
                  <td
                    key={cellIndex}
                    className={clsx(
                      rowIndex === props.rows.length - 1
                        ? 'border-b-0'
                        : 'border-b',
                      'px-2 py-1.5 text-gray-900 whitespace-nowrap border-gray-200 '
                    )}
                  >
                    {typeof cell === 'object'
                      ? JSON.stringify(cell)
                      : cell?.toString()}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollBar>
  )
}

export default Table
