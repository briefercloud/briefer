import { isInside } from '@/utils/dom'
import { useEffect } from 'react'

function isInsideRef(
  ref: React.RefObject<HTMLElement | null>,
  event: MouseEvent | TouchEvent
) {
  const element = ref.current
  if (!element) {
    return false
  }

  const rect = element.getBoundingClientRect()

  if ('touches' in event) {
    return Array.from(event.touches).some((touch) =>
      isInside(rect, touch.clientX, touch.clientY)
    )
  }

  return isInside(rect, event.clientX, event.clientY)
}

export function useOnClickOutside(
  handler: (e: MouseEvent | TouchEvent) => void,
  ref: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  useEffect(() => {
    if (!active) {
      return
    }

    function onEvent(event: MouseEvent | TouchEvent) {
      if (isInsideRef(ref, event)) {
        return
      }

      handler(event)
    }

    document.addEventListener('mouseup', onEvent)
    document.addEventListener('touchend', onEvent)

    return () => {
      document.removeEventListener('mouseup', onEvent)
      document.removeEventListener('touchend', onEvent)
    }
  }, [ref, active])
}

export function useOnClickOutside2(
  handler: (e: MouseEvent | TouchEvent) => void,
  ref1: React.RefObject<HTMLElement | null>,
  ref2: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  useEffect(() => {
    if (!active) {
      return
    }

    function onEvent(event: MouseEvent | TouchEvent) {
      if (isInsideRef(ref1, event) || isInsideRef(ref2, event)) {
        return
      }

      handler(event)
    }

    document.addEventListener('mouseup', onEvent)
    document.addEventListener('touchend', onEvent)

    return () => {
      document.removeEventListener('mouseup', onEvent)
      document.removeEventListener('touchend', onEvent)
    }
  }, [ref1, ref2, active])
}
