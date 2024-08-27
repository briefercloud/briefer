import { Transition } from '@headlessui/react'
import { useCallback, useState } from 'react'
import {
  XMarkIcon,
  CalendarDaysIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid'
import type {
  ExecutionSchedule,
  HourlySchedule,
  DailySchedule,
  WeeklySchedule,
  MonthlySchedule,
  CronSchedule,
} from '@briefer/database'
import clsx from 'clsx'
import cronstrue from 'cronstrue'
import { useSchedules } from '@/hooks/useSchedules'
import AddScheduleForm from './AddScheduleForm'
import { ChevronDoubleRightIcon } from '@heroicons/react/24/outline'
import { Tooltip } from '../Tooltips'

interface Props {
  workspaceId: string
  documentId: string
  isPublished: boolean
  visible: boolean
  onHide: () => void
  onPublish: () => void
  publishing: boolean
}
const getPrettyTz = (tz: string) => tz.replace(/_/g, ' ')

const HourlySchedule = ({ schedule }: { schedule: HourlySchedule }) => {
  const { minute, timezone } = schedule
  const minuteStr = ('' + minute).padStart(2, '0')

  return (
    <div>
      <div className="font-medium">Hourly at minute {minuteStr}</div>
      <div className="pt-0.5 flex flex-col text-gray-400 gap-y-0.5">
        <span>{getPrettyTz(timezone)}</span>
      </div>
    </div>
  )
}

const DailySchedule = ({ schedule }: { schedule: DailySchedule }) => {
  const { hour, minute, timezone } = schedule
  const hour12 = hour % 12 || 12
  const amPm = hour < 12 ? 'AM' : 'PM'
  const minuteStr = ('' + minute).padStart(2, '0')

  return (
    <div>
      <div className="font-medium">
        Daily at {hour12}:{minuteStr} {amPm}
      </div>
      <div className="pt-0.5 flex flex-col text-gray-400 gap-y-0.5">
        <span>{getPrettyTz(timezone)}</span>
      </div>
    </div>
  )
}

const WeeklySchedule = ({ schedule }: { schedule: WeeklySchedule }) => {
  const { hour, minute, timezone, weekdays } = schedule
  const hour12 = hour % 12 || 12
  const amPm = hour < 12 ? 'AM' : 'PM'
  const minuteStr = ('' + minute).padStart(2, '0')

  const prettyWeekDays = weekdays.map((day) => {
    switch (day) {
      case 0:
        return 'Sunday'
      case 1:
        return 'Monday'
      case 2:
        return 'Tuesday'
      case 3:
        return 'Wednesday'
      case 4:
        return 'Thursday'
      case 5:
        return 'Friday'
      case 6:
        return 'Saturday'
      default:
        return 'Unknown'
    }
  })

  return (
    <div>
      <div className="font-medium">
        Weekly on {prettyWeekDays.join(', ')} at {hour12}:{minuteStr} {amPm}
      </div>
      <div className="pt-0.5 flex flex-col text-gray-400 gap-y-0.5">
        <span>{getPrettyTz(timezone)}</span>
      </div>
    </div>
  )
}

const MonthlySchedule = ({ schedule }: { schedule: MonthlySchedule }) => {
  const { hour, minute, timezone, days } = schedule
  const hour12 = hour % 12 || 12
  const amPm = hour < 12 ? 'AM' : 'PM'
  const minuteStr = ('' + minute).padStart(2, '0')

  const prettyDays =
    days?.map((dIndex) => {
      const d = dIndex + 1
      const s = ['th', 'st', 'nd', 'rd']
      const v = d % 100
      return d + (s[(v - 20) % 10] || s[v] || s[0])
    }) ?? []

  return (
    <div>
      <div className="font-medium">
        Monthly on the {prettyDays.join(', ')} at {hour12}:{minuteStr} {amPm}
      </div>
      <div className="pt-0.5 flex flex-col text-gray-400 gap-y-0.5">
        <span>{getPrettyTz(timezone)}</span>
      </div>
    </div>
  )
}

const CronSchedule = ({ schedule }: { schedule: CronSchedule }) => {
  const { cron, timezone } = schedule
  const tooltipText = cronstrue.toString(cron, {
    locale: 'en',
    verbose: true,
  })

  return (
    <div>
      <div className="font-medium pb-2">
        <span className="pr-2">Cron: </span>
        <span className="rounded-sm px-2 py-1 font-mono bg-gray-100 border border-gray-200">
          {cron}
        </span>
        <span className="ml-2 group relative">
          <QuestionMarkCircleIcon className="w-4 h-4 inline-block text-gray-300" />

          <div className="pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 w-[124px] opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-gray-400 text-xs p-2 rounded-md flex flex-col gap-y-1">
            {tooltipText}
          </div>
        </span>
      </div>
      <div className="pt-0.5 flex flex-col text-gray-400 gap-y-0.5">
        <span>{getPrettyTz(timezone)}</span>
      </div>
    </div>
  )
}

const getScheduleBlock = (schedule: ExecutionSchedule) => {
  switch (schedule.type) {
    case 'hourly':
      return <HourlySchedule schedule={schedule} />
    case 'daily':
      return <DailySchedule schedule={schedule} />
    case 'weekly':
      return <WeeklySchedule schedule={schedule} />
    case 'monthly':
      return <MonthlySchedule schedule={schedule} />
    case 'cron':
      return <CronSchedule schedule={schedule} />
  }
}

export default function Schedules(props: Props) {
  const [schedules, { createSchedule, deleteSchedule }] = useSchedules(
    props.workspaceId,
    props.documentId
  )

  const [showAddForm, setShowAddForm] = useState(false)

  const onAddSchedule = useCallback(() => {
    setShowAddForm(true)
  }, [setShowAddForm])

  const onCloseAddForm = useCallback(() => {
    setShowAddForm(false)
  }, [setShowAddForm])

  const onDeleteSchedule = useCallback(
    (id: string) => {
      return () => deleteSchedule(id)
    },
    [deleteSchedule]
  )

  return (
    <Transition
      as="div"
      show={props.visible}
      className="top-0 right-0 h-full absolute bg-white z-30"
      enter="transition-transform duration-300"
      enterFrom="transform translate-x-full"
      enterTo="transform translate-x-0"
      leave="transition-transform duration-300"
      leaveFrom="transform translate-x-0"
      leaveTo="transform translate-x-full"
    >
      <button
        className="absolute z-10 top-7 transform rounded-full border border-gray-300 text-gray-400 bg-white hover:bg-gray-100 w-6 h-6 flex justify-center items-center left-0 -translate-x-1/2"
        onClick={props.onHide}
      >
        <ChevronDoubleRightIcon className="w-3 h-3" />
      </button>
      {showAddForm ? (
        <AddScheduleForm
          documentId={props.documentId}
          onClose={onCloseAddForm}
          onSubmit={createSchedule}
        />
      ) : (
        <ScheduleList
          schedules={schedules}
          isLimited={false}
          isPublished={props.isPublished}
          onAddSchedule={onAddSchedule}
          onDeleteSchedule={onDeleteSchedule}
          onPublish={props.onPublish}
          publishing={props.publishing}
        />
      )}
    </Transition>
  )
}

interface ScheduleListProps {
  schedules: ExecutionSchedule[]
  isLimited: boolean
  isPublished: boolean
  onAddSchedule: () => void
  onDeleteSchedule: (id: string) => () => void
  onPublish: () => void
  publishing: boolean
}
function ScheduleList(props: ScheduleListProps) {
  return (
    <div className="w-[324px] h-full flex flex-col overflow-y-scroll border-l border-gray-200">
      <div className="px-4 xl:px-6 pt-6 pb-5">
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 ">
              Schedule
            </h3>

            <p className="text-gray-500 text-sm pt-1">
              Schedule to run the latest published version.
            </p>
          </div>
          <div>
            <Tooltip
              title={
                props.isLimited ? "You've hit the free limit" : 'Not published'
              }
              message={
                props.isLimited
                  ? 'Upgrade to the professional plan to schedule more runs.'
                  : "You haven't published this page yet. Publish to be able to schedule it."
              }
              className="flex"
              tooltipClassname="-bottom-1 right-0 translate-y-full translate-x-0 w-48"
              position="manual"
              active={props.isLimited || !props.isPublished}
            >
              <button
                className={clsx(
                  'text-gray-900 flex items-center justify-center gap-x-2 text-sm px-2 py-1.5 rounded-sm',
                  !props.isLimited && props.isPublished
                    ? 'bg-primary-200 hover:bg-primary-300'
                    : 'bg-gray-200 cursor-not-allowed'
                )}
                onClick={props.onAddSchedule}
                disabled={props.isLimited || !props.isPublished}
              >
                <CalendarDaysIcon className="h-4 w-4 text-gray-900" />
                <span>Add</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {props.isPublished ? (
        <ul
          role="list"
          className="flex-1 text-xs font-primary overflow-visible"
        >
          {props.schedules.map((scheduledRun, i) => {
            return (
              <li
                key={scheduledRun.id}
                className={clsx(
                  {
                    'border-b': i === props.schedules.length - 1,
                  },
                  'flex border-t border-gray-200 px-4 xl:px-6 py-6'
                )}
              >
                <div className="flex flex-1 items-center justify-between">
                  <div className="w-3/4">{getScheduleBlock(scheduledRun)}</div>
                  <div className="w-1/4 flex items-center justify-end">
                    <div
                      className="p-1 hover:cursor-pointer hover:bg-gray-200 hover:text-gray-900 text-gray-400 rounded-sm"
                      onClick={props.onDeleteSchedule(scheduledRun.id)}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="px-4 xl:px-6 py-6">
          <div className="flex flex-col gap-y-1 bg-ceramic-50/60 p-4 rounded-xl border-2 border-gray-100 border-dashed">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-300/40" />
            <div className="text-gray-500 text-center text-sm pb-2">
              <p>{`You haven't published this page yet.`}</p>
              <p>{`Publish it to be able to create a schedule.`}</p>
            </div>
            <div className="flex items-center justify-center">
              <button
                className="rounded-sm px-3 py-1 text-sm bg-primary-200 hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={props.onPublish}
                disabled={props.publishing}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
