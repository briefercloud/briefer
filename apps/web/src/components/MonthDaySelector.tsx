import React from 'react'
import { Menu, Transition } from '@headlessui/react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { UseControllerProps, useController } from 'react-hook-form'
import { ScheduleFormValues } from './Schedules/AddScheduleForm'

type WeekdaySelectorProps = UseControllerProps<ScheduleFormValues, 'days'>

const monthDays = Array.from(Array(31).keys()).map((day) => day + 1)

const MonthDaySelector = (props: WeekdaySelectorProps) => {
  const controller = useController(props)

  const currentValue = controller.field.value || []

  const toggleDay = (dayIndex: number) => {
    if (currentValue.includes(dayIndex)) {
      const newSelectedDays = currentValue.filter(
        (selectedDayIndex) => selectedDayIndex !== dayIndex
      )
      controller.field.onChange(newSelectedDays)
    } else {
      controller.field.onChange([...currentValue, dayIndex])
    }
  }

  return (
    <Menu>
      {({ open }) => (
        <>
          <Menu.Button className="inline-flex justify-between w-full px-2 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-300">
            {currentValue.length > 0 ? (
              <div className="flex justify-start items-center gap-x-2 gap-y-2 flex-wrap">
                {currentValue.map((dayIndex) => (
                  <div
                    key={dayIndex}
                    className="flex items-center bg-gray-50 rounded-sm px-2 gap-x-1 py-0.5 text-sm border border-gray-200"
                  >
                    <span>{monthDays[dayIndex]}</span>
                    <span
                      className="hover:bg-gray-200 rounded-full p-0.5"
                      onClick={() => toggleDay(dayIndex)}
                    >
                      <XMarkIcon className="h-3 w-3 cursor-pointer" />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              'Select days'
            )}
          </Menu.Button>

          <Transition
            show={open}
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Menu.Items
              static
              className="absolute w-56 mt-2 origin-top-right bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none  max-h-56 overflow-y-auto"
            >
              <div className="px-1 py-1">
                {monthDays.map((day, dayIndex) => (
                  <Menu.Item key={dayIndex}>
                    {({ active }) => (
                      <div
                        className={`${
                          active ? 'bg-gray-100' : ''
                        } group flex items-center px-2 py-2 text-sm cursor-pointer`}
                        onClick={() => toggleDay(dayIndex)}
                      >
                        <div className="flex items-center gap-x-2">
                          {currentValue.includes(dayIndex) ? (
                            <CheckIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                          <span>{day}</span>
                        </div>
                      </div>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  )
}

export default MonthDaySelector
