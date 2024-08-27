import WeekdaySelector from '@/components/WeekdaySelector'
import MonthDaySelector from '@/components/MonthDaySelector'
import cronParser from 'cron-parser'
import { DeepMap, Control, FieldError, UseFormRegister } from 'react-hook-form'
import FormError from '../forms/formError'
import { ScheduleFormValues } from './AddScheduleForm'

type ScheduleFieldsetProps = {
  register: UseFormRegister<any>
  formErrors: DeepMap<any, FieldError>
}

const minuteValidator = (value: number) => {
  if (value < 0 || value > 59) {
    return 'Minute must be between 0 and 59'
  }
  return true
}

const hourValidator = (value: number) => {
  if (value < 1 || value > 12) {
    return 'Hour must be between 1 and 12'
  }
  return true
}

export const HourlyScheduleFields = ({
  register,
  formErrors,
}: ScheduleFieldsetProps) => {
  return (
    <div>
      <label
        htmlFor="hourlyMinute"
        className="block text-sm font-medium leading-6 text-gray-900"
      >
        Minute
      </label>
      <div className="pt-2 ">
        <input
          type="number"
          id="hourlyMinute"
          {...register('minute', {
            valueAsNumber: true,
            required: {
              value: true,
              message: 'Minute is required',
            },
            validate: minuteValidator,
          })}
          required
          className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6"
        />
        <FormError msg={formErrors.minute?.message} />
      </div>
    </div>
  )
}

export const DailyScheduleFields = ({
  register,
  formErrors,
}: ScheduleFieldsetProps) => {
  const timeError = formErrors.hour?.message || formErrors.minute?.message

  return (
    <div className="w-full">
      <label
        htmlFor="dailyHour"
        className="block text-sm font-medium leading-6 text-gray-900"
      >
        Hour
      </label>

      <div className="flex items-center pt-2 gap-x-2">
        <div className="flex items-center gap-x-2 w-2/3">
          <input
            type="number"
            id="dailyHour"
            {...register('hour', {
              valueAsNumber: true,
              required: {
                value: true,
                message: 'Hour is required',
              },
              validate: hourValidator,
            })}
            className="pt-2 rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-full text-right"
          />

          <span className="text-gray-700">:</span>

          <input
            type="number"
            id="dailyMinute"
            {...register('minute', {
              valueAsNumber: true,
              required: {
                value: true,
                message: 'Minute is required',
              },
              validate: minuteValidator,
            })}
            className="pt-2 block rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-full text-right"
          />
        </div>

        <select
          id="amPm"
          {...register('amPm', { required: true })}
          className="pt-2 block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-1/3"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      <FormError msg={timeError} />
    </div>
  )
}

export const WeeklyScheduleFields = ({
  register,
  formErrors,
  control,
}: ScheduleFieldsetProps & { control: Control<ScheduleFormValues> }) => {
  const timeError = formErrors.hour?.message || formErrors.minute?.message

  return (
    <>
      <div className="w-full">
        <label
          htmlFor="dailyHour"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Hour
        </label>

        <div className="flex items-center pt-2 gap-x-2">
          <div className="flex items-center gap-x-2 w-2/3">
            <input
              type="number"
              {...register('hour', {
                valueAsNumber: true,
                required: {
                  value: true,
                  message: 'Hour is required',
                },
                validate: hourValidator,
              })}
              className="pt-2 rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-full text-right"
            />

            <span className="text-gray-700">:</span>

            <input
              type="number"
              id="dailyMinute"
              {...register('minute', {
                valueAsNumber: true,
                required: {
                  value: true,
                  message: 'Minute is required',
                },
                validate: minuteValidator,
              })}
              className="pt-2 block rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-full text-right"
            />
          </div>

          <select
            {...register('amPm', { required: true })}
            className="pt-2 block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-1/3"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <FormError msg={timeError} />
      </div>

      <div className="w-full">
        <label
          htmlFor="weekdays"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Weekdays
        </label>
        <div className="pt-2 ">
          <WeekdaySelector
            control={control}
            {...register('weekdays', {
              validate: (value) => {
                if (!value || (value && value.length === 0)) {
                  return 'Select at least one weekday'
                }
              },
            })}
          />
          <FormError msg={formErrors.weekdays?.message} />
        </div>
      </div>
    </>
  )
}

export const MonthlyScheduleFields = ({
  register,
  formErrors,
  control,
}: ScheduleFieldsetProps & { control: Control<ScheduleFormValues> }) => {
  const timeError = formErrors.hour?.message || formErrors.minute?.message

  return (
    <>
      <div className="w-full">
        <label
          htmlFor="dailyHour"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Hour
        </label>

        <div className="flex items-center pt-2 gap-x-2">
          <div className="flex items-center gap-x-2 w-2/3">
            <input
              type="number"
              {...register('hour', {
                valueAsNumber: true,
                required: {
                  value: true,
                  message: 'Hour is required',
                },
                validate: hourValidator,
              })}
              className="pt-2 rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-full text-right"
            />

            <span className="text-gray-700">:</span>

            <input
              type="number"
              id="dailyMinute"
              {...register('minute', {
                valueAsNumber: true,
                required: {
                  value: true,
                  message: 'Minute is required',
                },
                validate: minuteValidator,
              })}
              className="pt-2 block rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-full text-right"
            />
          </div>

          <select
            id="amPm"
            {...register('amPm', { required: true })}
            className="pt-2 block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6 w-1/3"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <FormError msg={timeError} />
      </div>

      <div className="w-full">
        <label
          htmlFor="weekdays"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Days
        </label>
        <div className="pt-2 ">
          <MonthDaySelector
            control={control}
            {...register('days', {
              validate: (value) => {
                if (!value || value.length === 0) {
                  return 'Select at least one day'
                }
              },
            })}
          />
          <FormError msg={formErrors.days?.message} />
        </div>
      </div>
    </>
  )
}

export const CronScheduleFields = ({
  register,
  formErrors,
}: ScheduleFieldsetProps) => {
  return (
    <div>
      <label
        htmlFor="hourlyMinute"
        className="block text-sm font-medium leading-6 text-gray-900"
      >
        Cron schedule
      </label>
      <div className="pt-2 ">
        <input
          type="text"
          {...register('cron', {
            required: {
              value: true,
              message: 'Cron schedule is required',
            },
            validate: (value) => {
              try {
                cronParser.parseExpression(value)
              } catch (err) {
                return 'Invalid cron schedule'
              }
            },
          })}
          required
          className="font-mono block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-primary-400 sm:text-sm sm:leading-6"
        />
        <FormError msg={formErrors.cron?.message} />
      </div>
    </div>
  )
}
