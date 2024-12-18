import clsx from 'clsx'

interface Props {
  position: string
  dotColor: string
  pulseColor: string
}
function BlinkingSignal(props: Props) {
  return (
    <span className={clsx('absolute flex h-2 w-2', props.position)}>
      <span
        className={clsx(
          'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
          props.pulseColor
        )}
      ></span>
      <span
        className={clsx(
          'relative inline-flex rounded-full h-2 w-2',
          props.dotColor
        )}
      ></span>
    </span>
  )
}

export function ConfigurationsMenuBlinkingSignal() {
  return (
    <BlinkingSignal
      position="top-0.5 left-1 translate-x-full"
      pulseColor="bg-yellow-700"
      dotColor="bg-yellow-500"
    />
  )
}

export function PublishBlinkingSignal() {
  return (
    <BlinkingSignal
      position="top-0 right-0"
      pulseColor="bg-primary-700"
      dotColor="bg-primary-500"
    />
  )
}
