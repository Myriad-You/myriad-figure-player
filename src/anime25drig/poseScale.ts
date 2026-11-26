/** Head roll about the neck per unit of `headRoll` in everyday motion, in radians. */
export const HEAD_ROLL_RADIANS = 0.15

/**
 * The head's full tilt at `headRoll` = ±1, about 24°.
 * Everyday motion stays below `HEAD_TILT_KNEE` and keeps a linear
 * roll; only a directed tilt goes past it, curving up to the full tilt.
 */
export const HEAD_TILT_RADIANS = 0.42
const HEAD_TILT_KNEE = 0.45

/** Head roll about the neck at `headRoll` (the driver value, ±1 at the full tilt), in radians. */
export function headRollRadians(headRoll: number): number {
  const amount = Math.abs(headRoll)
  const past = Math.max(0, (Math.min(1, amount) - HEAD_TILT_KNEE) / (1 - HEAD_TILT_KNEE))
  return Math.sign(headRoll) * (amount * HEAD_ROLL_RADIANS + past * past * (HEAD_TILT_RADIANS - HEAD_ROLL_RADIANS))
}

/** Upper-body lean at `body` = ±1, in radians; the canvas cut stays put. */
export const BODY_ROLL_RADIANS = 0.05

/**
 * How much of the lean a point at `y` takes: none on the canvas cut at
 * `pivotY`, all of it from `bendHeight` above. Mirrors the vertex shader.
 */
export function bodyLeanShare(y: number, pivotY: number, bendHeight: number): number {
  if (!(bendHeight > 0)) return 1
  const t = Math.max(0, Math.min(1, (pivotY - y) / bendHeight))
  return t * t * (3 - 2 * t)
}
