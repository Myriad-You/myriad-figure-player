import type { Anime25DDriver } from './driver'
import type { Anime25DShellEllipsoid } from './types'
import { everyItem } from '../rig/lists'

/**
 * A correction's axes, keyed in `at` as a package writes them: the head's turn and nod (`angleX`, `angleY`, read
 * from the driver's headYaw and headPitch), each eye's closing, and the mouth's opening (`mouthOpen`, from jaw).
 */
export type PoseCorrectionAxis =
  'angleX' | 'angleY' | 'eyeCloseL' | 'eyeCloseR' | 'mouthOpen'

/**
 * Asset-space residuals (Lewis et al., https://scribblethink.org/Work/PSD/PSD.pdf).
 * This bounded brush/corner representation is not the paper's general RBF solver.
 * Coordinates and deltas use head radii, AFTER shell projection and BEFORE roll;
 * the shell blend then mixes the whole corrected shell once.
 * Patches sum (including overlaps); a higher-order key must contain only the
 * residual left AFTER lower-order corrections, never a second absolute pose.
 */
export interface PoseCorrection {
  surface: 'head' | 'front-hair' | 'back-hair'
  at: Partial<Record<PoseCorrectionAxis, number>>
  patches: Array<{
    x: number
    y: number
    radiusX: number
    radiusY: number
    dx: number
    dy: number
  }>
}

const AXES: readonly PoseCorrectionAxis[] = [
  'angleX',
  'angleY',
  'eyeCloseL',
  'eyeCloseR',
  'mouthOpen',
]

export function poseCorrectionCornerKey(correction: Pick<PoseCorrection, 'surface' | 'at'>): string {
  return `${correction.surface}:${AXES.filter(k => correction.at[k] !== undefined).map(k => `${k}:${Math.sign(correction.at[k]!)}`).join(',')}`
}

/** One corner per axis/sign combination. Neighbouring corners do not add twice. */
export function isPoseCorrections(value: unknown): value is PoseCorrection[] {
  if (!Array.isArray(value) || value.length > 16) return false
  const corners = new Set<string>()
  return everyItem(value, (item) => {
    const correction = item as PoseCorrection
    if (
      !correction ||
      typeof correction !== 'object' ||
      !['head', 'front-hair', 'back-hair'].includes(correction.surface) ||
      !correction.at ||
      typeof correction.at !== 'object' ||
      Array.isArray(correction.at) ||
      !Array.isArray(correction.patches) ||
      !correction.patches.length ||
      correction.patches.length > 8
    ) {
      return false
    }
    const keys = Object.keys(correction.at)
    if (
      keys.length < 2 ||
      keys.length > 3 ||
      !keys.some((k) => k === 'angleX' || k === 'angleY')
    ) {
      return false
    }
    if (
      !keys.every(
        (k) =>
          AXES.includes(k as PoseCorrectionAxis) &&
          finite(correction.at[k as PoseCorrectionAxis], -1, 1) &&
          (k === 'angleX' || k === 'angleY'
            ? Math.abs(correction.at[k as PoseCorrectionAxis]!) >= 0.05
            : correction.at[k as PoseCorrectionAxis]! >= 0.05),
      )
    ) {
      return false
    }
    const corner = poseCorrectionCornerKey(correction)
    if (corners.has(corner)) return false
    corners.add(corner)
    return everyItem(
      correction.patches,
      (patch) => {
        const p = patch as PoseCorrection['patches'][number]
        return Boolean(p) &&
        finite(p.x, -2, 2) &&
        finite(p.y, -2, 2) &&
        finite(p.radiusX, 0.1, 2) &&
        finite(p.radiusY, 0.1, 2) &&
        finite(p.dx, -0.25, 0.25) &&
        finite(p.dy, -0.25, 0.25)
      },
    )
  })
}

/** Compact C2 radial brush: zero displacement AND slope at its boundary. */
export function poseCorrectionInfluence(r: number): number {
  return r >= 1 ? 0 : (1 - r) ** 4 * (1 + 4 * r)
}

export interface BoundPoseCorrection {
  axes: Array<readonly [PoseCorrectionAxis, number]>
  offsets: Float32Array
  weight: number
}

/** Compile spatial influence once; no brush distances or allocations in the vertex loop. */
export function bindPoseCorrections(
  corrections: readonly PoseCorrection[] | undefined,
  surface: PoseCorrection['surface'] | null,
  rest: Float32Array,
  head: Readonly<Anime25DShellEllipsoid>,
): BoundPoseCorrection[] | undefined {
  const result: BoundPoseCorrection[] = []
  for (const correction of corrections ?? []) {
    if (correction.surface !== surface) continue
    const offsets = new Float32Array(rest.length)
    let nonzero = false
    for (let i = 0; i < rest.length; i += 2) {
      const x = (rest[i] - head.centerX) / head.radiusX
      const y = (rest[i + 1] - head.centerY) / head.radiusY
      for (const patch of correction.patches) {
        const r = Math.hypot(
          (x - patch.x) / patch.radiusX,
          (y - patch.y) / patch.radiusY,
        )
        if (r >= 1) continue
        const influence = poseCorrectionInfluence(r)
        offsets[i] += patch.dx * head.radiusX * influence
        offsets[i + 1] += patch.dy * head.radiusY * influence
      }
      nonzero ||= offsets[i] !== 0 || offsets[i + 1] !== 0
    }
    if (nonzero) {
      result.push({
        axes: AXES.filter((axis) => correction.at[axis] !== undefined).map(
          (axis) => [axis, correction.at[axis]!],
        ),
        offsets,
        weight: 0,
      })
    }
  }
  return result.length ? result : undefined
}

export type PoseCorrectionDriver = Pick<
  Anime25DDriver,
  'headYaw' | 'headPitch' | 'lidL' | 'lidR' | 'jaw'
>

/** The driver field an axis reads as it stands; the eye-close axes read a lid's complement. */
const AXIS_DRIVER_FIELDS = {
  angleX: 'headYaw',
  angleY: 'headPitch',
  mouthOpen: 'jaw',
} as const satisfies Record<Exclude<PoseCorrectionAxis, 'eyeCloseL' | 'eyeCloseR'>, keyof PoseCorrectionDriver>

/** How much of a corner a pose holds: each axis eased in on its way to the corner. */
export function poseCorrectionWeight(
  axes: ReadonlyArray<readonly [PoseCorrectionAxis, number]>,
  driver: Readonly<PoseCorrectionDriver>,
): number {
  let weight = 1
  for (const [axis, target] of axes) {
    const value =
      axis === 'eyeCloseL'
        ? 1 - driver.lidL
        : axis === 'eyeCloseR'
          ? 1 - driver.lidR
          : driver[AXIS_DRIVER_FIELDS[axis]]
    const t = Math.max(0, Math.min(1, value / target))
    weight *= t * t * (3 - 2 * t)
  }
  return weight
}

export function writePoseCorrectionWeights(
  bindings: BoundPoseCorrection[],
  driver: Readonly<PoseCorrectionDriver>,
): void {
  for (const binding of bindings) binding.weight = poseCorrectionWeight(binding.axes, driver)
}

export function applyPoseCorrections(
  point: { x: number; y: number },
  vertex: number,
  bindings: readonly BoundPoseCorrection[],
): void {
  for (const binding of bindings) {
    if (binding.weight === 0) continue
    point.x += binding.offsets[vertex * 2] * binding.weight
    point.y += binding.offsets[vertex * 2 + 1] * binding.weight
  }
}

function finite(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  )
}
