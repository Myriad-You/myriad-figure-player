import type { MeropeRigManifest } from '../rig/types'
import type { Anime25DDriver } from './driver'
import type { Anime25DPlaybackLayer } from './types'
import { headTurnRadians } from './headTurn'

export interface Anime25DMotionEnvelopeAxis {
  startsAt: number
  limit: number
}

export interface Anime25DMotionEnvelopeProfile {
  highCollar: boolean
  armMotion: boolean
  pitch: Anime25DMotionEnvelopeAxis
  torso: Anime25DMotionEnvelopeAxis
  rigidArm: Anime25DMotionEnvelopeAxis
  /** Head turn and tilt; narrow only while a hand rests on the head. */
  headTurn: Anime25DMotionEnvelopeAxis
  headTilt: Anime25DMotionEnvelopeAxis
}

/** What the arms' drawing allows. */
export interface Anime25DHandPose {
  /** The hands hold each other: the arms cannot open or sway apart. */
  linked?: boolean
  /** A hand rests on the head: the head cannot turn far out from under it. */
  touchingHead?: boolean
}

export interface Anime25DMotionEnvelopeResult {
  clippedEnergy: number
  transferredEnergy: number
}

export const ANIME25D_MOTION_ENVELOPE_PROBES = [
  { id: 'turn-left', driver: { headYaw: -1 } },
  { id: 'turn-right', driver: { headYaw: 1 } },
  { id: 'pitch-up', driver: { headPitch: 1 } },
  { id: 'pitch-down', driver: { headPitch: -1 } },
  {
    id: 'full-left',
    driver: {
      headYaw: -1,
      headPitch: 1,
      headRoll: -1,
      gazeX: -1,
      gazeY: 0.6,
      bodyLean: -1,
      armY: 1,
      armPos: -1,
    },
  },
  {
    id: 'full-right',
    driver: {
      headYaw: 1,
      headPitch: -1,
      headRoll: 1,
      gazeX: 1,
      gazeY: -0.6,
      bodyLean: 1,
      armY: 1,
      armPos: 1,
    },
  },
] as const satisfies readonly {
  id: string
  driver: Readonly<Partial<Anime25DDriver>>
}[]

export type Anime25DMotionEnvelopeProbeId =
  (typeof ANIME25D_MOTION_ENVELOPE_PROBES)[number]['id']

interface MotionEnvelopePlayback {
  layers: readonly Pick<Anime25DPlaybackLayer, 'role'>[]
  /** Keyed turns go to about 30°, others 11° (headTurnRadians). */
  turnKeyforms?: unknown
}
type MotionEnvelopeManifest = Pick<MeropeRigManifest, 'outfitProfile'>

export function deriveAnime25DMotionEnvelopeProfile(
  playback: Readonly<MotionEnvelopePlayback>,
  manifest?: Readonly<MotionEnvelopeManifest>,
  hands: Readonly<Anime25DHandPose> = {},
): Anime25DMotionEnvelopeProfile {
  const highCollar = playback.layers.some(
    (layer) => layer.role === 'collar-back' || layer.role === 'collar-front',
  )
  const armMotion = playback.layers.some((layer) => layer.role === 'handwear')
  const turnRadians = headTurnRadians(Boolean(playback.turnKeyforms))
  const torsoLimit = clamp(
    finiteOr(manifest?.outfitProfile?.torsoTwistScale, 1),
    0.25,
    1,
  )
  // Hands holding each other cannot open or sway apart; arm gestures go to the body.
  const rigidArmLimit = armMotion && !hands.linked
    ? clamp(
        finiteOr(manifest?.outfitProfile?.secondaryMotionScale, 1),
        0.2,
        1,
      )
    : 0
  return {
    highCollar,
    armMotion,
    pitch: hands.touchingHead
      ? axisEnvelope(HEAD_CONTACT_STARTS_AT, HEAD_CONTACT_LIMIT)
      : axisEnvelope(highCollar ? 0.56 : 1, highCollar ? 0.8 : 1),
    torso: axisEnvelope(torsoLimit * 0.78, torsoLimit),
    rigidArm: axisEnvelope(rigidArmLimit * 0.78, rigidArmLimit),
    headTurn: hands.touchingHead
      ? axisEnvelope(HEAD_CONTACT_TURN_STARTS_AT / turnRadians, HEAD_CONTACT_TURN_LIMIT / turnRadians)
      : axisEnvelope(1, 1),
    headTilt: hands.touchingHead
      ? axisEnvelope(HEAD_CONTACT_STARTS_AT, HEAD_CONTACT_LIMIT)
      : axisEnvelope(1, 1),
  }
}

export function projectAnime25DMotionEnvelope(
  target: Anime25DDriver,
  profile: Readonly<Anime25DMotionEnvelopeProfile>,
  result: Anime25DMotionEnvelopeResult,
): Anime25DMotionEnvelopeResult {
  result.clippedEnergy = 0
  result.transferredEnergy = 0

  const originalPitch = finite(target.headPitch)
  const safePitch = softLimitSigned(originalPitch, profile.pitch)
  const residual = originalPitch - safePitch
  target.headPitch = safePitch
  transferPitchResidual(target, residual, profile.armMotion, result)

  if (profile.armMotion) {
    const originalArmY = finite(target.armY)
    const safeArmY = softLimitSigned(originalArmY, profile.rigidArm)
    target.armY = safeArmY
    transferArmResidual(target, originalArmY - safeArmY, true, result)

    const originalArmPos = finite(target.armPos)
    const safeArmPos = softLimitSigned(originalArmPos, profile.rigidArm)
    target.armPos = safeArmPos
    transferArmResidual(target, originalArmPos - safeArmPos, false, result)
  }

  const originalBody = finite(target.bodyLean)
  target.torsoTurn = softLimitSigned(finite(target.torsoTurn), profile.torso)
  for (const key of ['armRaiseL', 'armRaiseR', 'armSwingL', 'armSwingR'] as const) {
    target[key] = softLimitSigned(finite(target[key]), profile.rigidArm)
  }
  const safeBody = softLimitSigned(originalBody, profile.torso)
  target.bodyLean = safeBody
  transferTorsoResidual(target, originalBody - safeBody, result)

  if (profile.headTurn.limit < 1 || profile.headTilt.limit < 1) {
    // Last, after every other transfer has landed on the head: the hand on
    // the head stays with the body, so the look turns with the eyes and torso.
    const yaw = finite(target.headYaw)
    target.headYaw = softLimitSigned(yaw, profile.headTurn)
    transferHeadTurnResidual(target, yaw - target.headYaw, result)
    const roll = finite(target.headRoll)
    target.headRoll = softLimitSigned(roll, profile.headTilt)
    noteTransfer(result, Math.abs(roll - target.headRoll))
    target.bodyLean = softLimitSigned(addBounded(target.bodyLean, (roll - target.headRoll) * 0.3), profile.torso)
  }
  return result
}

function transferPitchResidual(
  target: Anime25DDriver,
  residual: number,
  armMotion: boolean,
  result: Anime25DMotionEnvelopeResult,
): void {
  const amount = Math.abs(residual)
  if (amount <= 1e-6) return
  noteTransfer(result, amount)
  const side = preferredSide(target)
  target.headYaw = addBounded(target.headYaw, side * amount * 0.34)
  target.headRoll = addBounded(target.headRoll, side * amount * 0.2)
  target.gazeX = addBounded(target.gazeX, side * amount * 0.16)
  target.gazeY = addBounded(target.gazeY, Math.sign(residual) * amount * 0.12)
  target.bodyLean = addBounded(target.bodyLean, Math.sign(residual) * amount * 0.26)
  if (armMotion) {
    target.armY = addBounded(target.armY, amount * 0.24)
    target.armPos = addBounded(target.armPos, side * amount * 0.18)
  }
}

function transferHeadTurnResidual(
  target: Anime25DDriver,
  residual: number,
  result: Anime25DMotionEnvelopeResult,
): void {
  const amount = Math.abs(residual)
  if (amount <= 1e-6) return
  noteTransfer(result, amount)
  target.bodyLean = addBounded(target.bodyLean, residual * 0.45)
  target.gazeX = addBounded(target.gazeX, residual * 0.4)
}

function transferArmResidual(
  target: Anime25DDriver,
  residual: number,
  vertical: boolean,
  result: Anime25DMotionEnvelopeResult,
): void {
  const amount = Math.abs(residual)
  if (amount <= 1e-6) return
  noteTransfer(result, amount)
  const side = preferredSide(target)
  const direction = Math.sign(residual) || 1
  target.headYaw = addBounded(
    target.headYaw,
    direction * amount * (vertical ? 0.18 : 0.3),
  )
  target.headRoll = addBounded(
    target.headRoll,
    side * amount * (vertical ? 0.28 : 0.16),
  )
  target.bodyLean = addBounded(target.bodyLean, direction * amount * 0.24)
  target.gazeX = addBounded(target.gazeX, side * amount * 0.08)
}

function transferTorsoResidual(
  target: Anime25DDriver,
  residual: number,
  result: Anime25DMotionEnvelopeResult,
): void {
  const amount = Math.abs(residual)
  if (amount <= 1e-6) return
  noteTransfer(result, amount)
  const direction = Math.sign(residual) || 1
  const side = preferredSide(target)
  target.headYaw = addBounded(target.headYaw, direction * amount * 0.42)
  target.headRoll = addBounded(target.headRoll, side * amount * 0.3)
  target.gazeX = addBounded(target.gazeX, side * amount * 0.14)
  target.gazeY = addBounded(target.gazeY, -direction * amount * 0.08)
}

function noteTransfer(
  result: Anime25DMotionEnvelopeResult,
  amount: number,
): void {
  result.clippedEnergy += amount
  result.transferredEnergy += amount
}

/** With a hand on the head, the head keeps to about a third of its range. */
const HEAD_CONTACT_STARTS_AT = 0.2
const HEAD_CONTACT_LIMIT = 0.35
/** And turns at most about 5°, in radians, however far a free head turns. */
const HEAD_CONTACT_TURN_STARTS_AT = 0.052
const HEAD_CONTACT_TURN_LIMIT = 0.091

const SIDE_BLEND = 0.08

function preferredSide(target: Readonly<Anime25DDriver>): number {
  const hint = target.headRoll * 0.7 + target.headYaw * 0.3
  return clamp(finite(hint) / SIDE_BLEND, -1, 1)
}

function softLimitSigned(
  value: number,
  envelope: Readonly<Anime25DMotionEnvelopeAxis>,
): number {
  const limit = clamp(finite(envelope.limit), 0, 1)
  if (limit <= 0) return 0
  const startsAt = clamp(finite(envelope.startsAt), 0, limit)
  const sign = value < 0 ? -1 : 1
  const amount = clamp(Math.abs(finite(value)), 0, 1)
  if (amount <= startsAt) return value
  if (limit >= 1 - 1e-6) return sign * amount

  const inputSpan = Math.max(1e-6, 1 - startsAt)
  const outputSpan = Math.max(1e-6, limit - startsAt)
  const progress = clamp((amount - startsAt) / inputSpan, 0, 1)
  const exponent = inputSpan / outputSpan
  const eased = 1 - (1 - progress) ** exponent
  return sign * (startsAt + outputSpan * eased)
}

function axisEnvelope(
  startsAt: number,
  limit: number,
): Anime25DMotionEnvelopeAxis {
  const safeLimit = clamp(finite(limit), 0, 1)
  return {
    startsAt: clamp(finite(startsAt), 0, safeLimit),
    limit: safeLimit,
  }
}

function addBounded(value: number, offset: number): number {
  return clamp(finite(value) + finite(offset), -1, 1)
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
