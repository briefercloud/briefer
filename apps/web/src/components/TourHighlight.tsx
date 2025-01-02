import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { useTourHighlight } from './TourHighlightProvider'

interface Position {
  top: number
  left: number
  width: number
  height: number
}

const TourHighlight: React.FC = () => {
  const [{ selector, isTourActive }, { setTourActive }] = useTourHighlight()
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    if (selector) {
      const element = document.querySelector(selector) as HTMLElement | null
      if (element) {
        const rect = element.getBoundingClientRect()
        setPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        })
      } else {
        console.warn(`No element found for selector: "${selector}"`)
        setPosition(null)
      }
    }
  }, [selector, isTourActive])

  const posStyle = position
    ? {
        top: position.top - 2,
        left: position.left - 2,
        width: position.width + 4,
        height: position.height + 4,
      }
    : {}

  useEffect(() => {
    // dismiss tour on any clicks or key presses or after 5 seconds
    const dismiss = () => {
      setTourActive(false)
    }

    document.addEventListener('click', dismiss)
    document.addEventListener('keydown', dismiss)

    const timeout = setTimeout(() => {
      setTourActive(false)
    }, 5000)

    return () => {
      document.removeEventListener('click', dismiss)
      document.removeEventListener('keydown', dismiss)
      clearTimeout(timeout)
    }
  })

  return ReactDOM.createPortal(
    <div
      id="tour-highlight"
      style={{
        position: 'absolute',
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
        border: '1px solid #76ad03',
        borderRadius: '4px',
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: isTourActive && position ? 1 : 0,
        transition: 'opacity 0.3s',
        ...posStyle,
      }}
    ></div>,
    document.body
  )
}

export default TourHighlight
