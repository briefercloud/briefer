import { DependencyList, RefObject, useCallback } from 'react'
import { useEffect, useState } from 'react'

const useScrollDetection = (containerRef: RefObject<HTMLDivElement>) => {
  const [isScrollable, setIsScrollable] = useState(
    (containerRef.current &&
      containerRef.current.scrollWidth > containerRef.current.clientWidth) ??
      false
  )

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const tabContainer = containerRef.current
    const handleScroll = () => {
      setIsScrollable(tabContainer.scrollWidth > tabContainer.clientWidth)

      if (
        Math.floor(tabContainer.scrollLeft) ===
        tabContainer.scrollWidth - tabContainer.clientWidth
      ) {
        setIsScrolledAllTheWayRight(true)
      } else {
        setIsScrolledAllTheWayRight(false)
      }

      if (Math.floor(tabContainer.scrollLeft) === 0) {
        setIsScrolledAllTheWayLeft(true)
      } else {
        setIsScrolledAllTheWayLeft(false)
      }
    }

    const observer = new MutationObserver(handleScroll)
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
    })
    window.addEventListener('resize', handleScroll)
    tabContainer.addEventListener('scroll', handleScroll)

    handleScroll()

    return () => {
      window.removeEventListener('resize', handleScroll)
      tabContainer.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [containerRef])

  const [isScrolledAllTheWayLeft, setIsScrolledAllTheWayLeft] = useState(true)
  const [isScrolledAllTheWayRight, setIsScrolledAllTheWayRight] =
    useState(false)

  const onClickScrollLeft = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft -= 100
    }
  }, [containerRef])

  const onClickScrollRight = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft += 100
    }
  }, [containerRef])

  return {
    isScrollable,
    isScrolledAllTheWayLeft,
    isScrolledAllTheWayRight,
    onClickScrollLeft,
    onClickScrollRight,
  }
}

export default useScrollDetection
