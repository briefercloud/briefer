import { Switch } from '@headlessui/react'
import clsx from 'clsx'
import { FieldValues, UseControllerProps, useController } from 'react-hook-form'

export default function Toggle<T extends FieldValues>(
  props: UseControllerProps<T> & { label: string }
) {
  const controller = useController(props)

  return (
    <Switch.Group as="div">
      <span className="flex flex-grow flex-col">
        <Switch.Label
          as="span"
          className="text-sm font-medium leading-6 text-gray-900"
          passive
        >
          {props.label}
        </Switch.Label>
      </span>
      <div className="mt-2">
        <Switch
          checked={controller.field.value}
          onChange={controller.field.onChange}
          className={clsx(
            controller.field.value ? 'bg-primary-500' : 'bg-gray-200',
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
          )}
        >
          <span
            aria-hidden="true"
            className={clsx(
              controller.field.value ? 'translate-x-5' : 'translate-x-0',
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
            )}
          />
        </Switch>
      </div>
    </Switch.Group>
  )
}
