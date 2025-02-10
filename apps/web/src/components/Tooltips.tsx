import useDropdownPosition from '@/hooks/dropdownPosition'
import { computeTooltipPosition } from '@/utils/dom'
import { Transition } from '@headlessui/react'
import clsx from 'clsx'
import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const Tooltip = ({
  title,
  message,
  children,
  className,
  position = 'top',
  tooltipClassname,
  active,
}: {
  title?: string
  message?: string
  children: React.ReactNode
  className?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'manual'
  tooltipClassname?: string
  active?: boolean
}) => {
  return (
    <div className={clsx(`group relative`, className)}>
      {children}

      {active && (
        <div
          className={clsx(
            'font-sans pointer-events-none absolute opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col items-center justify-center gap-y-1 z-[4000]',
            getPosClass(position),
            tooltipClassname
          )}
        >
          {title && <span>{title}</span>}
          {message && (
            <span className="inline-flex items-center justify-center text-gray-400 text-center">
              {message}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const getPosClass = (
  position: 'top' | 'bottom' | 'left' | 'right' | 'manual'
): string => {
  switch (position) {
    case 'top':
      return '-top-1 left-1/2 -translate-x-1/2 -translate-y-full'
    case 'bottom':
      return '-bottom-1 right-1/2 translate-x-1/2 translate-y-full'
    case 'left':
      return '-left-1 top-1/2 -translate-x-full -translate-y-1/2'
    case 'right':
      return 'right-0 top-1/2 translate-x-full -translate-y-1/2'
    case 'manual':
      return ''
  }
}

interface PortalTooltipProps {
  className?: string
  children: React.ReactNode
  content: React.ReactNode
  ignoreScrollableAncestor?: boolean
}
export function PortalTooltip(props: PortalTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const { onOpen, dropdownPosition } = useDropdownPosition(
    ref,
    'top',
    0,
    0,
    props.ignoreScrollableAncestor
  )
  useEffect(() => {
    if (active) {
      onOpen()
    }
  }, [active])

  return (
    <div
      className={clsx(props.className, 'relative')}
      ref={ref}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      {props.children}
      {createPortal(
        <div
          className={clsx(
            'absolute z-[2000] -translate-y-full pb-2 subpixel-antialiased transition-opacity',
            active ? 'opacity-100' : 'opacity-0 invisible'
          )}
          style={dropdownPosition}
        >
          {props.content}
        </div>,
        document.body
      )}
    </div>
  )
}

interface TooltipV2Props<T extends Element> {
  title?: string
  message?: string
  content?: (tooltipRef: React.RefObject<HTMLDivElement>) => React.ReactNode
  referenceRef?: React.RefObject<T>
  children: (ref: React.RefObject<T>) => React.ReactNode
  active: boolean
  className?: string
}
export function TooltipV2<T extends Element>(props: TooltipV2Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const _referenceRef = useRef<T>(null)
  const referenceRef = props.referenceRef ?? _referenceRef
  const [pos, setPos] = useState<CSSProperties>(
    computeTooltipPosition(parentRef, referenceRef, tooltipRef, 'top', 6, true)
  )
  const [hovering, setHovering] = useState(false)
  const onEnter = useCallback(() => {
    setHovering(true)
  }, [])
  const onLeave = useCallback(() => {
    setHovering(false)
  }, [])
  useEffect(() => {
    if (!parentRef.current || !props.active || !hovering) {
      return
    }

    const cb = () => {
      setPos(
        computeTooltipPosition(
          parentRef,
          referenceRef,
          tooltipRef,
          'top',
          6,
          true
        )
      )
    }

    const mut = new MutationObserver(cb)
    mut.observe(parentRef.current, {
      attributes: true,
      childList: true,
      subtree: true,
    })
    cb()

    return () => {
      mut.disconnect()
    }
  }, [parentRef, referenceRef, tooltipRef, props.active, hovering])

  return (
    <div ref={parentRef} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {props.children(referenceRef)}
      {props.active &&
        hovering &&
        createPortal(
          <Transition
            style={pos}
            className="absolute z-[2000] rounded-md"
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
            show={true}
          >
            {props.content ? (
              props.content(tooltipRef)
            ) : props.title || props.message ? (
              <div
                ref={tooltipRef}
                className={clsx(
                  'font-sans pointer-events-none bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col items-center justify-center gap-y-1 w-36',
                  props.className
                )}
              >
                <>
                  {props.title && (
                    <span className="text-center">{props.title}</span>
                  )}
                  {props.message && (
                    <span className="inline-flex items-center justify-center text-gray-400 text-center">
                      {props.message}
                    </span>
                  )}
                </>
              </div>
            ) : null}
          </Transition>,
          document.body
        )}
    </div>
  )
}
