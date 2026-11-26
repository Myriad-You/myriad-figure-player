const CRY_EYE_WIDTH_FIT = 1.1
const CRY_EYE_MAX_DISPLAY_SCALE = 2.2

/** Enlarge undersized authored crying eyes without shrinking deliberate art. */
export function cryEyeDisplayScale(
  layerWidth: number,
  eye: { x0: number; x1: number },
): number {
  const eyeWidth = eye.x1 - eye.x0
  if (layerWidth <= 0 || eyeWidth <= 0) return 1
  return clamp(
    (eyeWidth * CRY_EYE_WIDTH_FIT) / layerWidth,
    1,
    CRY_EYE_MAX_DISPLAY_SCALE,
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
