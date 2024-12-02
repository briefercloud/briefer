import { useEffect, useState, useCallback } from 'react'

function useDropdownPosition(
  buttonRef: React.RefObject<HTMLElement>,
  anchor: 'top' | 'bottom' = 'bottom',
  paddingX = 0,
  paddingY = 0,
  ignoreScrollableAncestor = false
) {
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    right: 0,
  })

  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setContainerRect(node.getBoundingClientRect())
    }
  }, [])

  const calculateDropdownPosition = useCallback(() => {
    const currentButtonRef = buttonRef.current

    if (currentButtonRef) {
      const buttonRect = currentButtonRef.getBoundingClientRect()
      const scrollableAncestor =
        currentButtonRef.closest('.overflow-scroll') ??
        currentButtonRef.closest('.overflow-auto')

      if (!ignoreScrollableAncestor && scrollableAncestor) {
        const scrollableRect = scrollableAncestor.getBoundingClientRect()

        setDropdownPosition({
          top:
            anchor === 'bottom'
              ? buttonRect.bottom - scrollableRect.top
              : buttonRect.top - scrollableRect.top,
          left: buttonRect.left - scrollableRect.left,
          right: window.innerWidth - (buttonRect.right - scrollableRect.left),
        })
      } else {
        const isOutsideViewportX = containerRect
          ? buttonRect.left - containerRect.width < 0
          : false

        setDropdownPosition({
          top:
            anchor === 'bottom'
              ? buttonRect.bottom + window.scrollY
              : buttonRect.top + window.scrollY,
          left:
            containerRect && isOutsideViewportX
              ? buttonRect.right + containerRect.width + paddingX
              : buttonRect.left +
                buttonRect.width / 2 +
                window.scrollX -
                paddingX,
          right:
            containerRect && isOutsideViewportX
              ? buttonRect.right + containerRect.width + paddingX
              : window.innerWidth -
                (buttonRect.right + window.scrollX + paddingX),
        })
      }
    }
  }, [buttonRef, containerRect, anchor, paddingX])

  useEffect(() => {
    calculateDropdownPosition()
    const handleResize = () => calculateDropdownPosition()
    const handleScroll = () => calculateDropdownPosition()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)

    const resizeObserver = new ResizeObserver(() => {
      calculateDropdownPosition()
    })
    buttonRef.current && resizeObserver.observe(buttonRef.current)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
      resizeObserver.disconnect()
    }
  }, [calculateDropdownPosition, buttonRef])

  return { onOpen: calculateDropdownPosition, dropdownPosition, containerRef }
}

export default useDropdownPosition
