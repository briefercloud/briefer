import React from 'react'
import { Menu, Transition } from '@headlessui/react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { UseControllerProps, useController } from 'react-hook-form'
import clsx from 'clsx'
import { SecondStepFormValues } from '@/components/forms/NewWorkspace'

type WorkspaceUseSelectorProps = UseControllerProps<
  SecondStepFormValues,
  'useCases'
>

const useCases = [
  'Advanced visualizations',
  'Machine learning',
  'Exploratory data analysis',
  'Data-powered applications',
  'Task automation',
  'Reporting',
  'Documentation',
]

const WorkspaceUseSelector = (props: WorkspaceUseSelectorProps) => {
  const controller = useController(props)

  const currentValue = controller.field.value || []

  const toggleUseCase = (useCase: string) => {
    if (currentValue.includes(useCase)) {
      const newSelectedDays = currentValue.filter(
        (selectedDayIndex) => selectedDayIndex !== useCase
      )
      controller.field.onChange(newSelectedDays)
    } else {
      controller.field.onChange([...currentValue, useCase])
    }
  }

  return (
    <Menu>
      {({ open }) => (
        <>
          <Menu.Button
            className={clsx(
              currentValue.length > 0
                ? 'py-2 text-gray-700'
                : 'py-2.5 text-gray-400',
              'inline-flex justify-between w-full px-2 text-sm font-medium bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-primary-200'
            )}
          >
            {currentValue.length > 0 ? (
              <div className="flex justify-start items-center gap-x-2 gap-y-2 flex-wrap">
                {currentValue.map((useCase, useCaseIndex) => (
                  <div
                    key={useCaseIndex}
                    className="flex items-center bg-gray-50 rounded-sm px-2 gap-x-1 py-0.5 text-sm border border-gray-200"
                  >
                    <span>{useCase}</span>
                    <span
                      className="hover:bg-gray-200 rounded-full p-0.5"
                      onClick={() => toggleUseCase(useCase)}
                    >
                      <XMarkIcon className="h-3 w-3 cursor-pointer" />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              'Select use cases'
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
              className="absolute w-56 mt-2 origin-top-right bg-white border border-gray-200 divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none  max-h-56 overflow-y-scroll"
            >
              <div className="px-1 py-1">
                {useCases.map((useCase, useCaseIndex) => (
                  <Menu.Item key={useCaseIndex}>
                    {({ active }) => (
                      <div
                        className={`${
                          active ? 'bg-gray-100' : ''
                        } group flex items-center px-2 py-2 text-sm cursor-pointer`}
                        onClick={() => toggleUseCase(useCase)}
                      >
                        <div className="flex items-center gap-x-2">
                          {currentValue.includes(useCase) ? (
                            <CheckIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                          <span>{useCase}</span>
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

export default WorkspaceUseSelector
