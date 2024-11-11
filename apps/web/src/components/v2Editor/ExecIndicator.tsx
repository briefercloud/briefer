import * as Y from 'yjs'
import {
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import Spin from '../Spin'
import {
  ExecutionQueue,
  ExecutionStatus,
  getResultStatus,
  ResultStatus,
  TabRef,
  YBlock,
} from '@briefer/editor'
import { useBlockExecutions } from '@/hooks/useBlockExecution'
import { head } from 'ramda'

interface Props {
  tabRef: TabRef
  blocks: Y.Map<YBlock>
  executionQueue: ExecutionQueue
}
function ExecIndicator(props: Props) {
  const block = props.blocks.get(props.tabRef.blockId)
  const result = block ? getResultStatus(block, props.blocks) : 'idle'
  const executions = useBlockExecutions(props.executionQueue, block)
  const execution = head(executions)
  const status = execution?.item.getStatus()._tag ?? 'idle'
  console.log(execution, status)

  switch (status) {
    case 'enqueued':
      return <ClockIcon className="h-3 w-3" />
    case 'aborting':
    case 'running':
      return <Spin />
    case 'idle':
    case 'completed':
    case 'unknown':
      switch (result) {
        case 'idle':
          return null
        case 'error':
          return <ExclamationTriangleIcon className="h-3 w-3 text-red-500" />
        case 'success':
          return <CheckIcon className="h-3 w-3 text-green-500" />
      }
  }
}

export default ExecIndicator
