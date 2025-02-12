import clsx from 'clsx'
import { ReactNode, forwardRef } from 'react'
import SimpleBar from 'simplebar-react'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  disabled?: boolean
}
const ScrollBar = forwardRef<HTMLDivElement, Props>(
  function ScrollBar(props, ref) {
    // This is actually not ideal because some MacOS systems may be
    // configured to always show scrollbars.
    // if (
    //   props.disabled ||
    //   (typeof window !== 'undefined' &&
    //     window.navigator.userAgent.toUpperCase().includes('MAC OS'))
    // ) {
    //   return <div {...props} ref={ref} />
    // }

    return (
      <SimpleBar
        className={clsx('no-scrollbar', props.className)}
        scrollableNodeProps={{
          ref,
        }}
      >
        {props.children}
      </SimpleBar>
    )
  }
)

export default ScrollBar
