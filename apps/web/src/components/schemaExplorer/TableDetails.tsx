import { Columns3Icon } from 'lucide-react'
import { XIcon } from 'lucide-react'
import { useState } from 'react'

type Props = {
  tableName: string
  columns: { name: string; type: string }[]
  onCloseTableDetails: () => void
}

export default function TableDetails(props: Props) {
  const [hovering, setHovering] = useState(false)

  return (
    <div className="flex-1 flex-grow-[2] border-t border-gray-300 shadow-inner flex flex-col h-full overflow-hidden">
      <div className="relative flex px-4 py-2 text-xs font-medium border-b bg-gray-50 text-gray-600 items-center justify-between font-mono group w-full gap-x-1.5">
        <Columns3Icon className="h-3 w-3 text-gray-500" />
        <div className="pr-2 flex-grow overflow-x-hidden">
          <h4 className="overflow-x-scroll">{props.tableName}</h4>
        </div>
        <button
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onClick={props.onCloseTableDetails}
        >
          <XIcon
            strokeWidth={hovering ? 2 : 1}
            className="h-3 w-3 text-gray-500 hover:text-gray-800"
          />
        </button>
      </div>

      <div className="text-xs text-gray-500 font-mono overflow-y-scroll flex-grow">
        <ul className="flex flex-col">
          {props.columns.map((column) => {
            return (
              <li
                key={column.name}
                className="px-4 py-2.5 border-b border-gray-200 hover:bg-gray-50 flex items-center justify-between"
              >
                <div className="pr-2 flex-grow overflow-x-hidden">
                  {/* TODO we need to figure out all possible type names to select appropriate icons every time */}
                  <h5 className="font-mono text-xs text-gray-600 overflow-x-scroll">
                    {column.name}
                  </h5>
                </div>
                <div className="uppercase text-xs text-gray-400 min-w-16 text-right">
                  {column.type}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
