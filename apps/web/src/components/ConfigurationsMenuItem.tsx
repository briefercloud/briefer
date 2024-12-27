import clsx from 'clsx'
import Link from 'next/link'
import router from 'next/router'
import { ConfigurationsMenuBlinkingSignal } from './BlinkingSignal'

type BaseConfigurationsMenuProps = {
  icon: React.ElementType
  text: string
  blink?: boolean
}

type ConfigurationsMenuLinkProps = BaseConfigurationsMenuProps & {
  href: string
}

type ConfigurationsMenuButtonProps = BaseConfigurationsMenuProps & {
  onClick: () => void
}

const ConfigurationsMenuLink = (props: ConfigurationsMenuLinkProps) => {
  return (
    <Link
      href={props.href}
      className={clsx(
        router.pathname.startsWith(props.href)
          ? 'text-gray-800 bg-ceramic-100/50'
          : 'text-gray-500 hover:bg-ceramic-100/80',
        'group text-sm font-medium leading-6 w-full flex py-1 hover:text-ceramic-600'
      )}
    >
      <div className="w-full flex items-center gap-x-2 px-4 relative">
        {props.blink && <ConfigurationsMenuBlinkingSignal />}
        <props.icon
          strokeWidth={1}
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        />
        <span className="mt-0.5">{props.text}</span>
      </div>
    </Link>
  )
}

const ConfigurationsMenuButton = (props: ConfigurationsMenuButtonProps) => {
  return (
    <button
      onClick={props.onClick}
      className={clsx(
        'group text-sm font-medium leading-6 w-full flex py-1 hover:text-ceramic-600',
        'text-gray-500 hover:bg-ceramic-100/80'
      )}
    >
      <div className="w-full flex items-center gap-x-2 px-4 relative">
        {props.blink && <ConfigurationsMenuBlinkingSignal />}
        <props.icon
          strokeWidth={1}
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        />
        <span className="mt-0.5">{props.text}</span>
      </div>
    </button>
  )
}

export { ConfigurationsMenuLink, ConfigurationsMenuButton }
