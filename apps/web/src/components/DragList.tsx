import type { Identifier, XYCoord } from 'dnd-core'
import update from 'immutability-helper'
import { RefObject, useCallback, useRef } from 'react'
import {
  ConnectDragPreview,
  ConnectDragSource,
  ConnectDropTarget,
  useDrag,
  useDrop,
} from 'react-dnd'

export interface ItemProps {
  index: number
  move: (dragIndex: number, hoverIndex: number) => void
  children: (arg: {
    handlerId: string | symbol | null
    isDragging: boolean
    ref: RefObject<HTMLDivElement>
    drag: ConnectDragSource
    drop: ConnectDropTarget
    dragPreview: ConnectDragPreview
  }) => JSX.Element
  kind: string
}

interface DragItem {
  index: number
}

function Item(props: ItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [{ handlerId }, drop] = useDrop<
    DragItem,
    void,
    { handlerId: Identifier | null }
  >({
    accept: props.kind,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      }
    },
    hover(item: DragItem, monitor) {
      if (!ref.current) {
        return
      }
      const dragIndex = item.index
      const hoverIndex = props.index

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect()

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

      // Determine mouse position
      const clientOffset = monitor.getClientOffset()

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
      }

      // Time to actually perform the action
      props.move(dragIndex, hoverIndex)

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex
    },
  })

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: props.kind,
    item: () => {
      return { index: props.index }
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  return props.children({ handlerId, isDragging, ref, drag, drop, dragPreview })
}

export interface Item {
  id: number
  color: string
}

interface Props<T> {
  kind: string
  items: T[]
  onChange: (items: T[]) => void
  getKey: (item: T) => string
  children: (arg: {
    item: T
    index: number
    isDragging: boolean
    handlerId: string | symbol | null
    ref: RefObject<HTMLDivElement>
    drag: ConnectDragSource
    drop: ConnectDropTarget
    dragPreview: ConnectDragPreview
  }) => JSX.Element
}
export default function DragList<T>(props: Props<T>) {
  const move = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      props.onChange(
        update(props.items, {
          $splice: [
            [dragIndex, 1],
            [hoverIndex, 0, props.items[dragIndex]],
          ],
        })
      )
    },
    [props.items, props.onChange]
  )

  return (
    <>
      {props.items.map((item, index) => (
        <Item
          key={props.getKey(item)}
          index={index}
          move={move}
          kind={props.kind}
        >
          {(args) =>
            props.children({
              ...args,
              item,
              index,
            })
          }
        </Item>
      ))}
    </>
  )
}
