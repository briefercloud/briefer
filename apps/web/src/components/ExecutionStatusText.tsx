import { format } from 'date-fns'
import {
  CheckCircleIcon,
  CloudArrowDownIcon,
  Cog8ToothIcon,
} from '@heroicons/react/20/solid'

type LastExecutedStatusTextProps = {
  lastExecutionTime: string
}

export const QuerySucceededText = ({
  lastExecutionTime,
}: LastExecutedStatusTextProps) => {
  return (
    <span className="font-syne text-gray-300 text-xs flex items-center select-none">
      <CheckCircleIcon className="w-4 h-4 mr-1" />
      <span className="pt-0.5">
        This query was last executed at{' '}
        {format(new Date(lastExecutionTime), "h:mm a '-' do MMM, yyyy")}
      </span>
    </span>
  )
}

export const LoadingQueryText = () => {
  return (
    <span className="font-syne text-gray-400 text-xs flex items-center select-none">
      <CloudArrowDownIcon className="w-4 h-4 mr-1" />
      <span className="pt-0.5">Executing query...</span>
    </span>
  )
}

export const LoadingEnvText = () => {
  return (
    <span className="font-syne text-gray-400 text-xs flex items-center select-none">
      <Cog8ToothIcon className="w-4 h-4 mr-1" />
      <span className="pt-0.5">Starting your environment...</span>
    </span>
  )
}

export const ExecutingPythonText = () => {
  return (
    <span className="font-syne text-gray-400 text-xs flex items-center select-none">
      <CloudArrowDownIcon className="w-4 h-4 mr-1" />
      <span className="pt-0.5">Executing Python code...</span>
    </span>
  )
}

export const PythonSucceededText = ({
  lastExecutionTime,
}: LastExecutedStatusTextProps) => {
  return (
    <span className="font-syne text-gray-300 text-xs flex items-center select-none">
      <CheckCircleIcon className="w-4 h-4 mr-1" />
      <span className="pt-0.5">
        This code was last executed at{' '}
        {format(new Date(lastExecutionTime), "h:mm a '-' do MMM, yyyy")}
      </span>
    </span>
  )
}
