import * as Y from 'yjs'
import React from 'react'
import { PlayIcon, StopIcon } from '@heroicons/react/20/solid'
import { useYDocState } from '@/hooks/useYDoc'
import {
  YRunAll,
  getRunAll,
  getRunAllAttributes,
  isRunAllLoading,
} from '@briefer/editor'
import { useCallback } from 'react'
import clsx from 'clsx'

interface Props {
  disabled: boolean
  yDoc: Y.Doc
  primary: boolean
}

export default function RunAllV2(props: Props) {
  const { state } = useYDocState<YRunAll>(props.yDoc, getRunAll)

  const run = useCallback(() => {
    state.value.setAttribute('status', 'run-requested')
  }, [state])

  const abort = useCallback(() => {
    state.value.setAttribute('status', 'abort-requested')
  }, [state])

  const onClick = useCallback(() => {
    if (isRunAllLoading(state.value)) {
      abort()
    } else {
      run()
    }
  }, [state, run, abort])

  const {
    total,
    remaining,
    status: docRunStatus,
  } = getRunAllAttributes(state.value)
  const current = total - remaining

  const loading = isRunAllLoading(state.value)

  return (
    <button
      type="button"
      className={clsx(
        {
          'bg-gray-200 cursor-not-allowed':
            props.disabled ||
            docRunStatus === 'abort-requested' ||
            docRunStatus === 'aborting' ||
            docRunStatus === 'schedule-running',
          'bg-primary-200 hover:bg-primary-300':
            !props.disabled && !loading && props.primary,
          'bg-white hover:bg-gray-100 ring-1 ring-gray-200 text-gray-500':
            !props.disabled && !loading && !props.primary,
          'bg-red-200 hover:bg-red-300':
            !props.disabled &&
            loading &&
            (docRunStatus === 'run-requested' || docRunStatus === 'running'),
        },
        'flex items-center rounded-sm px-3 py-1 text-sm gap-x-1.5 fixed mt-3 right-8 z-10'
      )}
      onClick={onClick}
      disabled={props.disabled || docRunStatus === 'schedule-running'}
    >
      {loading ? (
        <>
          <StopIcon className="h-4 w-4" />
          {docRunStatus === 'run-requested' || docRunStatus === 'running'
            ? `Running (${current}/${total})`
            : docRunStatus === 'schedule-running'
              ? `Running schedule (${current}/${total})`
              : 'Stopping'}
        </>
      ) : (
        <>
          <PlayIcon className="h-4 w-4" /> Run all
        </>
      )}
    </button>
  )
}
