import type { CryMouthMotion } from './cryMotion'
import type { Anime25DDriver } from './driver'
import type { PoseResponseController } from './poseResponse'
import { sampleCryMouthMotion } from './cryMotion'
import { IDENTITY_DRIVER } from './driver'
import {
  stepMouthForm,
  stepMouthOpen,
  stepMouthSeal,
  stepMouthShape,
} from './mouthResponse'
import { isContinuousPoseKey } from './poseResponse'

// How a driving turns an authored driver into the one drawn: the pointer's pull on head and eyes, the
// blocking between sticker faces and special eyes, the crying mouth, a sticker face's hold on the mouth, the
// blink, and the response that eases `current` toward the working target.

export interface Anime25DPointerPose {
  x: number
  y: number
  inside: boolean
}

export interface Anime25DStylizedTargets {
  anger: number
  speechless: number
  maniac: number
  silly: number
  lovestruck: number
}

export interface Anime25DBlinkState {
  activeSeconds: number
  nextAtSeconds: number
}

type RandomSource = () => number

const DRIVER_KEYS = Object.keys(IDENTITY_DRIVER) as Array<keyof Anime25DDriver>

/** `authority` is a weight. Pointer gaze crossfades like every other head source. */
export function prepareAnime25DWorkingTarget(
  output: Anime25DDriver,
  authored: Readonly<Anime25DDriver>,
  pointer: Readonly<Anime25DPointerPose>,
  authority: number,
): Anime25DDriver {
  Object.assign(output, authored)
  if (!authored.followPointer) return output
  const amount = clamp(Number.isFinite(authority) ? authority : 0, 0, 1)
  if (amount <= 0) return output
  output.headYaw = mixPointer(authored.headYaw, pointer.x * 0.9, amount)
  output.headPitch = mixPointer(authored.headPitch, -pointer.y * 0.7, amount)
  output.gazeX = mixPointer(authored.gazeX, pointer.x * 1.2, amount)
  output.gazeY = mixPointer(authored.gazeY, -pointer.y * 0.8, amount)
  return output
}

function mixPointer(base: number, tracked: number, amount: number): number {
  const bounded = clamp(tracked, -1, 1)
  // Full authority is the tracked value itself, not a lerp that lands one
  // float away from it: the pointer math is asserted exactly.
  return amount >= 1 ? bounded : base + (bounded - base) * amount
}

/**
 * The sticker faces as the authored driver asks for them, held back by special eyes (dizzy, squeezed shut,
 * crying), which they cannot be drawn over.
 */
export function resolveAnime25DStylizedTargets(
  output: Anime25DStylizedTargets,
  target: Readonly<Anime25DDriver>,
): Anime25DStylizedTargets {
  const specialEyeBlocker =
    1 -
    Math.max(
      clamp(finiteOrZero(target.eyeDizzy), 0, 1),
      clamp(finiteOrZero(target.eyeSqueeze), 0, 1),
      clamp(finiteOrZero(target.eyeCry), 0, 1),
    )
  output.anger = clamp(finiteOrZero(target.anger), 0, 1) * specialEyeBlocker
  output.speechless = clamp(finiteOrZero(target.speechless), 0, 1) * specialEyeBlocker
  output.maniac = clamp(finiteOrZero(target.maniac), 0, 1) * specialEyeBlocker
  output.silly = clamp(finiteOrZero(target.silly), 0, 1) * specialEyeBlocker
  output.lovestruck = clamp(finiteOrZero(target.lovestruck), 0, 1) * specialEyeBlocker
  return output
}

export function applyAnime25DCryMouth(
  target: Anime25DDriver,
  currentEyeCry: number,
  timeSeconds: number,
  elapsedSeconds: number,
  output: CryMouthMotion,
): void {
  const cryResponseRate = target.eyeCry > currentEyeCry ? 6 : 4.5
  const cryAmount = clamp(
    currentEyeCry +
      (target.eyeCry - currentEyeCry) *
        (1 - Math.exp(-cryResponseRate * elapsedSeconds)),
    0,
    1,
  )
  sampleCryMouthMotion(cryAmount, timeSeconds, output)
  target.jaw = Math.max(target.jaw, output.jaw)
  target.lipCurve = mixBoundedExpressionChannel(
    target.lipCurve,
    output.lipCurve,
    -1,
    1,
    0,
  )
  target.mouthCY = mixBoundedExpressionChannel(
    target.mouthCY,
    output.mouthCY,
    -1,
    1,
    0,
  )
  target.mouthScale = mixBoundedExpressionChannel(
    target.mouthScale,
    output.mouthScale,
    0.5,
    1.5,
    1,
  )
}

/**
 * A blink as a person makes it: the lid drops fast, gathering speed, stays
 * shut for a moment only, and lifts a little slower, quick at first. About a
 * quarter of a second in all; a longer one reads as drowsy.
 */
const BLINK_CLOSE_SECONDS = 0.07
const BLINK_SHUT_SECONDS = 0.04
const BLINK_OPEN_SECONDS = 0.16
export const BLINK_SECONDS = BLINK_CLOSE_SECONDS + BLINK_SHUT_SECONDS + BLINK_OPEN_SECONDS
/** A double blink leaves the eye open this long between the two. */
const DOUBLE_BLINK_GAP_SECONDS = 0.12

/**
 * Advances the blink and closes `target`'s eyes by it. Apply it to the eyes as
 * shown, after any smoothing: smoothed, a quarter-second blink never shuts.
 */
export function stepAnime25DBlink(
  target: Anime25DDriver,
  state: Anime25DBlinkState,
  timeSeconds: number,
  elapsedSeconds: number,
  enabled: boolean,
  suppressed: boolean,
  random: RandomSource = Math.random,
): void {
  // 进行中的眨眼必须写完眼皮；抑制或关掉自动化也不能从半闭处弹开。
  if (suppressed || !enabled) {
    if (suppressed) state.nextAtSeconds = timeSeconds + 1.8
    if (state.activeSeconds < 0) return
  } else {
    if (state.activeSeconds < 0 && timeSeconds > state.nextAtSeconds) {
      state.activeSeconds = 0
      state.nextAtSeconds = timeSeconds + 1.6 + random() * 3.8
      if (random() < 0.18) state.nextAtSeconds = timeSeconds + BLINK_SECONDS + DOUBLE_BLINK_GAP_SECONDS
    }
    if (state.activeSeconds < 0) return
  }
  state.activeSeconds += elapsedSeconds
  const elapsed = state.activeSeconds
  let open = 1
  if (elapsed < BLINK_CLOSE_SECONDS) {
    const t = elapsed / BLINK_CLOSE_SECONDS
    open = 1 - t * t
  } else if (elapsed < BLINK_CLOSE_SECONDS + BLINK_SHUT_SECONDS) {
    open = 0
  } else if (elapsed < BLINK_SECONDS) {
    const t = (elapsed - BLINK_CLOSE_SECONDS - BLINK_SHUT_SECONDS) / BLINK_OPEN_SECONDS
    open = 1 - (1 - t) * (1 - t)
  } else {
    state.activeSeconds = -1
  }
  target.lidL = Math.min(target.lidL, open)
  target.lidR = Math.min(target.lidR, open)
}

/** Applies the final driver and secondary-motion response without allocations. */
export function stepAnime25DDriverResponse(
  current: Anime25DDriver,
  authored: Readonly<Anime25DDriver>,
  target: Readonly<Anime25DDriver>,
  poseResponse: PoseResponseController,
  elapsedSeconds: number,
  responseScale = 1,
): void {
  poseResponse.step(current, target, elapsedSeconds, responseScale)
  const rate = Math.min(1, elapsedSeconds * 14)
  for (const key of DRIVER_KEYS) {
    if (isContinuousPoseKey(key)) continue
    if (isAutomationFlag(key)) {
      current[key] = authored[key]
      continue
    }
    const from = current[key]
    const to = target[key]
    if (key === 'jaw') {
      current.jaw = stepMouthOpen(from, to, elapsedSeconds)
      continue
    }
    if (key === 'lipCurve') {
      current.lipCurve = stepMouthForm(from, to, elapsedSeconds)
      continue
    }
    if (key === 'mouthSeal') {
      current.mouthSeal = stepMouthSeal(from, to, elapsedSeconds)
      continue
    }
    if (key === 'mouthWide' || key === 'mouthRound' || key === 'mouthNarrow') {
      current[key] = stepMouthShape(from, to, elapsedSeconds)
      continue
    }
    if (key === 'eyeCry') {
      const response = to > from ? 6 : 4.5
      current.eyeCry =
        from + (to - from) * (1 - Math.exp(-response * elapsedSeconds))
      continue
    }
    if (key === 'maniac') {
      const response = to > from ? 7.2 : 4.4
      current.maniac =
        from + (to - from) * (1 - Math.exp(-response * elapsedSeconds))
      continue
    }
    if (key === 'silly') {
      const response = to > from ? 7 : 4.2
      current.silly =
        from + (to - from) * (1 - Math.exp(-response * elapsedSeconds))
      continue
    }
    if (key === 'lovestruck') {
      const response = to > from ? 6.6 : 3.8
      current.lovestruck =
        from + (to - from) * (1 - Math.exp(-response * elapsedSeconds))
      continue
    }
    current[key] = from + (to - from) * rate
  }
}

function isAutomationFlag(
  key: keyof Anime25DDriver,
): key is
  | 'breathing'
  | 'torsoBreath'
  | 'hairWind'
  | 'physics'
  | 'idleSway'
  | 'autoBlink'
  | 'followPointer'
  | 'thinking'
  | 'singing'
  | 'talking' {
  return (
    key === 'breathing' ||
    key === 'torsoBreath' ||
    key === 'hairWind' ||
    key === 'physics' ||
    key === 'idleSway' ||
    key === 'autoBlink' ||
    key === 'followPointer' ||
    key === 'thinking' ||
    key === 'singing' ||
    key === 'talking'
  )
}

export function applyAnime25DSillyMouthOwnership(
  target: Anime25DDriver,
  ownership: number,
): void {
  if (ownership <= 0) return
  const retained = 1 - ownership
  target.jaw *= retained
  target.mouthWide *= retained
  target.mouthRound *= retained
  target.mouthNarrow *= retained
  target.mouthSeal *= retained
}

export function smoothAnime25DUnit(value: number): number {
  const bounded = clamp(value, 0, 1)
  return bounded * bounded * (3 - 2 * bounded)
}

const EXTREME_SOFT_LIMIT_START = 0.8

/** Preserves expression headroom instead of flattening other sources at limits. */
export function mixBoundedExpressionChannel(
  base: number,
  offset: number,
  minimum: number,
  maximum: number,
  neutral: number,
): number {
  const boundedBase = clamp(finiteOrZero(base), minimum, maximum)
  const boundedOffset = finiteOrZero(offset)
  if (boundedOffset === 0) return boundedBase
  const direction = boundedOffset > 0 ? 1 : -1
  const boundary = direction > 0 ? maximum : minimum
  const outwardSpan = Math.abs(boundary - neutral)
  if (outwardSpan <= 0) return boundedBase

  let result = boundedBase
  let remaining = Math.abs(boundedOffset)
  const distanceToNeutral = direction * (neutral - result)
  if (distanceToNeutral > 0) {
    const inward = Math.min(remaining, distanceToNeutral)
    result += direction * inward
    remaining -= inward
  }
  if (remaining <= 0) return clamp(result, minimum, maximum)

  const softStart = neutral + direction * outwardSpan * EXTREME_SOFT_LIMIT_START
  const distanceToSoftStart = direction * (softStart - result)
  if (distanceToSoftStart > 0) {
    const linear = Math.min(remaining, distanceToSoftStart)
    result += direction * linear
    remaining -= linear
  }
  if (remaining <= 0) return clamp(result, minimum, maximum)

  const headroom = Math.max(0, direction * (boundary - result))
  if (headroom <= 0) return clamp(result, minimum, maximum)
  const compressed = (remaining * headroom) / (remaining + headroom)
  return clamp(result + direction * compressed, minimum, maximum)
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
