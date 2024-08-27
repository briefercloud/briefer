import { DataSource } from '@briefer/database'
import { ExecStatus } from '@briefer/editor'
import WritebackErrorResult from './WritebackErrorResult'
import WritebackSuccessResult from './WritebackSuccessResult'
import { DatabaseZapIcon } from 'lucide-react'
import LargeSpinner from '@/components/LargeSpinner'
import { WriteBackResult } from '@briefer/types'

interface Props {
  status: ExecStatus
  result: WriteBackResult | null
  dataSources: DataSource[]
}
function WritebackResult(props: Props) {
  if (props.status === 'loading' || props.status === 'enqueued') {
    return <Loading />
  }

  return (
    <>
      {!props.result && <NoResult />}
      {props.result?._tag === 'success' && (
        <WritebackSuccessResult
          result={props.result}
          dataSources={props.dataSources}
        />
      )}
      {props.result?._tag === 'error' && (
        <WritebackErrorResult result={props.result} />
      )}
    </>
  )
}

function Loading() {
  return (
    <div className="flex flex-col space-y-2 items-center justify-center h-full bg-ceramic-50/30">
      <LargeSpinner />
    </div>
  )
}

function NoResult() {
  return (
    <div className="flex flex-col space-y-2 items-center justify-center h-full bg-ceramic-50/30">
      <DatabaseZapIcon className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
      <p className="text-lg text-gray-300">Run this block to write data.</p>
    </div>
  )
}

export default WritebackResult
