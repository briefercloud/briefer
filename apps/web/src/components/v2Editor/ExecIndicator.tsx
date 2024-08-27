import { ExecStatus } from '@briefer/editor'
import {
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import Spin from '../Spin'

type ExecIndicatorProps = {
  execStatus: ExecStatus
}

function ExecIndicator(props: ExecIndicatorProps) {
  switch (props.execStatus) {
    case 'error':
      return <ExclamationTriangleIcon className="h-3 w-3 text-red-500" />
    case 'success':
      return <CheckIcon className="h-3 w-3 text-green-500" />
    case 'loading':
      return <Spin />
    case 'enqueued':
      return <ClockIcon className="h-3 w-3" />
    case 'idle':
      return null
  }
}

export default ExecIndicator
