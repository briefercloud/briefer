import { CSSProperties, useEffect } from 'react'
import { useDragLayer, XYCoord } from 'react-dnd'
import IconSelector from './IconSelector'
import { ElementType } from './v2Editor'

function getItemStyles(
  initialCursorOffset: XYCoord | null,
  initialOffset: XYCoord | null,
  currentOffset: XYCoord | null
) {
  if (!initialOffset || !currentOffset || !initialCursorOffset) {
    return {
      display: 'none',
    }
  }

  const x = initialCursorOffset?.x + (currentOffset.x - initialOffset.x)
  const y = initialCursorOffset?.y + (currentOffset.y - initialOffset.y)
  const transform = `translate(${x}px, ${y}px)`

  return {
    transform,
    WebkitTransform: transform,
  }
}

const layerStyles: CSSProperties = {
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 100,
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
}

const isEditorBlock = (itemType: string | symbol | null) => {
  return itemType === ElementType.Block || itemType === ElementType.BlockGroup
}

const DragLayer = () => {
  const {
    item,
    itemType,
    isDragging,
    initialCursorOffset,
    initialFileOffset,
    currentFileOffset,
  } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    initialCursorOffset: monitor.getInitialClientOffset(),
    initialFileOffset: monitor.getInitialSourceClientOffset(),
    currentFileOffset: monitor.getSourceClientOffset(),
    isDragging: monitor.isDragging(),
  }))

  useEffect(() => {
    if (!isEditorBlock(itemType)) {
      return
    }

    const editorScrollview = document.getElementById('editor-scrollview')
    if (!editorScrollview) {
      return
    }

    let animationFrameId: number | null = null
    const scrollThresholdPixels = 120

    const scrollSmoothly = (scrollAmount: number) => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }

      const step = () => {
        editorScrollview.scrollBy({ top: scrollAmount })
        animationFrameId = requestAnimationFrame(step)
      }

      animationFrameId = requestAnimationFrame(step)
    }

    const handleDragOver = (e: DragEvent) => {
      const rect = document.body.getBoundingClientRect()
      const cursorY = e.clientY

      if (cursorY >= rect.top && cursorY <= rect.bottom) {
        const relativeY = cursorY - rect.top
        const viewportHeight = rect.height

        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }

        if (relativeY > viewportHeight - scrollThresholdPixels) {
          const distanceFromBottom = viewportHeight - relativeY
          const scrollSpeed = Math.max(
            2,
            (scrollThresholdPixels - distanceFromBottom) / 6
          )
          scrollSmoothly(scrollSpeed)
        } else if (relativeY < scrollThresholdPixels) {
          const scrollSpeed = Math.max(
            2,
            (scrollThresholdPixels - relativeY) / 6
          )
          scrollSmoothly(-scrollSpeed)
        }
      }
    }

    const handleDragEnd = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    }

    document.body.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragend', handleDragEnd)
    document.addEventListener('drop', handleDragEnd)

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      document.body.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragend', handleDragEnd)
      document.removeEventListener('drop', handleDragEnd)
    }
  }, [itemType])

  if (!isDragging || isEditorBlock(itemType)) {
    return null
  }

  return (
    <div style={layerStyles}>
      <div
        style={getItemStyles(
          initialCursorOffset,
          initialFileOffset,
          currentFileOffset
        )}
      >
        <div className="p-1 bg-ceramic-200 rounded-md max-w-48 text-sm opacity-25 truncate flex gap-x-1 items-center py-2 -translate-x-1/2 -translate-y-1/2 scale-[.85] -rotate-6">
          <IconSelector
            workspaceId={item.workspaceId}
            documentId={item.id}
            disabled={true}
          />
          {item.title || 'Untitled'}
        </div>
      </div>
    </div>
  )
}

export default DragLayer
