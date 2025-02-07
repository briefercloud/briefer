import { CSSProperties, RefObject } from 'react'

export function isInside(
  box: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  x: number,
  y: number
) {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
}

export function computeMenuPosition(
  referenceObject: RefObject<HTMLElement>,
  containerObject: RefObject<HTMLElement>,
  menuPosition: 'left' | 'right',
  padding: number
): CSSProperties {
  if (!referenceObject.current || !containerObject.current) {
    // render menu offscreen
    return {
      top: -9999,
      left: -9999,
    }
  }

  const referenceRect = referenceObject.current.getBoundingClientRect()
  const containerRect = containerObject.current.getBoundingClientRect()

  switch (menuPosition) {
    case 'left':
      return {
        top: referenceRect.top,
        left: referenceRect.left - containerRect.width - padding,
      }
    case 'right':
      return {
        top: referenceRect.top,
        left: referenceRect.left + referenceRect.width + 6,
      }
  }
}

export function computeTooltipPosition(
  commonParent: RefObject<HTMLElement>,
  reference: RefObject<HTMLElement>,
  tooltip: RefObject<HTMLElement>,
  tooltipPosition: 'top',
  padding: number
): CSSProperties {
  if (!reference.current || !tooltip.current || !commonParent.current) {
    // render tooltip offscreen
    return {
      top: -9999,
      left: -9999,
    }
  }

  const commonRect = commonParent.current.getBoundingClientRect()

  const origReferenceRect = reference.current.getBoundingClientRect()
  const origTooltipRect = tooltip.current.getBoundingClientRect()

  // make rects relative to commonRect
  const referenceRect = {
    top: origReferenceRect.top - commonRect.top,
    right: origReferenceRect.right - commonRect.left,
    bottom: origReferenceRect.bottom - commonRect.top,
    left: origReferenceRect.left - commonRect.left,
    width: origReferenceRect.width,
    height: origReferenceRect.height,
  }
  const tooltipRect = {
    top: origTooltipRect.top - commonRect.top,
    right: origTooltipRect.right - commonRect.left,
    bottom: origTooltipRect.bottom - commonRect.top,
    left: origTooltipRect.left - commonRect.left,
    width: origTooltipRect.width,
    height: origTooltipRect.height,
  }

  const referenceMiddleX = referenceRect.left + referenceRect.width / 2

  switch (tooltipPosition) {
    case 'top':
      let left = referenceMiddleX - tooltipRect.width / 2
      const top = referenceRect.top - tooltipRect.height - padding

      // if tooltip is out of screen, move it to the left so that its right
      // edge is aligned with the right edge of referenceRect
      const safeMargin = 36
      const rightEdgeInScreen = commonRect.left + left + tooltipRect.width

      if (rightEdgeInScreen + safeMargin > window.innerWidth) {
        left = referenceRect.right - tooltipRect.width
      }

      return {
        top,
        left,
      }
  }
}
