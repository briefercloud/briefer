import {
  Bars3BottomLeftIcon,
  CalendarIcon,
  FlagIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline'
import {
  DataFrameColumn,
  exhaustiveCheck,
  Json,
  TableSort,
} from '@briefer/types'
import clsx from 'clsx'
import ScrollBar from '@/components/ScrollBar'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/20/solid'

interface Props {
  rows: Record<string, Json>[]
  columns: DataFrameColumn[]
  isDashboard: boolean
  sort: TableSort | null
  onChangeSort: (sort: TableSort | null) => void
  hasTopBorder: boolean
}
function Table(props: Props) {
  const onChangeSort = (column: string) => () => {
    const currentOrder =
      props.sort && props.sort.column === column ? props.sort.order : null
    switch (currentOrder) {
      case 'asc':
        props.onChangeSort({ column, order: 'desc' })
        break
      case 'desc':
        props.onChangeSort(null)
        break
      case null:
        props.onChangeSort({ column, order: 'asc' })
        break
      default:
        exhaustiveCheck(currentOrder)
    }
  }

  return (
    <ScrollBar
      className={clsx(
        props.isDashboard ? 'h-full' : 'max-h-[290px]',
        'overflow-auto ph-no-capture',
        props.hasTopBorder && 'rounded-t-md'
      )}
    >
      <table
        className="!w-full text-xs text-left table-auto border-spacing-0 border-separate font-sans"
        contentEditable={false}
      >
        <thead className="bg-gray-50 sticky top-0">
          <tr className="divide-x">
            {props.columns.map((column, index) => {
              const Icon = getColumnTypeIcon(column.type)
              return (
                <th
                  key={index}
                  scope="col"
                  className={clsx(
                    'p-2 text-gray-500 whitespace-nowrap font-medium border-b hover:bg-gray-100 cursor-pointer',
                    props.hasTopBorder && 'border-t'
                  )}
                  onClick={onChangeSort(column.name.toString())}
                >
                  <div className="flex space-x-2 items-center w-full justify-between">
                    <div className="flex items-center space-x-1">
                      <Icon className="h-3 w-3 text-gray-400" />
                      <span>{column.name}</span>
                    </div>
                    {props.sort && props.sort.column === column.name ? (
                      <>
                        {props.sort.order === 'asc' ? (
                          <ArrowUpIcon className="h-3 w-3" />
                        ) : (
                          <ArrowDownIcon className="h-3 w-3" />
                        )}
                      </>
                    ) : (
                      <ArrowsUpDownIcon className="w-3 h-3 text-gray-300" />
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="bg-white overflow-y-scroll">
          {props.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="divide-x">
              {props.columns.map((column, cellIndex) => {
                const cell = row[column.name]

                return (
                  <td
                    key={cellIndex}
                    className={clsx(
                      rowIndex === props.rows.length - 1 && !props.isDashboard
                        ? 'border-b-0'
                        : 'border-b',
                      'px-2 py-1.5 text-gray-900 whitespace-nowrap border-gray-200 '
                    )}
                  >
                    {cell === null ? (
                      <span className="uppercase text-gray-400">null</span>
                    ) : typeof cell === 'object' ? (
                      JSON.stringify(cell)
                    ) : (
                      cell?.toString()
                    )}
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

export function getColumnTypeIcon(
  type: DataFrameColumn['type']
): typeof FlagIcon {
  if (type.startsWith('datetime64')) {
    return CalendarIcon
  }

  switch (type) {
    case 'byte':
    case 'ubyte':
    case 'short':
    case 'ushort':
    case 'i1':
    case 'i2':
    case 'i4':
    case 'i8':
    case 'int0':
    case 'int':
    case 'Int':
    case 'int8':
    case 'Int8':
    case 'int16':
    case 'Int16':
    case 'int32':
    case 'Int32':
    case 'int64':
    case 'Int64':
    case 'long':
    case 'longlong':
    case 'u1':
    case 'u2':
    case 'u4':
    case 'u8':
    case 'uint0':
    case 'uint8':
    case 'uint16':
    case 'uint32':
    case 'uint64':
    case 'UInt0':
    case 'UInt8':
    case 'UInt16':
    case 'UInt32':
    case 'UInt64':
    case 'uint':
    case 'UInt':
    case 'ulong':
    case 'ULong':
    case 'ulonglong':
    case 'ULongLong':

    case 'timedelta64':
    case 'timedelta64[ns]':
    case 'timedelta64[ns, UTC]':
    case 'timedelta64[us]':
    case 'timedelta64[us, UTC]':

    case 'f2':
    case 'f4':
    case 'f8':
    case 'f16':
    case 'float16':
    case 'float32':
    case 'float64':
    case 'float128':
    case 'Float':
    case 'Float16':
    case 'Float32':
    case 'Float64':
    case 'float':
    case 'longfloat':
    case 'double':
    case 'longdouble':
      return HashtagIcon

    case 'string':
    case 'unicode':
    case 'str':
    case 'bytes':
    case 'bytes0':
    case 'str0':
    case 'str':
    case 'bytes':
    case 'category':
    case 'object':
    case 'object0':
      return Bars3BottomLeftIcon

    case 'dbdate':
    case 'dbtime':
    case 'datetime64':
    case 'datetime64[ns]':
    case 'datetime64[ns, UTC]':
    case 'datetime64[ns, Etc/UTC]':
    case 'datetime64[us]':
    case 'datetime64[us, UTC]':
    case 'datetime64[us, Etc/UTC]':
    case 'period':
    case 'period[Y-DEC]':
    case 'period[Q-DEC]':
    case 'period[M]':
    case 'period[Q]':
    case 'period[W]':
    case 'period[D]':
    case 'period[h]':
    case 'period[min]':
    case 'period[m]':
    case 'period[s]':
    case 'period[ms]':
    case 'period[us]':
    case 'period[ns]':
      return CalendarIcon

    case 'bool':
    case 'bool8':
    case 'b1':
    case 'boolean':
      return FlagIcon
  }
}

export default Table
