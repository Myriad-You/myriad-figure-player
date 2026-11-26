import type { Anime25DDriver } from './driver'
import type { Anime25DShellEllipsoid } from './types'
import { everyItem } from '../rig/lists'

/**
 * A correction's axes, keyed in `at`: the head's turn and nod (the driver's headYaw and headPitch), how far each eye
 * is closed (one less the driver's lidL or lidR), and the jaw's opening (jaw).
 */
export type PoseCorrectionAxis = 'headYaw' | 'headPitch' | 'lidCloseL' | 'lidCloseR' | 'jaw'

/** The axes as a package of version 7 keys them, in the same order as PoseCorrectionAxis's. */
export type PoseCorrectionAxisV7 = 'angleX' | 'angleY' | 'eyeCloseL' | 'eyeCloseR' | 'mouthOpen'

/**
 * Asset-space residuals (Lewis et al., https://scribblethink.org/Work/PSD/PSD.pdf).
 * This bounded brush/corner representation is not the paper's general RBF solver.
 * Coordinates and deltas use head radii, AFTER shell projection and BEFORE roll;
 * the shell blend then mixes the whole corrected shell once.
 * Patches sum (including overlaps); a higher-order key must contain only the
 * residual left AFTER lower-order corrections, never a second absolute pose.
 */
export interface PoseCorrection<Axis extends string = PoseCorrectionAxis> {
  surface: 'head' | 'front-hair' | 'back-hair'
  at: Partial<Record<Axis, number>>
  patches: Array<{
    x: number
    y: number
    radiusX: number
    radiusY: number
    dx: number
    dy: number
  }>
}

/** A correction as a package of version 7 writes it. */
export type PoseCorrectionV7 = PoseCorrection<PoseCorrectionAxisV7>

const AXES: readonly PoseCorrectionAxis[] = ['headYaw', 'headPitch', 'lidCloseL', 'lidCloseR', 'jaw']
const HEAD_AXES: ReadonlySet<string> = new Set<PoseCorrectionAxis>(['headYaw', 'headPitch'])

/** Each axis's version 7 key. */
const V7_AXES = {
  headYaw: 'angleX',
  headPitch: 'angleY',
  lidCloseL: 'eyeCloseL',
  lidCloseR: 'eyeCloseR',
  jaw: 'mouthOpen',
} as const satisfies Record<PoseCorrectionAxis, PoseCorrectionAxisV7>

const AXES_BY_V7_KEY: Readonly<Record<string, PoseCorrectionAxis>> = Object.fromEntries(
  Object.entries(V7_AXES).map(([axis, key]) => [key, axis as PoseCorrectionAxis]),
)

/** Corrections with their `at` keys renamed, each kept in its place. */
function renameAxes<From extends string, To extends string>(
  corrections: readonly PoseCorrection<From>[],
  names: Readonly<Record<string, string>>,
): PoseCorrection<To>[] {
  return corrections.map(correction => ({
    ...correction,
    at: Object.fromEntries(Object.entries(correction.at).map(([key, value]) => [names[key] ?? key, value])) as PoseCorrection<To>['at'],
  }))
}

/** A version 7 package's corrections in the axes the runtime reads. */
export function poseCorrectionsFromV7(corrections: readonly PoseCorrectionV7[]): PoseCorrection[] {
  return renameAxes(corrections, AXES_BY_V7_KEY)
}

/** Corrections as a package of version 7 writes them. */
export function poseCorrectionsToV7(corrections: readonly PoseCorrection[]): PoseCorrectionV7[] {
  return renameAxes(corrections, V7_AXES)
}

export function poseCorrectionCornerKey(correction: Pick<PoseCorrection, 'surface' | 'at'>): string {
  return `${correction.surface}:${AXES.filter(k => correction.at[k] !== undefined).map(k => `${k}:${Math.sign(correction.at[k]!)}`).join(',')}`
}

/**
 * Whether `value` is a list of corrections keyed by PoseCorrectionAxis. One corner per axis/sign combination;
 * neighbouring corners do not add twice.
 */
export function isPoseCorrections(value: unknown): value is PoseCorrection[] {
  return Array.isArray(value) && arePoseCorrections(value, AXES)
}

/** Whether `value` is a list of corrections as a package of version 7 writes them. */
export function isPoseCorrectionsV7(value: unknown): value is PoseCorrectionV7[] {
  return Array.isArray(value) &&
    everyItem(value, item => Boolean(item) && typeof item === 'object' && isAxisRecord((item as PoseCorrection<string>).at, AXES_BY_V7_KEY)) &&
    isPoseCorrections(poseCorrectionsFromV7(value as PoseCorrectionV7[]))
}

/** Keyed only by `names`' keys, so that renaming leaves no two on one axis and none unnamed. */
function isAxisRecord(at: unknown, names: Readonly<Record<string, string>>): boolean {
  return Boolean(at) && typeof at === 'object' && !Array.isArray(at) && Object.keys(at as object).every(key => Object.hasOwn(names, key))
}

function arePoseCorrections(value: readonly unknown[], axes: readonly string[]): boolean {
  if (value.length > 16) return false
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
    const at = correction.at as Record<string, unknown>
    const keys = Object.keys(at)
    if (keys.length < 2 || keys.length > 3 || !keys.some(k => HEAD_AXES.has(k))) return false
    if (
      !keys.every(k =>
        axes.includes(k) &&
        finite(at[k], -1, 1) &&
        (HEAD_AXES.has(k) ? Math.abs(at[k]) >= 0.05 : at[k] >= 0.05))
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

/** How much of a corner a pose holds: each axis eased in on its way to the corner. */
export function poseCorrectionWeight(
  axes: ReadonlyArray<readonly [PoseCorrectionAxis, number]>,
  driver: Readonly<PoseCorrectionDriver>,
): number {
  let weight = 1
  for (const [axis, target] of axes) {
    const value =
      axis === 'lidCloseL'
        ? 1 - driver.lidL
        : axis === 'lidCloseR'
          ? 1 - driver.lidR
          : driver[axis]
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
