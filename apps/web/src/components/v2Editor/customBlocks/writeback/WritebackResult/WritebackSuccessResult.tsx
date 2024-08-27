import { DataSource } from '@briefer/database'
import { WriteBackSuccessResult } from '@briefer/types'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

interface WritebackSuccessResultProps {
  result: WriteBackSuccessResult
  dataSources: DataSource[]
}
function WritebackSuccessResult(props: WritebackSuccessResultProps) {
  const datasource = props.dataSources.find(
    (ds) => ds.data.id === props.result.dataSourceId
  )

  return (
    <div className="p-1.5 h-full">
      <div className="flex flex-col border border-green-700 p-4 h-full">
        <div className="flex items-center space-x-1">
          <CheckCircleIcon className="w-4 h-4 text-green-700" />
          <span className="text-xs text-gray-800 font-medium">
            Writeback successful.
          </span>
        </div>

        <div className="flex-1 flex items-center">
          <div className="w-full overflow-x-auto">
            <div className="inline-block min-w-full p-0.5 align-middle">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-sm">
                <table className="min-w-full divide-y divide-gray-300">
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {[
                      ['Target', datasource?.data.name ?? 'Unknown target'],
                      ['Table', props.result.tableName],
                      ['Overwritten', props.result.overwritten ? 'Yes' : 'No'],
                      ['Lines created', props.result.insertedRows],
                      ['Lines updated', props.result.updatedRows],
                      ['Lines ignored', props.result.ignoredRows],
                    ].map(([label, value]) => (
                      <tr className="divide-x divide-gray-200">
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-xs font-medium text-gray-900 bg-gray-50">
                          {label}
                        </td>
                        <td className="break-all py-3 pl-3 pr-4 text-xs text-gray-500">
                          {value}
                        </td>
                      </tr>
                    ))}
                    {false && (
                      <>
                        <tr className="divide-x divide-gray-200">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs font-medium text-gray-900 sm:pl-6 bg-gray-50">
                            Target
                          </td>
                          <td className="whitespace-nowrap py-4 pl-3 pr-4 text-xs text-gray-500">
                            {datasource?.data.name ?? 'Unknown target'}
                          </td>
                        </tr>
                        <tr className="divide-x divide-gray-200">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs font-medium text-gray-900 sm:pl-6 bg-gray-50">
                            Table
                          </td>
                          <td className="px-3 py-4 text-xs text-gray-500 break-all">
                            {props.result.tableName}
                          </td>
                        </tr>
                        <tr className="divide-x divide-gray-200">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs font-medium text-gray-900 sm:pl-6 bg-gray-50">
                            Overwritten
                          </td>
                          <td className="px-3 py-4 text-xs text-gray-500 break-all">
                            {props.result.overwritten ? 'Yes' : 'No'}
                          </td>
                        </tr>
                        <tr className="divide-x divide-gray-200">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs font-medium text-gray-900 sm:pl-6 bg-gray-50">
                            Lines created
                          </td>
                          <td className="px-3 py-4 text-xs text-gray-500 break-all">
                            {props.result.insertedRows}
                          </td>
                        </tr>
                        <tr className="divide-x divide-gray-200">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs font-medium text-gray-900 sm:pl-6 bg-gray-50">
                            Lines updated
                          </td>
                          <td className="px-3 py-4 text-xs text-gray-500 break-all">
                            {props.result.updatedRows}
                          </td>
                        </tr>
                        <tr className="divide-x divide-gray-200">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs font-medium text-gray-900 sm:pl-6 bg-gray-50">
                            Lines ignored
                          </td>
                          <td className="px-3 py-4 text-xs text-gray-500 break-all">
                            {props.result.ignoredRows}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {false && (
          <div className="flex flex-col divide-y bg-gray-100 rounded-md border border-gray-200 text-xs">
            <div className="flex divide-x">
              <div className="w-[30%] px-2 py-2">Target</div>
              <div className="flex-1 text-right px-2 py-2 bg-white">
                {datasource?.data.name ?? 'Unknown target'}
              </div>
            </div>
            <div className="flex divide-x">
              <div className="w-[30%] px-2 py-2">Table</div>
              <div className="flex-1 text-right px-4 py-2 break-all bg-white">
                {props.result.tableName}
              </div>
            </div>
            <div className="flex divide-x">
              <div className="w-[30%] px-4 py-2">Overwritten</div>
              <div className="flex-1 text-right px-4 py-2 break-all bg-white">
                {props.result.overwritten ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="flex divide-x">
              <div className="w-[30%] px-4 py-2">Lines created</div>
              <div className="flex-1 text-right px-4 py-2 bg-white">
                {props.result.insertedRows}
              </div>
            </div>
            <div className="flex divide-x">
              <div className="w-[30%] px-4 py-2">Lines updated</div>
              <div className="flex-1 text-right px-4 py-2 bg-white">
                {props.result.updatedRows}
              </div>
            </div>
            <div className="flex divide-x">
              <div className="w-[30%] px-4 py-2">Lines ignored</div>
              <div className="flex-1 text-right px-4 py-2 bg-white">
                {props.result.ignoredRows}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WritebackSuccessResult
