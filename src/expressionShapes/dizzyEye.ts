export interface RgbColor {
  red: number
  green: number
  blue: number
}

const DEFAULT_DIZZY_TINT: Readonly<RgbColor> = {
  red: 54,
  green: 47,
  blue: 72,
}

export const DIZZY_EYE_FIT = 0.92
const DIZZY_EYE_MAX_DISPLAY_SCALE = 2.2

/** Enlarge a spiral drawn smaller than its eye, without shrinking authored artwork. */
export function dizzyEyeDisplayScale(
  layerWidth: number,
  layerHeight: number,
  eye: { x0: number; x1: number; y0: number; y1: number },
): number {
  const layerSpan = Math.max(layerWidth, layerHeight)
  const eyeSpan = Math.max(eye.x1 - eye.x0, eye.y1 - eye.y0)
  if (layerSpan <= 0 || eyeSpan <= 0) return 1
  return clamp(
    (eyeSpan * DIZZY_EYE_FIT) / layerSpan,
    1,
    DIZZY_EYE_MAX_DISPLAY_SCALE,
  )
}

export function sampleDizzyEyeTint(
  rgba: Uint8ClampedArray | undefined,
): RgbColor {
  if (!rgba) return { ...DEFAULT_DIZZY_TINT }
  let red = 0
  let green = 0
  let blue = 0
  let total = 0
  for (let index = 0; index + 3 < rgba.length; index += 4) {
    const alpha = rgba[index + 3]
    if (alpha < 24) continue
    const luminance = (rgba[index] + rgba[index + 1] + rgba[index + 2]) / 3
    const darkness = 1 - luminance / 255
    const weight = alpha * darkness * darkness
    red += rgba[index] * weight
    green += rgba[index + 1] * weight
    blue += rgba[index + 2] * weight
    total += weight
  }
  if (total <= 0.001) return { ...DEFAULT_DIZZY_TINT }
  return {
    red: red / total,
    green: green / total,
    blue: blue / total,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
