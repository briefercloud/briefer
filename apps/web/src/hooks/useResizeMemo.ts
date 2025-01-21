import { equals } from 'ramda'
import { useEffect, useState } from 'react'

export default function useResizeMemo<T>(
  handler: (rect: DOMRect | null) => T,
  domEl: HTMLElement | null
): T {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!domEl) {
      setRect(null)
      return
    }

    const cb = () => {
      setRect((prev) => {
        const next = domEl.getBoundingClientRect()
        if (equals(prev, next)) {
          return prev
        }

        return next
      })
    }

    const observer = new ResizeObserver(cb)

    observer.observe(domEl)
    document.addEventListener('scroll', cb, true)

    setRect(domEl.getBoundingClientRect())
    const interval = setInterval(cb, 500)

    return () => {
      observer.disconnect()
      document.removeEventListener('scroll', cb, true)
      clearInterval(interval)
    }
  }, [domEl])

  return handler(rect)
}
