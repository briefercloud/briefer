import tzList from 'timezones-list'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { SubmitHandler, UseFormReturn, useWatch } from 'react-hook-form'
import { ScheduleFormValues } from './AddScheduleForm'
import FormError from '../forms/formError'
import {
  CronScheduleFields,
  DailyScheduleFields,
  HourlyScheduleFields,
  MonthlyScheduleFields,
  WeeklyScheduleFields,
} from './ScheduleFields'
import { Tooltip } from '../Tooltips'

interface ScheduleConfigFormProps {
  onClose: () => void
  form: UseFormReturn<ScheduleFormValues>
  submitHandler: SubmitHandler<ScheduleFormValues>
}

function ScheduleConfigForm({
  onClose,
  form,
  submitHandler,
}: ScheduleConfigFormProps) {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const selectedScheduleType = useWatch({
    control: form.control,
    name: 'type',
    defaultValue: 'monthly',
  })

  return (
    <form
      className="h-full flex flex-col"
      onSubmit={form.handleSubmit(submitHandler)}
    >
      <div className="flex items-center justify-between py-6 sm:px-4 xl:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 pt-1">
          Add scheduled run
        </h3>
        <button
          className="text-gray-500 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center gap-x-2 text-sm p-1 rounded-sm"
          onClick={onClose}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="sm:px-4 xl:px-6 py-6 flex-1 flex flex-col overflow-y-scroll">
        <div className="flex flex-col space-y-2">
          <div>
            <label
              htmlFor="scheduleType"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Schedule type
            </label>
            <select
              {...form.register('type')}
              defaultValue="monthly"
              className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="cron">Cron</option>
            </select>
            <FormError msg={form.formState.errors.timezone?.message} />
          </div>

          <div>
            <label
              htmlFor="timezone"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Timezone
            </label>
            <select
              {...form.register('timezone', { required: true })}
              className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6"
              defaultValue={userTimezone}
            >
              {tzList.map((timezone) => (
                <option key={timezone.tzCode} value={timezone.tzCode}>
                  {timezone.label.replace('_', ' ')}
                </option>
              ))}
            </select>
            <FormError msg={form.formState.errors.timezone?.message} />
          </div>

          {selectedScheduleType === 'hourly' && (
            <HourlyScheduleFields
              register={form.register}
              formErrors={form.formState.errors}
            />
          )}

          {selectedScheduleType === 'daily' && (
            <DailyScheduleFields
              register={form.register}
              formErrors={form.formState.errors}
            />
          )}

          {selectedScheduleType === 'weekly' && (
            <WeeklyScheduleFields
              register={form.register}
              formErrors={form.formState.errors}
              control={form.control}
            />
          )}

          {selectedScheduleType === 'monthly' && (
            <MonthlyScheduleFields
              register={form.register}
              formErrors={form.formState.errors}
              control={form.control}
            />
          )}

          {selectedScheduleType === 'cron' && (
            <CronScheduleFields
              register={form.register}
              formErrors={form.formState.errors}
            />
          )}

          <hr />

          <div className="pt-2 flex flex-col space-y-6">
            <div className="flex items-center justify-between pt-2">
              <h4 className="pt-0.5">Notifications</h4>
              <div className="flex items-center justify-end gap-x-2">
                <Tooltip
                  title="Notifications are not available in the open-source version"
                  message="Upgrade to Briefer cloud’s professional tier to use it."
                  active={true}
                  position="left"
                  tooltipClassname="w-48"
                >
                  <button
                    type="button"
                    className="flex items-center gap-x-2 rounded-sm px-2.5 py-1 text-gray-500 text-sm hover:bg-gray-100 border border-gray-200 disabled:cursor-not-allowed"
                    disabled
                  >
                    Add
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex bg-white px-2 py-4 justify-end space-x-2 sm:px-4 xl:px-6">
        <button
          onClick={onClose}
          type="button"
          className="flex items-center gap-x-2 rounded-sm px-3 py-1 text-gray-500 text-sm hover:bg-gray-100 border border-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-x-2 rounded-sm bg-primary-200 px-3 py-1 text-sm hover:bg-primary-300"
        >
          Schedule run
        </button>
      </div>
    </form>
  )
}

export default ScheduleConfigForm
