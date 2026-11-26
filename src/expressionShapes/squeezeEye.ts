export const SQUEEZE_EYE_WIDTH_FIT = 1.04
const SQUEEZE_EYE_MAX_DISPLAY_SCALE = 2.2

export function squeezeEyeDisplayScale(
  layerWidth: number,
  eye: { x0: number; x1: number },
): number {
  const eyeWidth = eye.x1 - eye.x0
  if (layerWidth <= 0 || eyeWidth <= 0) return 1
  return clamp(
    (eyeWidth * SQUEEZE_EYE_WIDTH_FIT) / layerWidth,
    1,
    SQUEEZE_EYE_MAX_DISPLAY_SCALE,
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
