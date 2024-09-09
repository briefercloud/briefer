import { ExecutionSchedule, ScheduleParams } from '@briefer/database'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import ScheduleConfigForm from './ScheduleConfigForm'

export type CreateSchedulePayload = {
  scheduleParams: ScheduleParams
}

export type ScheduleFormValues = ScheduleParams & {
  amPm: 'AM' | 'PM'
  notifyOnFailure: boolean
}

interface Props {
  documentId: string
  onClose: () => void
  onSubmit: (payload: CreateSchedulePayload) => Promise<ExecutionSchedule>
}
function AddScheduleForm({ documentId, onClose, onSubmit }: Props) {
  const form = useForm<ScheduleFormValues>({
    mode: 'onSubmit',
    defaultValues: { documentId },
  })

  const onSubmitHandler = useCallback(
    async (data: ScheduleFormValues) => {
      try {
        if ('hour' in data) {
          if (data.amPm === 'PM') {
            data.hour = data.hour === 12 ? 12 : data.hour + 12
          } else {
            data.hour = data.hour % 12
          }
        }

        // TODO fix data and data.notifications passing separately
        await onSubmit({
          scheduleParams: data,
        })
      } finally {
        onClose()
      }
    },
    [onSubmit, onClose]
  )

  return (
    <div className="w-[324px] flex h-full flex-col overflow-y-scroll border-l border-gray-200 font-sans">
      <ScheduleConfigForm
        form={form}
        submitHandler={onSubmitHandler}
        onClose={onClose}
      />
    </div>
  )
}

export default AddScheduleForm
