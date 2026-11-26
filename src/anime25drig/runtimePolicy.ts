export interface Anime25DRenderSurface {
  bufferWidth: number
  bufferHeight: number
  displayWidth: number
  displayHeight: number
}

/**
 * Backing store shrinks slower than the CSS box (`scale ** power`).
 * Small faces keep extra texels; 1:1 and enlarged views still cap at
 * source × dpr. Not an SSAA pass on top of native pixels.
 */
const BACKING_DOWNSCALE_POWER = 0.85

export function resolveAnime25DRenderSurface(input: {
  sourceWidth: number
  sourceHeight: number
  cssWidth: number
  cssHeight: number
  devicePixelRatio: number
}): Anime25DRenderSurface {
  const sourceWidth = finiteDimension(input.sourceWidth)
  const sourceHeight = finiteDimension(input.sourceHeight)
  const cssWidth = finiteDimension(input.cssWidth)
  const cssHeight = finiteDimension(input.cssHeight)
  const dpr = Math.max(
    1,
    Math.min(
      2,
      Number.isFinite(input.devicePixelRatio) ? input.devicePixelRatio : 1,
    ),
  )
  const displayScale = Math.min(
    cssWidth / sourceWidth,
    cssHeight / sourceHeight,
  )
  const fitted = Math.min(1, displayScale)
  const renderScale = fitted ** BACKING_DOWNSCALE_POWER * dpr
  return {
    bufferWidth: Math.max(1, Math.round(sourceWidth * renderScale)),
    bufferHeight: Math.max(1, Math.round(sourceHeight * renderScale)),
    displayWidth: sourceWidth * displayScale,
    displayHeight: sourceHeight * displayScale,
  }
}

export function shouldApplyAnime25DResize(
  cssWidth: number,
  cssHeight: number,
): boolean {
  return (
    Number.isFinite(cssWidth) &&
    Number.isFinite(cssHeight) &&
    cssWidth >= 1 &&
    cssHeight >= 1
  )
}

function finiteDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, value) : 1
}
