import { getPrettyStep, getValidationErrorMessage } from '@briefer/editor'
import { XCircleIcon } from '@heroicons/react/24/outline'
import Ansi from '@cocalc/ansi-to-react'
import { PythonErrorOutput, WriteBackErrorResult } from '@briefer/types'
import ScrollBar from '@/components/ScrollBar'

function renderError(result: WriteBackErrorResult): JSX.Element {
  if (result.reason === 'python-error') {
    return (
      <PythonError
        ename={result.ename}
        evalue={result.evalue}
        step={result.step}
      />
    )
  }

  if (result.reason === 'overwrite-empty-dataframe') {
    return (
      <p className="pb-4 text-xs text-gray-800">
        Cannot overwrite table with empty dataframe.
      </p>
    )
  }

  switch (result.step) {
    case 'validation':
      if (result.reason === 'invalid-table-template') {
        return <InvalidTemplateError error={result.pythonError} />
      }

      if (result.reason === 'invalid-conflict-columns') {
        return (
          <p className="pb-4 text-xs text-gray-800">
            {`We couldn't find these columns in the selected dataframe: `}
            {result.columns.map((c, i) => (
              <span>
                <span className="font-mono bg-gray-100 px-0.5">{c}</span>
                {i === result.columns.length - 1 ? '.' : ', '}
              </span>
            ))}
          </p>
        )
      }

      return <ReasonLikeError reason={result.reason} />
    case 'schema-inspection':
    case 'cleanup':
    case 'insert':
      return <MessageLikeError message={result.message} />
    case 'unknown':
      return <UnknownError />
  }
}

function InvalidTemplateError(props: { error: PythonErrorOutput }) {
  return (
    <ScrollBar className="overflow-auto max-h-96">
      <p className="pb-4 text-xs text-gray-800">
        Fail to render the table name, we received the following error:
      </p>
      <pre className="whitespace-pre-wrap text-xs">
        {props.error.ename} - {props.error.evalue}
      </pre>
      {props.error.traceback.map((line, i) => (
        <pre key={i} className="whitespace-pre-wrap text-xs">
          <Ansi>{line}</Ansi>
        </pre>
      ))}
    </ScrollBar>
  )
}

function PythonError(props: {
  step: WriteBackErrorResult['step']
  ename: string
  evalue: string
}) {
  const prettyStep = getPrettyStep(props.step)

  return (
    <ScrollBar className="overflow-auto max-h-96">
      <p className="pb-4 text-xs text-gray-800">
        {props.step === 'unknown'
          ? 'Fail to complete writeback,'
          : `Fail to complete writeback while performing ${prettyStep}`}
        , we received the following error:
      </p>
      <pre className="whitespace-pre-wrap text-xs">
        {props.ename} - {props.evalue}
      </pre>
    </ScrollBar>
  )
}

function ReasonLikeError(props: {
  reason: 'dataframe-not-found' | 'datasource-not-found' | 'invalid-table-name'
}) {
  return (
    <p className="pb-4 text-xs text-gray-800">
      {getValidationErrorMessage(props.reason)}
    </p>
  )
}

function MessageLikeError(props: { message: string }) {
  return (
    <>
      <p className="pb-4 text-xs text-gray-800">
        There was an error writing the data.
      </p>
      <pre className="text-xs whitespace-pre-wrap">{props.message}</pre>
    </>
  )
}

function UnknownError() {
  return <p className="text-xs">An unexpected error occurred.</p>
}

interface Props {
  result: WriteBackErrorResult
}
function WritebackErrorResult(props: Props) {
  return (
    <div className="p-1.5 h-full">
      <div className="border border-red-500 p-4 h-full">
        <div className="flex items-center space-x-1 pb-2">
          <XCircleIcon className="w-4 h-4 text-red-500" />
          <span className="text-xs text-gray-800 font-medium">
            Writeback failed.
          </span>
        </div>
        {renderError(props.result)}
      </div>
    </div>
  )
}

export default WritebackErrorResult
