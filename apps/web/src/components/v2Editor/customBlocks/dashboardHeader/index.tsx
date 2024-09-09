import * as Y from 'yjs'
import { DashboardHeaderBlock } from '@briefer/editor'
import clsx from 'clsx'
import { useCallback, useEffect, useRef } from 'react'
import usePreviousEffect from '@/hooks/usePreviousEffect'

interface Props {
  block: Y.XmlElement<DashboardHeaderBlock>
  isEditing: boolean
  onFinishedEditing: () => void
}

const DashboardHeader = (props: Props) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const onEdit = useCallback(() => {
    props.block.setAttribute('content', inputRef.current?.value ?? '')
  }, [props.block])

  useEffect(() => {
    if (props.isEditing) {
      inputRef.current?.focus()
    }
  }, [props.isEditing])

  const endEditing = useCallback(() => {
    onEdit()
    props.onFinishedEditing()
  }, [onEdit, props.onFinishedEditing])

  const currContent = props.block.getAttribute('content')

  return (
    <div
      className={clsx(
        'h-[calc(100%-4px)] flex items-center px-1 rounded-md',
        props.isEditing
          ? 'bg-primary-200/20 outline outline-primary-400 outline-offset-[-1px]'
          : 'bg-dashboard-gray'
      )}
    >
      {props.isEditing ? (
        <input
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onEdit()
              props.onFinishedEditing()
            }
          }}
          type="text"
          value={props.block.getAttribute('content')}
          placeholder="Title"
          className="block w-full rounded-md border-0 p-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 text-2xl font-semibold leading-6 bg-transparent"
          onChange={(e) => props.block.setAttribute('content', e.target.value)}
          onBlur={endEditing}
        />
      ) : (
        <h1
          className={clsx(
            'text-2xl font-semibold font-medium text-left text-3l truncate min-h-6 pt-0.5',
            currContent !== '' ? 'text-gray-900' : 'text-gray-400'
          )}
        >
          {currContent || 'Click the pencil to edit'}
        </h1>
      )}
    </div>
  )
}

export default DashboardHeader
