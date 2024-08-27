import Ansi from '@cocalc/ansi-to-react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useCallback } from 'react'
import { SparklesIcon } from '@heroicons/react/20/solid'
import { PythonErrorOutput } from '@briefer/types'
import Spin from '@/components/Spin'

interface Props {
  error: PythonErrorOutput
  isFixWithAILoading: boolean
  onFixWithAI: (error: PythonErrorOutput) => void
}
function PythonError(props: Props) {
  const onFixWithAI = useCallback(() => {
    props.onFixWithAI(props.error)
  }, [props.error, props.onFixWithAI])

  return (
    <PythonErrorUI
      ename={props.error.ename}
      evalue={props.error.evalue}
      traceback={props.error.traceback}
      isFixWithAILoading={props.isFixWithAILoading}
      onFixWithAI={onFixWithAI}
    />
  )
}

export default PythonError

interface PythonErrorUIProps {
  ename: string
  evalue: string
  traceback: string[]
  isFixWithAILoading: boolean
  onFixWithAI?: () => void
}
export function PythonErrorUI(props: PythonErrorUIProps) {
  return (
    <div className="text-xs pt-4">
      <div className="flex border border-red-300 p-2 gap-x-3 text-xs overflow-hidden">
        <ExclamationTriangleIcon className="text-red-500 h-6 w-6" />
        <div>
          <h4 className="font-semibold mb-2">
            Your code could not be executed
          </h4>
          <p>We received the following error:</p>
          <pre className="whitespace-pre-wrap">
            {props.ename} - {props.evalue}
          </pre>
          {props.traceback.map((line, i) => (
            <pre key={i} className="whitespace-pre-wrap">
              <Ansi>{line}</Ansi>
            </pre>
          ))}
          {props.onFixWithAI && (
            <button
              onClick={props.onFixWithAI}
              className={clsx(
                'mt-2 flex items-center border rounded-sm px-2 py-1 gap-x-2 font-syne',
                props.isFixWithAILoading && 'bg-gray-200 border-gray-400',
                !props.isFixWithAILoading &&
                  'border-gray-200 hover:bg-gray-50 hover:text-gray-700'
              )}
              disabled={props.isFixWithAILoading}
            >
              {props.isFixWithAILoading ? (
                <Spin />
              ) : (
                <SparklesIcon className="w-3 h-3" />
              )}
              Fix with AI
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
