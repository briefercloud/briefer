import { useEffect, useRef, useState } from 'react'

interface Props {
  width: number
  children: React.ReactNode
  disableScale?: boolean
}

function ScaleChild(props: Props) {
  const measureWidth = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(null as number | null)
  useEffect(() => {
    if (measureWidth.current) {
      setWidth(measureWidth.current.getBoundingClientRect().width)
    }
  }, [measureWidth.current])

  const measureHeight = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(null as number | null)
  useEffect(() => {
    if (measureHeight.current) {
      // wait until height is not changed
      let height = -1
      const checkHeight = () => {
        if (!measureHeight.current) {
          return
        }

        const newHeight = measureHeight.current.getBoundingClientRect().height
        if (height === newHeight) {
          setHeight(height)
        } else {
          height = newHeight
          requestAnimationFrame(checkHeight)
        }
      }

      checkHeight()
    }
  }, [measureHeight.current])

  if (props.disableScale) {
    return <div>{props.children}</div>
  }

  if (!width || !height) {
    return (
      <div className="w-full" ref={measureWidth}>
        <div ref={measureHeight} style={{ width: props.width }}>
          {props.children}
        </div>
      </div>
    )
  }

  const scale = width / props.width

  return (
    <div
      style={{
        width: props.width,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        height: height * scale,
      }}
    >
      {props.children}
    </div>
  )
}

export default ScaleChild
