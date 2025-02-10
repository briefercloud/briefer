import * as Y from 'yjs'
import { ConnectDragPreview } from 'react-dnd'
import {
  ExecutionQueue,
  YBlock,
  getDateInputAttributes,
  getDateInputBlockExecStatus,
  isExecutionStatusLoading,
  requestDateInputRun,
  updateDateInputBlockDateType,
  updateDateInputBlockTimeZone,
  updateYText,
  type DateInputBlock,
} from '@briefer/editor'
import clsx from 'clsx'
import { useCallback } from 'react'
import { Cog6ToothIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid'
import { ClockIcon } from '@heroicons/react/20/solid'
import Spin from '@/components/Spin'
import DateInputBlockInput from './DateInputBlockInput'
import DateSettings from './DateSettings'
import { useBlockExecutions } from '@/hooks/useBlockExecution'
import { head } from 'ramda'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { DashboardMode } from '@/components/Dashboard'

function invalidVariableErrorMessage(
  status: 'invalid-variable' | 'invalid-variable-and-value' | 'unexpected-error'
): JSX.Element {
  switch (status) {
    case 'invalid-variable':
    case 'invalid-variable-and-value':
      return (
        <>
          The variable name is invalid:
          <br />
          It should start with a letter or underscore, followed by letters,
          digits, or underscores. Spaces are not allowed.
        </>
      )
    case 'unexpected-error':
      return (
        <>
          Unexpected error occurred while updating the input. Click this icon to
          retry.
        </>
      )
  }
}

interface Props {
  block: Y.XmlElement<DateInputBlock>
  blocks: Y.Map<YBlock>
  dragPreview: ConnectDragPreview | null
  belongsToMultiTabGroup: boolean
  isEditable: boolean
  isApp: boolean
  dashboardMode: DashboardMode | null
  isCursorWithin: boolean
  isCursorInserting: boolean
  workspaceId: string
  userId: string | null
  executionQueue: ExecutionQueue
}
function DateInput(props: Props) {
  const blockId = props.block.getAttribute('id')
  const attrs = getDateInputAttributes(props.block, props.blocks)
  const onChangeLabel: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      updateYText(attrs.label, e.target.value)
    },
    [attrs.label]
  )

  const toggleConfigOpen = useCallback(() => {
    props.block.setAttribute(
      'configOpen',
      !Boolean(props.block.getAttribute('configOpen'))
    )
  }, [props.block])

  const executions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'date-input'
  )
  const status = head(executions)?.item.getStatus() ?? {
    _tag: 'idle',
  }

  const { startedAt: environmentStartedAt } = useEnvironmentStatus(
    props.workspaceId
  )

  const onRun = useCallback(() => {
    requestDateInputRun(
      props.executionQueue,
      props.block,
      props.blocks,
      props.userId,
      environmentStartedAt
    )
  }, [
    props.block,
    props.blocks,
    props.executionQueue,
    props.userId,
    environmentStartedAt,
  ])

  const onChangeVariable: React.ChangeEventHandler<HTMLInputElement> =
    useCallback(
      (e) => {
        updateYText(attrs.newVariable, e.target.value)
      },
      [attrs.newVariable, props.block]
    )

  const execStatus = getDateInputBlockExecStatus(
    props.block,
    props.executionQueue
  )

  const onChangeDateType = useCallback(
    (type: 'date' | 'datetime') => {
      updateDateInputBlockDateType(props.block, props.blocks, type)
      onRun()
    },
    [props.block, props.blocks, onRun]
  )

  const onChangeTimeZone = useCallback(
    (timezone: string) => {
      updateDateInputBlockTimeZone(props.block, props.blocks, timezone)
      onRun()
    },
    [props.block, props.blocks, onRun]
  )

  return (
    <div
      className={clsx(
        'w-full',
        props.belongsToMultiTabGroup && 'border p-4 rounded-tr-md rounded-b-md',
        props.isCursorWithin && !props.isCursorInserting
          ? 'border-blue-400'
          : 'border-gray-200'
      )}
      data-block-id={blockId}
    >
      <div
        className={!props.dashboardMode ? 'w-1/2' : ''}
        ref={(d) => {
          if (props.dragPreview) {
            props.dragPreview(d)
          }
        }}
      >
        <div className="flex justify-between items-center pb-1.5">
          <div className="flex items-center flex-grow space-x-1">
            {/* TODO: use Y.Text the right way */}
            <input
              data-bounding-rect="true"
              className="block ring-0 text-sm font-medium leading-6 text-gray-900 w-full focus:ring-0 border-0 p-0 bg-transparent"
              type="text"
              value={attrs.label.toString()}
              onChange={onChangeLabel}
              disabled={!props.isEditable || props.isApp}
            />

            {!props.isApp && props.isEditable && (
              <div className="flex items-center space-x-1">
                <button onClick={toggleConfigOpen}>
                  <Cog6ToothIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
                <div
                  className={clsx(!props.isEditable && 'hidden', 'relative')}
                >
                  <input
                    className={clsx(
                      'ring-0 px-1 py-0.5 rounded-md text-ceramic-500 bg-ceramic-100 text-xs font-medium min-w-12 min-h-4 focus:ring-0 border-0 block text-right',
                      {
                        'text-red-500 bg-red-100':
                          attrs.error === 'invalid-variable' ||
                          attrs.error === 'invalid-variable-and-value' ||
                          attrs.error === 'unexpected-error',
                        'text-ceramic-500 bg-ceramic-100':
                          execStatus === 'idle',
                        'text-gray-300 bg-gray-100': isExecutionStatusLoading(
                          status._tag
                        ),
                      }
                    )}
                    type="text"
                    value={attrs.newVariable.toString()}
                    onChange={onChangeVariable}
                    onBlur={onRun}
                    disabled={isExecutionStatusLoading(status._tag)}
                  />
                  <div className="absolute inset-y-0 pl-1 flex items-center group z-10">
                    {isExecutionStatusLoading(status._tag) &&
                      (status._tag === 'running' ||
                      status._tag === 'aborting' ? (
                        <Spin />
                      ) : status._tag === 'enqueued' ? (
                        <ClockIcon className="w-4 h-4 text-gray-300" />
                      ) : attrs.error && attrs.error !== 'invalid-value' ? (
                        <>
                          <button
                            disabled={attrs.error !== 'invalid-variable'}
                            onClick={onRun}
                          >
                            <ExclamationCircleIcon
                              className="h-3 w-3 text-red-300"
                              aria-hidden="true"
                            />
                          </button>
                          <div className="font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 w-72">
                            <span className="inline-flex gap-x-1 items-center text-gray-400 text-center">
                              {invalidVariableErrorMessage(attrs.error)}
                            </span>
                          </div>
                        </>
                      ) : null)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col space-y-1">
          <DateInputBlockInput
            blockId={blockId ?? ''}
            value={attrs.value}
            dateType={attrs.dateType}
            newValue={attrs.newValue}
            onSave={onRun}
            error={attrs.error !== 'invalid-variable' ? attrs.error : null}
            isSaving={status._tag === 'running' || status._tag === 'aborting'}
            isEnqueued={status._tag === 'enqueued'}
            isEditable={props.isEditable || props.isApp}
            belongsToMultiTabGroup={props.belongsToMultiTabGroup}
            isCursorWithin={props.isCursorWithin}
            isCursorInserting={props.isCursorInserting}
          />

          {attrs.configOpen && !props.isApp && props.isEditable && (
            <DateSettings
              dateType={attrs.dateType}
              onChangeDateType={onChangeDateType}
              timezone={attrs.value.timezone}
              onChangeTimeZone={onChangeTimeZone}
              disabled={isExecutionStatusLoading(status._tag)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default DateInput
