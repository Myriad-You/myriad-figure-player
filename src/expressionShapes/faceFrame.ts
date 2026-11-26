import type { Anime25DRiggerAnchors } from '../anime25drig/playback'

/** Beyond this the eye line is more likely a detection error than a head tilt. */
const MAX_FACE_ROLL = (20 * Math.PI) / 180
/** Below this, resampling would only soften generated line art. */
const MIN_FACE_ROLL = (0.5 * Math.PI) / 180

/**
 * The drawn face's own axes: `along` follows the iris-to-iris line and `down`
 * is perpendicular to it. Generated expression art is authored upright in this
 * frame, so a tilted portrait gets tilted glyphs instead of screen-level ones.
 */
export interface Anime25DFaceFrame {
  /** Image-space rotation of the eye line (y down), in radians. */
  roll: number
  cos: number
  sin: number
  /** Midpoint between the iris centres. */
  originX: number
  originY: number
  /** Iris-to-iris distance. */
  eyeSpan: number
  /** False when an eye anchor is missing and the frame is only the face box. */
  landmarks: boolean
}

export function resolveAnime25DFaceFrame(
  anchors: Pick<Anime25DRiggerAnchors, 'eyeL' | 'eyeR' | 'face'>,
): Anime25DFaceFrame {
  const { eyeL, eyeR, face } = anchors
  if (eyeL && eyeR && eyeR.icx > eyeL.icx) {
    const dx = eyeR.icx - eyeL.icx
    const dy = eyeR.icy - eyeL.icy
    const measured = Math.atan2(dy, dx)
    const roll =
      Math.abs(measured) < MIN_FACE_ROLL
        ? 0
        : clamp(measured, -MAX_FACE_ROLL, MAX_FACE_ROLL)
    return {
      roll,
      cos: Math.cos(roll),
      sin: Math.sin(roll),
      originX: (eyeL.icx + eyeR.icx) / 2,
      originY: (eyeL.icy + eyeR.icy) / 2,
      eyeSpan: Math.hypot(dx, dy),
      landmarks: true,
    }
  }
  return {
    roll: 0,
    cos: 1,
    sin: 0,
    originX: face.cx,
    originY: face.cy,
    eyeSpan: Math.max(1, face.x1 - face.x0) * 0.46,
    landmarks: false,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
