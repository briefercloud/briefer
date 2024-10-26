import * as Y from 'yjs'
import { SparklesIcon, XMarkIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import Spin from '../Spin'
import { useCallback, useEffect, useRef } from 'react'
import { updateYText } from '@briefer/editor'

interface Props {
  loading: boolean
  disabled: boolean
  value: Y.Text
  onSubmit: () => void
  onClose: () => void
  hasOutput: boolean
}
function EditWithAIForm(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onChange = (evt: Y.YTextEvent, tr: Y.Transaction) => {
      const currentSelectionStart = inputRef.current?.selectionStart ?? null
      const currentSelectionEnd = inputRef.current?.selectionEnd ?? null

      if (
        tr.local ||
        currentSelectionStart === null ||
        currentSelectionEnd === null ||
        !inputRef.current
      ) {
        return
      }

      const currentInput = inputRef.current

      let index = 0 // This keeps track of the current index in the text before any changes.
      let delta = 0
      for (const operation of evt.changes.delta) {
        if (operation.retain !== undefined) {
          index += operation.retain
        } else if (operation.insert !== undefined) {
          if (index < currentSelectionStart) {
            delta += operation.insert.length // Only modify delta if insert is before the cursor
          }
          index += operation.insert.length // Move index forward by the length of the inserted text
        } else if (operation.delete !== undefined) {
          if (index < currentSelectionStart) {
            delta -= operation.delete // Only modify delta if delete is before the cursor
          }
        }
      }

      currentInput.value = evt.target.toString()
      requestAnimationFrame(() => {
        currentInput.setSelectionRange(
          currentSelectionStart + delta,
          currentSelectionEnd + delta
        )
      })
    }

    props.value.observe(onChange)
    return () => {
      props.value.unobserve(onChange)
    }
  }, [props.value, inputRef])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateYText(props.value, e.target.value)
    },
    [props.value]
  )

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      props.onSubmit()
    },
    [props.onSubmit]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const modifier = e.ctrlKey || e.metaKey
      const shouldClose = e.key === 'Escape' || (modifier && e.key === 'e')
      const shouldRun = e.key === 'Enter'

      if (shouldClose) {
        e.preventDefault()
        props.onClose()
      } else if (shouldRun) {
        props.onSubmit()
      }
    },
    [props.onSubmit, props.onClose]
  )

  return (
    <div className="print:hidden h-full w-full">
      <form
        onSubmit={onSubmit}
        className={clsx(
          props.loading
            ? 'bg-gray-300 border-gray-400'
            : 'bg-primary-50 border-primary-400 focus-within:bg-primary-100 focus-within:border-primary-500',
          props.hasOutput ? '' : 'rounded-b-md',
          'w-full h-full mt-[-1px] border-t flex items-center px-3 py-1 gap-x-2'
        )}
      >
        <button
          className="text-gray-400 hover:text-gray-500"
          onClick={props.onClose}
        >
          <XMarkIcon className="h-3 w-3" />
        </button>
        <div className="flex w-full items-center">
          <input
            ref={inputRef}
            disabled={props.disabled}
            defaultValue={props.value.toString()}
            className="h-full w-full border-0 text-xs font-syne bg-transparent focus:ring-0 px-0  placeholder-gray-400"
            placeholder="My code does X. It must do Y instead."
            onChange={onChange}
            onKeyDown={onKeyDown}
            autoFocus
          />
          <button
            type="submit"
            disabled={props.disabled}
            className={clsx(
              props.loading || props.disabled
                ? 'bg-gray-200 hover:bg-gray-300 border-gray-400 cursor-not-allowed'
                : 'bg-primary-200 hover:bg-primary-300 border-primary-300',
              'p-1.5 rounded-sm text-primary-600 border'
            )}
          >
            {props.loading ? (
              <Spin />
            ) : (
              <SparklesIcon className="h-3 w-3 text-gray-500" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditWithAIForm
