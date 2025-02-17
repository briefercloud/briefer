import * as Y from 'yjs'
import { DashboardHeaderBlock } from '@briefer/editor'
import clsx from 'clsx'
import { useCallback, useEffect, useRef } from 'react'

interface Props {
  block: Y.XmlElement<DashboardHeaderBlock>
  isEditing: boolean
  onFinishedEditing: () => void
  dashboardMode: 'editing' | 'live'
  onStartEditing: () => void
}
function DashboardHeader(props: Props) {
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

  let content = props.block.getAttribute('content')
  const hasContent = content !== ''
  if (props.dashboardMode === 'live' && !content) {
    content = ''
  } else if (!content) {
    content = 'Heading'
  }

  const onClickH1 = useCallback(
    (e: React.MouseEvent) => {
      console.log('onClickH1')
      if (props.dashboardMode === 'live') {
        return
      }

      e.stopPropagation()
      e.preventDefault()
      props.onStartEditing()
    },
    [props.dashboardMode, props.onStartEditing]
  )

  const stopPropagation = useCallback(
    (e: React.MouseEvent) => {
      if (props.dashboardMode === 'live') {
        return
      }

      e.stopPropagation()
    },
    [props.dashboardMode]
  )

  return (
    <div
      className={clsx(
        'h-[calc(100%-4px)] flex items-center rounded-md',
        props.isEditing ? 'border-ceramic-200/70' : '',
        props.dashboardMode === 'editing' && 'border-2'
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
          placeholder="Heading"
          className="block w-full rounded-md border-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 text-2xl font-semibold leading-6 bg-transparent pl-3 py-0.5"
          onChange={(e) => props.block.setAttribute('content', e.target.value)}
          onBlur={endEditing}
          onMouseDown={stopPropagation}
        />
      ) : (
        <h1
          className={clsx(
            'text-2xl font-semibold font-medium text-left truncate min-h-6 pl-3 w-full',
            hasContent ? 'text-gray-900' : 'text-gray-400',
            props.dashboardMode !== 'live' && 'hover:cursor-text'
          )}
          onClick={onClickH1}
          onMouseDown={stopPropagation}
        >
          {content}
        </h1>
      )}
    </div>
  )
}

export default DashboardHeader
