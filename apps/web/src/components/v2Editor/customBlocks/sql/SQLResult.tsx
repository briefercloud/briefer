import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import PageButtons from '@/components/PageButtons'
import Spin from '@/components/Spin'
import { useCSV } from '@/hooks/useQueryCSV'
import {
  migrateSuccessSQLResult,
  PythonErrorRunQueryResult,
  RunQueryResult,
  SuccessRunQueryResult,
  SyntaxErrorRunQueryResult,
  TableSort,
} from '@briefer/types'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo } from 'react'
import Table from './Table'
import LargeSpinner from '@/components/LargeSpinner'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid'
import { ArrowDownTrayIcon } from '@heroicons/react/24/solid'
import { Tooltip } from '@/components/Tooltips'

function formatMs(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`
  }

  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`
  }

  return `${(ms / 60000).toFixed(2)}m`
}

interface Props {
  blockId: string
  documentId: string
  workspaceId: string
  result: RunQueryResult
  page: number
  loadingPage: boolean
  dataframeName: string
  isPublic: boolean
  isResultHidden: boolean
  toggleResultHidden: () => void
  isFixingWithAI: boolean
  onFixWithAI: () => void
  dashboardMode: 'live' | 'editing' | 'none'
  canFixWithAI: boolean
  sort: TableSort | null
  onChangeSort: (sort: TableSort | null) => void
  onChangePage: (page: number) => void
}
function SQLResult(props: Props) {
  switch (props.result.type) {
    case 'success':
      return (
        <SQLSuccess
          result={props.result}
          page={props.page}
          isPublic={props.isPublic}
          documentId={props.documentId}
          workspaceId={props.workspaceId}
          dataframeName={props.dataframeName}
          isResultHidden={props.isResultHidden}
          toggleResultHidden={props.toggleResultHidden}
          blockId={props.blockId}
          dashboardMode={props.dashboardMode}
          sort={props.sort}
          onChangeSort={props.onChangeSort}
          loadingPage={props.loadingPage}
          onChangePage={props.onChangePage}
        />
      )
    case 'abort-error':
      return <SQLAborted />
    case 'syntax-error':
      return (
        <SQLSyntaxError
          result={props.result}
          isFixingWithAI={props.isFixingWithAI}
          onFixWithAI={props.onFixWithAI}
          canFixWithAI={props.canFixWithAI}
          dashboardMode={props.dashboardMode}
          toggleResultHidden={props.toggleResultHidden}
          isResultHidden={props.isResultHidden}
        />
      )
    case 'python-error':
      return (
        <SQLPythonError
          result={props.result}
          dashboardMode={props.dashboardMode}
          toggleResultHidden={props.toggleResultHidden}
          isResultHidden={props.isResultHidden}
        />
      )
  }
}

interface SQLSuccessProps {
  blockId: string
  documentId: string
  workspaceId: string
  page: number
  loadingPage: boolean
  result: SuccessRunQueryResult
  onChangePage: (page: number) => void
  isPublic: boolean
  dataframeName: string
  isResultHidden: boolean
  toggleResultHidden: () => void
  dashboardMode: 'live' | 'editing' | 'none'
  sort: TableSort | null
  onChangeSort: (sort: TableSort | null) => void
}
function SQLSuccess(props: SQLSuccessProps) {
  const result = useMemo(
    () => migrateSuccessSQLResult(props.result),
    [props.result]
  )

  const prevPage = useCallback(() => {
    props.onChangePage(Math.max(0, result.page - 1))
  }, [props.onChangePage, result.page])

  const nextPage = useCallback(() => {
    props.onChangePage(Math.min(result.page + 1, result.pageCount - 1))
  }, [props.onChangePage, result.page])

  const setPage = useCallback(
    (page: number) => {
      props.onChangePage(Math.max(0, Math.min(page, result.pageCount - 1)))
    },
    [props.onChangePage, result.pageCount]
  )

  const [csvRes, getCSV] = useCSV(props.workspaceId, props.documentId)
  const onDownloadCSV = useCallback(() => {
    getCSV(props.blockId, props.dataframeName)
  }, [getCSV, props.blockId, props.dataframeName])

  useEffect(() => {
    if (csvRes.loading) {
      return
    }

    if (csvRes.data) {
      const url = URL.createObjectURL(csvRes.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${props.dataframeName}.csv`
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        a.remove()
      }, 1000)
    }

    if (csvRes.error) {
      alert('Something went wrong')
    }
  }, [csvRes, props.dataframeName])

  return (
    <div className="relative w-full h-full">
      {props.loadingPage && (
        <div className="absolute top-0 left-0 bottom-8 right-0 bg-white opacity-50 z-10 flex items-center justify-center">
          <LargeSpinner color="#deff80" />
        </div>
      )}
      <div
        className={clsx(
          props.dashboardMode !== 'none'
            ? 'h-[calc(100%-2rem)]'
            : 'h-full border-t border-gray-100',
          'max-w-full ph-no-capture bg-white font-sans rounded-b-md'
        )}
      >
        {props.dashboardMode === 'none' && (
          <div className="p-3 text-xs text-gray-300 flex items-center gap-x-0.5 justify-between">
            <div className="flex">
              <button
                className="print:hidden h-4 w-4 hover:text-gray-400 rounded-sm"
                onClick={props.toggleResultHidden}
              >
                {props.isResultHidden ? (
                  <ChevronRightIcon />
                ) : (
                  <ChevronDownIcon />
                )}
              </button>
              <span className="print:hidden pl-1.5">
                {props.isResultHidden ? 'Results collapsed' : 'Query results'}
              </span>
            </div>

            <span>
              {result.count} {result.count === 1 ? 'row' : 'rows'}
              {typeof result.queryDurationMs === 'number' &&
                ` · ${formatMs(result.queryDurationMs)}`}
            </span>
          </div>
        )}
        {props.isResultHidden && props.dashboardMode === 'none' ? null : (
          <Table
            rows={result.rows}
            columns={props.result.columns}
            isDashboard={props.dashboardMode !== 'none'}
            sort={props.sort}
            onChangeSort={props.onChangeSort}
          />
        )}
      </div>

      {props.isResultHidden && props.dashboardMode === 'none' ? null : (
        <div className="flex w-full items-center justify-between border-t border-gray-200 px-3 py-1.5 bg-gray-50 text-xs font-syne rounded-b-md">
          <div className="text-gray-400">
            <PageButtons
              currentPage={props.page}
              totalPages={result.pageCount}
              prevPage={prevPage}
              nextPage={nextPage}
              setPage={setPage}
              loading={props.loadingPage}
              isPublic={props.isPublic}
            />
          </div>
          <div
            className={clsx(
              'print:hidden group/csv-btn relative',
              props.isPublic ? 'hidden' : 'block'
            )}
          >
            <button
              disabled={csvRes.loading}
              className={clsx(
                csvRes.loading
                  ? 'bg-gray-100'
                  : 'bg-primary-100 hover:bg-primary-200 border border-primary-300',
                'py-0.5 px-1 rounded-sm text-primary-600 flex items-center gap-x-1'
              )}
              onClick={onDownloadCSV}
            >
              {csvRes.loading ? (
                <Spin />
              ) : (
                <ArrowDownTrayIcon className="h-3 w-3" />
              )}
            </button>
            {props.dashboardMode !== 'editing' && (
              <div
                className={clsx(
                  'font-sans pointer-events-none absolute -top-1 -translate-y-full w-max opacity-0 transition-opacity group-hover/csv-btn:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1',
                  props.dashboardMode === 'live'
                    ? 'right-0'
                    : '-translate-x-1/2 left-1/2'
                )}
              >
                <span>Download as CSV</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SQLAborted() {
  return (
    <div className="text-xs border-t p-4">
      <div className="flex border border-red-300 p-2 gap-x-3 items-center">
        <ExclamationTriangleIcon className="text-red-500 h-6 w-6" />
        <div>
          <h4 className="font-semibold">Query aborted.</h4>
        </div>
      </div>
    </div>
  )
}

function SQLSyntaxError(props: {
  result: SyntaxErrorRunQueryResult
  isFixingWithAI: boolean
  onFixWithAI?: () => void
  canFixWithAI: boolean
  dashboardMode: 'live' | 'editing' | 'none'
  isResultHidden: boolean
  toggleResultHidden: () => void
}) {
  return (
    <div className="text-xs border-t">
      {props.dashboardMode === 'none' && (
        <div className="p-3 text-xs text-gray-300 flex items-center justify-between">
          <div className="flex gap-x-1.5 items-center">
            <button
              className="print:hidden h-4 w-4 hover:text-gray-400 rounded-sm"
              onClick={props.toggleResultHidden}
            >
              {props.isResultHidden ? (
                <ChevronRightIcon />
              ) : (
                <ChevronDownIcon />
              )}
            </button>

            <span className="font-sans">
              {props.isResultHidden ? 'Output collapsed' : 'Output'}
            </span>
          </div>

          <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[12px] text-red-700 ring-1 ring-inset ring-red-600/10">
            contains errors
          </span>
        </div>
      )}

      <div
        className={clsx(
          'px-3.5 pb-4 pt-0.5',
          props.isResultHidden && props.dashboardMode === 'none'
            ? 'hidden'
            : 'block'
        )}
      >
        <div className="flex border border-red-300 p-4 gap-x-3 word-wrap">
          <div className="w-full">
            <span className="flex items-center gap-x-2 pb-2">
              <ExclamationTriangleIcon className="text-red-500 h-6 w-6" />
              <h4 className="font-semibold mb-2">
                Your query could not be executed
              </h4>
            </span>
            <p>We received the following error:</p>
            <pre className="whitespace-pre-wrap ph-no-capture overflow-hidden">
              {props.result.message}
            </pre>
            {props.onFixWithAI && (
              <Tooltip
                title="Missing OpenAI API key"
                message="Admins can add an OpenAI key in settings."
                className="inline-block"
                tooltipClassname="w-40 text-center"
                position="top"
                active={!props.canFixWithAI}
              >
                <button
                  disabled={!props.canFixWithAI}
                  onClick={props.onFixWithAI}
                  className="mt-4 flex items-center border rounded-sm px-2 py-1 gap-x-2 font-syne border-gray-200 hover:bg-gray-50 hover:text-gray-700 disabled:bg-gray-200 disabled:border-0 disabled:cursor-not-allowed"
                >
                  {props.isFixingWithAI ? (
                    <>
                      <Spin />
                      Fixing - click to cancel
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-3 h-3" />
                      Fix with AI
                    </>
                  )}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SQLPythonError(props: {
  result: PythonErrorRunQueryResult
  dashboardMode: 'live' | 'editing' | 'none'
  isResultHidden: boolean
  toggleResultHidden: () => void
}) {
  return (
    <div className="text-xs border-t">
      {props.dashboardMode === 'none' && (
        <div className="p-3 text-xs text-gray-300 flex items-center justify-between">
          <div className="flex gap-x-1.5 items-center">
            <button
              className="print:hidden h-4 w-4 hover:text-gray-400 rounded-sm"
              onClick={props.toggleResultHidden}
            >
              {props.isResultHidden ? (
                <ChevronRightIcon />
              ) : (
                <ChevronDownIcon />
              )}
            </button>

            <span className="font-sans">
              {props.isResultHidden ? 'Output collapsed' : 'Output'}
            </span>
          </div>

          <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[12px] text-red-700 ring-1 ring-inset ring-red-600/10">
            contains errors
          </span>
        </div>
      )}

      <div
        className={clsx(
          'px-3.5 pb-4 pt-0.5',
          props.isResultHidden && props.dashboardMode === 'none'
            ? 'hidden'
            : 'block'
        )}
      >
        <div className="flex border border-red-300 p-4 gap-x-3 text-xs overflow-hidden word-wrap">
          <div className="w-full">
            <span className="flex items-center gap-x-2 pb-2">
              <ExclamationTriangleIcon className="text-red-500 h-6 w-6" />
              <h4 className="font-semibold">Your code could not be executed</h4>
            </span>
            <p>We received the following error:</p>
            <pre className="whitespace-pre-wrap ph-no-capture">
              {props.result.ename} - {props.result.evalue}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SQLResult
