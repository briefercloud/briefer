import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import PageButtons from '@/components/PageButtons'
import Spin from '@/components/Spin'
import { useCSV } from '@/hooks/useQueryCSV'
import {
  PythonErrorRunQueryResult,
  RunQueryResult,
  SuccessRunQueryResult,
  SyntaxErrorRunQueryResult,
  TableSort,
} from '@briefer/types'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Table from './Table'
import { fromPairs, splitEvery, map } from 'ramda'
import useResettableState from '@/hooks/useResettableState'
import LargeSpinner from '@/components/LargeSpinner'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid'
import { ArrowDownTrayIcon } from '@heroicons/react/24/solid'
import { Tooltip } from '@/components/Tooltips'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import qs from 'querystring'

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
}
function SQLResult(props: Props) {
  switch (props.result.type) {
    case 'success':
      return (
        <SQLSuccess
          result={props.result}
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
  result: SuccessRunQueryResult
  isPublic: boolean
  dataframeName: string
  isResultHidden: boolean
  toggleResultHidden: () => void
  dashboardMode: 'live' | 'editing' | 'none'
  sort: TableSort | null
  onChangeSort: (sort: TableSort | null) => void
}
function SQLSuccess(props: SQLSuccessProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const rowsPerPage = 50
  const totalPages = Math.ceil(props.result.count / rowsPerPage)
  const [pages, setPages] = useResettableState(
    () =>
      fromPairs(
        splitEvery(rowsPerPage, props.result.rows).map((rows, i) => [
          i,
          { rows, status: 'success' },
        ])
      ),
    [rowsPerPage, props.result.rows]
  )

  useEffect(() => {
    setPages((pages) => map((page) => ({ ...page, status: 'loading' }), pages))
  }, [props.sort])

  const currentRows = useMemo(() => {
    if (
      pages[currentPageIndex] &&
      pages[currentPageIndex].status === 'success'
    ) {
      return pages[currentPageIndex].rows
    }

    let prevPage = currentPageIndex - 1
    while (prevPage >= 0 && !pages[prevPage]) {
      prevPage--
    }

    return pages[prevPage]?.rows ?? []
  }, [currentPageIndex, props.result.rows, rowsPerPage, pages])

  useEffect(() => {
    if (pages[currentPageIndex]) {
      return
    }

    setPages((p) => ({
      ...p,
      [currentPageIndex]: { rows: [], status: 'loading' },
    }))
  }, [currentPageIndex, pages, setPages])

  useEffect(() => {
    if (
      !pages[currentPageIndex] ||
      pages[currentPageIndex].status !== 'loading'
    ) {
      return
    }

    const args: Record<string, string | number> = {
      page: currentPageIndex,
      pageSize: rowsPerPage,
      dataframeName: props.dataframeName,
    }

    if (props.sort) {
      args['sortColumn'] = props.sort.column
      args['sortOrder'] = props.sort.order
    }

    fetch(
      `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${props.workspaceId}/documents/${
        props.documentId
      }/queries/${props.blockId}?${qs.stringify(args)}`,
      {
        credentials: 'include',
      }
    )
      .then(async (res) => {
        if (res.status === 404) {
          setPages((p) => ({
            ...p,
            [currentPageIndex]: {
              ...(p[currentPageIndex] ?? { rows: [] }),
              status: 'not-found',
            },
          }))
          return
        }

        if (res.status !== 200) {
          setPages((p) => ({
            ...p,
            [currentPageIndex]: {
              ...(p[currentPageIndex] ?? { rows: [] }),
              status: 'unknown-error',
            },
          }))
          return
        }

        const parsedBody = RunQueryResult.safeParse(await res.json())
        if (!parsedBody.success) {
          setPages((p) => ({
            ...p,
            [currentPageIndex]: {
              ...(p[currentPageIndex] ?? { rows: [] }),
              status: 'unknown-error',
            },
          }))
          return
        }

        const data = parsedBody.data
        if (data.type !== 'success') {
          setPages((p) => ({
            ...p,
            [currentPageIndex]: {
              ...(p[currentPageIndex] ?? { rows: [] }),
              status: 'unknown-error',
            },
          }))
          return
        }

        setPages((p) => ({
          ...p,
          [currentPageIndex]: {
            rows: data.rows,
            status: 'success',
          },
        }))
      })
      .catch(() => {
        setPages((p) => ({
          ...p,
          [currentPageIndex]: {
            ...(p[currentPageIndex] ?? { rows: [] }),
            status: 'unknown-error',
          },
        }))
      })
  }, [
    pages,
    currentPageIndex,
    props.blockId,
    props.dataframeName,
    props.documentId,
    props.workspaceId,
    rowsPerPage,
    props.sort,
  ])

  const prevPage = useCallback(() => {
    setCurrentPageIndex((prev) => Math.max(0, prev - 1))
  }, [setCurrentPageIndex])
  const nextPage = useCallback(() => {
    setCurrentPageIndex((prev) => {
      if (prev + 1 > totalPages) {
        return 0
      }

      return prev + 1
    })
  }, [setCurrentPageIndex, totalPages])
  const setPage = useCallback(
    (page: number) => {
      setCurrentPageIndex(
        Math.max(0, Math.min(page, Math.ceil(totalPages) - 1))
      )
    },
    [setCurrentPageIndex, totalPages]
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

  const onRetryPage = useCallback(() => {
    setPages((p) => ({
      ...p,
      [currentPageIndex]: { rows: [], status: 'loading' },
    }))
  }, [currentPageIndex])

  const currentPage = pages[currentPageIndex]

  return (
    <div className="relative w-full h-full">
      {currentPage?.status === 'loading' ? (
        <div className="absolute top-0 left-0 bottom-8 right-0 bg-white opacity-50 z-10 flex items-center justify-center">
          <LargeSpinner color="#deff80" />
        </div>
      ) : currentPage?.status === 'not-found' ? (
        <div className="absolute top-1 left-1 bottom-8 right-0 bg-white z-10 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center space-y-2">
            <ExclamationTriangleIcon className="h-12 w-12 text-gray-300" />
            <span className="text-lg text-gray-300">
              Dataframe not found, run the query again.
            </span>
          </div>
        </div>
      ) : currentPage?.status === 'unknown-error' ? (
        <div className="absolute top-1 left-1 bottom-8 right-0 bg-white z-10 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center space-y-2">
            <ExclamationTriangleIcon className="h-12 w-12 text-gray-300" />
            <span className="text-lg text-gray-300">Something went wrong.</span>
            <button
              className="text-gray-300 hover:underline"
              onClick={onRetryPage}
            >
              Click here to retry.
            </button>
          </div>
        </div>
      ) : null}

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
              {props.result.count} {props.result.count === 1 ? 'row' : 'rows'}
              {typeof props.result.durationMs === 'number' &&
                ` · ${formatMs(props.result.durationMs)}`}
            </span>
          </div>
        )}
        {props.isResultHidden && props.dashboardMode === 'none' ? null : (
          <Table
            rows={currentRows}
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
              currentPage={currentPageIndex}
              totalPages={totalPages}
              prevPage={prevPage}
              nextPage={nextPage}
              setPage={setPage}
              loading={false}
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
