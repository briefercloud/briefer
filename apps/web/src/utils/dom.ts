export function isInside(
  box: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  x: number,
  y: number
) {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
}
