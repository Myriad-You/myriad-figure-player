/** The idle sway's offsets over the pose, in driver units. */
export interface Anime25DIdleSwayOffset {
  headYaw: number
  headPitch: number
  headRoll: number
  bodyLean: number
}

/** The idle sway at `timeSeconds`: slow, incommensurate swings of the head's turn, nod and tilt and the body's lean. */
export function idleSwayOffset(
  timeSeconds: number,
  output: Anime25DIdleSwayOffset = { headYaw: 0, headPitch: 0, headRoll: 0, bodyLean: 0 },
): Anime25DIdleSwayOffset {
  const time = Number.isFinite(timeSeconds) ? timeSeconds : 0
  output.headYaw =
    0.13 * Math.sin(time * 0.42) + 0.05 * Math.sin(time * 1.13)
  output.headPitch = 0.08 * Math.sin(time * 0.31 + 1.7)
  output.headRoll = 0.1 * Math.sin(time * 0.23 + 0.5)
  output.bodyLean = 0.16 * Math.sin(time * 0.19 + 2.1)
  return output
}
