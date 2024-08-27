let canvas: HTMLCanvasElement | null = null
export function measureText(
  text: string,
  size: number,
  weight: string,
  font: string
): TextMetrics {
  if (!canvas) {
    canvas = document.createElement('canvas')
  }
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not get 2d context from canvas')
  }

  context.font = `${weight} ${size}px ${font}`
  const measure = context.measureText(text)
  return measure
}

export function findMaxFontSize(
  text: string,
  initialFontSize: number,
  maximumTextWidth: number,
  weight: string,
  font: string
): number {
  let fontSize = initialFontSize
  while (true) {
    const measure = measureText(text, fontSize, weight, font)
    if (measure.width > maximumTextWidth) {
      fontSize--
    } else {
      break
    }
  }

  return fontSize
}
