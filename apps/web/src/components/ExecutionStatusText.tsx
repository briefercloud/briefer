import { format } from 'date-fns'
import {
  CheckCircleIcon,
  CloudArrowDownIcon,
  Cog8ToothIcon,
  CheckIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/20/solid'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

function formatExecutionTime(time: string): string {
  return format(new Date(time), 'h:mm a - do MMM, yyyy')
}

type StartExecutionStatusTextProps = {
  startExecutionTime: string | null
}

interface LastExecutedStatusTextProps {
  lastExecutionTime: string
  isResultHidden: boolean
  onToggleResultHidden: () => void
}

export function QuerySucceededText({
  lastExecutionTime,
  isResultHidden,
  onToggleResultHidden,
}: LastExecutedStatusTextProps) {
  return (
    <div className="flex items-center gap-x-1 text-gray-400">
      <div className="relative group w-4 h-4">
        <CheckCircleIcon
          className={clsx(
            'absolute inset-0 h-4 w-4',
            'group-hover:opacity-0 transition-opacity'
          )}
        />
        <button
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onToggleResultHidden}
        >
          {isResultHidden ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      <span>Succeeded in {formatExecutionTime(lastExecutionTime)}</span>
    </div>
  )
}

export const LoadingQueryText = ({
  startExecutionTime,
}: StartExecutionStatusTextProps) => {
  const [showStartTime, setShowStartTime] = useState(false)
  useEffect(() => {
    if (startExecutionTime) {
      const interval = setInterval(() => {
        setShowStartTime(true)
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [startExecutionTime])

  return (
    <span className="font-syne text-gray-400 text-xs flex items-center select-none">
      <CloudArrowDownIcon className="w-4 h-4 mr-1" />
      <span className="pt-0.5">
        Executing query
        {showStartTime && startExecutionTime
          ? ` since ${format(
              new Date(startExecutionTime),
              'h:mm a - do MMM, yyyy'
            )}...`
          : '...'}
      </span>
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

export const ExecutingPythonText = ({
  startExecutionTime,
}: StartExecutionStatusTextProps) => {
  const [showStartTime, setShowStartTime] = useState(false)
  useEffect(() => {
    if (startExecutionTime) {
      const interval = setInterval(() => {
        setShowStartTime(true)
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [startExecutionTime])

  return (
    <span className="font-syne text-gray-400 text-xs flex items-center select-none">
      <CloudArrowDownIcon className="w-4 h-4 mr-1" />
      <span className="pt-0.5">
        Executing Python code
        {showStartTime && startExecutionTime
          ? ` since ${format(
              new Date(startExecutionTime),
              'h:mm a - do MMM, yyyy'
            )}...`
          : '...'}
      </span>
    </span>
  )
}

export function PythonSucceededText({
  lastExecutionTime,
  isResultHidden,
  onToggleResultHidden,
}: LastExecutedStatusTextProps) {
  return (
    <div className="flex items-center gap-x-1 text-gray-400">
      <div className="relative group w-4 h-4">
        <CheckCircleIcon
          className={clsx(
            'absolute inset-0 h-4 w-4',
            'group-hover:opacity-0 transition-opacity'
          )}
        />
        <button
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onToggleResultHidden}
        >
          {isResultHidden ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      <span>Succeeded in {formatExecutionTime(lastExecutionTime)}</span>
    </div>
  )
}
