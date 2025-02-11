import LargeSpinner from '@/components/LargeSpinner'
import { PivotTableBlock } from '@briefer/editor'
import { DataFrame, PivotTableResult, PivotTableSort } from '@briefer/types'
import {
  ChevronDoubleRightIcon,
  ChevronDoubleLeftIcon,
  CubeTransparentIcon,
} from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import PivotTable from './PivotTable'
import PageButtons from '@/components/PageButtons'
import { DashboardMode, dashboardModeHasControls } from '@/components/Dashboard'

interface Props {
  pivotRows: PivotTableBlock['rows']
  pivotColumns: PivotTableBlock['columns']
  pivotMetrics: PivotTableBlock['metrics']
  result: PivotTableResult | null
  page: number
  onPrevPage: () => void
  onNextPage: () => void
  setPage: (page: number) => void
  error: PivotTableBlock['error']
  loadingPage: boolean
  loadingTable: boolean
  dataframe: DataFrame | null
  onNewSQL: () => void
  controlsHidden: boolean
  onToggleControlsHidden: () => void
  dashboardMode: DashboardMode | null
  isEditable: boolean
  sort: PivotTableSort | null
  onSort: (sort: PivotTableSort | null) => void
}
function PivotTableView(props: Props) {
  return (
    <div
      className={clsx(
        !props.controlsHidden &&
          (!props.dashboardMode ||
            dashboardModeHasControls(props.dashboardMode))
          ? 'w-2/3'
          : 'w-full',
        'flex-grow h-full flex relative'
      )}
    >
      {props.result && !props.loadingTable && !props.error ? (
        <>
          {props.loadingPage && (
            <div className="absolute top-0 left-0 bottom-8 right-0 bg-white opacity-50 z-10 flex items-center justify-center">
              <LargeSpinner color="#deff80" />
            </div>
          )}
          <div className="w-full h-full flex flex-col">
            <PivotTable
              result={props.result}
              sort={props.sort}
              onSort={props.onSort}
            />
            {props.result.pageCount > 1 && (
              <div className="flex w-full items-center justify-between border-t border-gray-200 px-3 py-1.5 text-xs font-syne rounded-b-md bg-gray-50">
                <PageButtons
                  currentPage={props.page - 1}
                  totalPages={props.result.pageCount - 1}
                  prevPage={props.onPrevPage}
                  nextPage={props.onNextPage}
                  setPage={props.setPage}
                  loading={props.loadingPage}
                  isPublic={false}
                />
              </div>
            )}
          </div>
        </>
      ) : props.loadingTable ? (
        <div className="absolute top-0 left-0 h-full w-full flex flex-col items-center justify-center bg-ceramic-50/60 ">
          <LargeSpinner color="#b8f229" />
        </div>
      ) : (
        <div className="flex flex-col h-full w-full space-y-6 items-center justify-center bg-ceramic-50/30">
          {props.error === 'dataframe-not-found' && props.dataframe ? (
            <div className="flex flex-col items-center justify-center gap-y-2">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-300" />
              <div className="flex flex-col items-center text-sm text-gray-300 gap-y-2">
                <div>
                  <span className="font-mono">{props.dataframe.name}</span> not
                  found.
                </div>
                <div>
                  Try running the block for{' '}
                  <span className="font-mono">{props.dataframe.name}</span>{' '}
                  again.
                </div>
              </div>
            </div>
          ) : props.error === 'unknown' ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-300" />
              <span className="text-lg text-gray-300">
                Something went wrong
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <CubeTransparentIcon className="h-12 w-12 text-gray-300" />
              <span className="text-lg text-gray-300">No data</span>
              {!props.dataframe && (
                <button
                  className="text-xs text-gray-300 hover:underline"
                  onClick={props.onNewSQL}
                >
                  Add a SQL block to fetch data to visualize.
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {(!props.dashboardMode ||
        dashboardModeHasControls(props.dashboardMode)) &&
        props.isEditable && (
          <button
            className={clsx(
              'absolute bottom-0 bg-white rounded-tr-md border-t border-r border-gray-200 p-2 hover:bg-gray-50 z-10',
              props.controlsHidden ? 'left-0 rounded-bl-md' : '-left-[1px]'
            )}
            onClick={props.onToggleControlsHidden}
          >
            {props.controlsHidden ? (
              <ChevronDoubleRightIcon className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDoubleLeftIcon className="h-4 w-4 text-gray-400" />
            )}
          </button>
        )}
    </div>
  )
}

export default PivotTableView
