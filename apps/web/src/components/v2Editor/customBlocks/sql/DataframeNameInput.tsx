import {
  ExclamationCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/solid'
import * as Y from 'yjs'
import { ExecutionQueue, SQLBlock } from '@briefer/editor'
import { useCallback } from 'react'
import clsx from 'clsx'
import { useBlockExecutions } from '@/hooks/useBlockExecution'
import { head } from 'ramda'

function queryNameErrorMessage(
  err: SQLBlock['dataframeName']['error']
): React.ReactNode {
  switch (err) {
    case 'invalid-name':
      return (
        <>
          The dataframe name must be a valid Python variable name:
          <br />
          It should start with a letter or underscore, followed by letters,
          digits, or underscores. Spaces are not allowed.
        </>
      )
    case 'unexpected':
      return (
        <>
          Unexpected error occurred while renaming the dataframe. Click this
          icon to retry.
        </>
      )
  }
}

interface Props {
  block: Y.XmlElement<SQLBlock>
  disabled?: boolean
  userId: string | null
  executionQueue: ExecutionQueue
}
function DataframeNameInput(props: Props) {
  const executions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'sql-rename-dataframe'
  )
  const execution = head(executions)
  const dataframeName = props.block.getAttribute('dataframeName')

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!dataframeName) {
        return
      }

      props.block.setAttribute('dataframeName', {
        ...dataframeName,
        newValue: e.target.value,
      })
    },
    [props.block, dataframeName]
  )

  const onBlur = useCallback(() => {
    if (!dataframeName) {
      return
    }

    for (const { item } of executions) {
      item.setAborting()
    }
    props.executionQueue.enqueueBlock(props.block, props.userId, {
      _tag: 'sql-rename-dataframe',
    })
  }, [props.block, dataframeName, props.executionQueue, props.userId])

  const onRetry = useCallback(() => {
    if (!dataframeName) {
      return
    }

    props.block.setAttribute('dataframeName', {
      ...dataframeName,
      error: undefined,
    })
    for (const { item } of executions) {
      item.setAborting()
    }
    props.executionQueue.enqueueBlock(props.block, props.userId, {
      _tag: 'sql-rename-dataframe',
    })
  }, [dataframeName, props.block, props.executionQueue, props.userId])

  const status = execution?.item.getStatus() ?? { _tag: 'idle' }

  if (!dataframeName) {
    return <div>Missing dataframe name in block</div>
  }

  return (
    <div className="relative min-w-[124px]">
      <input
        type="text"
        className={clsx(
          dataframeName.error
            ? 'ring-red-200 focus:ring-red-200'
            : 'ring-gray-200 focus:ring-gray-400',
          'pl-2 pr-6 block w-full rounded-md border-0 text-gray-500 ring-1 ring-inset placeholder:text-gray-400 focus:ring-inset h-6 py-0 text-xs disabled:cursor-not-allowed disabled:cursor-not-allowed bg-transparent'
        )}
        placeholder="Dataframe name"
        value={dataframeName.newValue}
        onChange={onChange}
        disabled={props.disabled || status._tag !== 'idle'}
        onBlur={onBlur}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 group">
        {dataframeName.error ? (
          <>
            <button
              disabled={dataframeName.error !== 'unexpected'}
              onClick={onRetry}
            >
              <ExclamationCircleIcon
                className="h-4 w-4 text-red-300"
                aria-hidden="true"
              />
            </button>

            <div className="scale-0 font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity group-hover:scale-100 group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 w-72">
              <span className="inline-flex gap-x-1 items-center text-gray-400">
                <span>{queryNameErrorMessage(dataframeName.error)}</span>
              </span>
            </div>
          </>
        ) : (
          <>
            <QuestionMarkCircleIcon
              className="h-4 w-4 text-gray-300"
              aria-hidden="true"
            />

            <div className="font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity scale-0 group-hover:scale-100 group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 w-72">
              <span className="inline-flex gap-x-1 items-center text-gray-400 text-center">
                Use this variable name to reference the results as a Pandas
                dataframe in further Python blocks.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DataframeNameInput
