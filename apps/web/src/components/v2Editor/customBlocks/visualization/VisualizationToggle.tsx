import { Switch } from '@headlessui/react'
import clsx from 'clsx'

interface Props {
  label: string
  enabled: boolean
  onToggle: (showDataLabels: boolean) => void
  disabled?: boolean
}

function VisualizationToggle({ label, enabled, onToggle, disabled }: Props) {
  return (
    <Switch.Group
      as="div"
      className="flex items-center justify-between text-xs"
    >
      <span className="flex flex-grow flex-col">
        <Switch.Label
          as="span"
          className="font-medium leading-6 text-gray-900"
          passive
        >
          {label}
        </Switch.Label>
      </span>
      <Switch
        checked={enabled}
        onChange={onToggle}
        className={clsx(
          enabled ? 'bg-primary-600' : 'bg-gray-200',
          'relative inline-flex h-5 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2'
        )}
        disabled={disabled}
      >
        <span
          aria-hidden="true"
          className={clsx(
            enabled ? 'translate-x-3' : 'translate-x-0',
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
          )}
        />
      </Switch>
    </Switch.Group>
  )
}

export default VisualizationToggle
