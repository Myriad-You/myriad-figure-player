// What the director sends the figure and what her state reports, read off the wire: anything not in
// the performance contract's words, or past its bounds, does not get through.
import type {
  MoodTransition,
  PerformanceBaseline,
  PerformanceCue,
  PerformanceDirective,
  RigMotionStyle,
} from './types'
import {
  FACE_PRESETS,
  FACE_SHIFT_NAMES,
  MAX_FACES_PASSED,
  PERFORMANCE_BASELINE_EXPRESSIONS,
  PERFORMANCE_CUE_INTENTS,
  PERFORMANCE_INTERRUPT_MODES,
  PERFORMANCE_POSTURES,
  PLAIN_FACE,
  sanitizeBodyPose,
  sanitizeScore,
  sanitizeSpeechPhrases,
} from './contract'
import { isWord } from './vocabulary'

export interface MeropeStateEventDetail {
  mood: MoodTransition
  activity: string
}

export function meropeStateEventDetail(
  value: unknown,
): MeropeStateEventDetail | null {
  if (!isRecord(value) || !isRecord(value.mood)) return null
  const mood = value.mood
  const bandBefore = moodBandName(mood.bandBefore)
  const bandAfter = moodBandName(mood.bandAfter)
  const numbers = [mood.before, mood.after, mood.delta, mood.revision]
  if (
    !numbers.every(
      (number) => typeof number === 'number' && Number.isFinite(number),
    ) ||
    !bandBefore ||
    !bandAfter
  ) {
    return null
  }
  const arousalBefore = optionalArousal(mood.arousalBefore)
  const arousalAfter = optionalArousal(mood.arousalAfter)
  return {
    mood: {
      before: clamp(mood.before as number, 0, 100),
      after: clamp(mood.after as number, 0, 100),
      ...(arousalBefore !== undefined ? { arousalBefore } : {}),
      ...(arousalAfter !== undefined ? { arousalAfter } : {}),
      bandBefore,
      bandAfter,
      delta: clamp(mood.delta as number, -10, 10),
      cause:
        typeof mood.cause === 'string' ? mood.cause.slice(0, 80) : 'unknown',
      revision: Math.max(0, Math.trunc(mood.revision as number)),
    },
    activity:
      typeof value.activity === 'string' ? value.activity.slice(0, 32) : 'idle',
  }
}

function moodBandName(value: unknown): MoodTransition['bandBefore'] | null {
  switch (value) {
    case 'floor':
      return 'floor'
    case 'sad':
    case 'low':
      return 'sad'
    case 'tense':
      return 'tense'
    case 'calm':
    case 'normal':
      return 'calm'
    case 'excited':
    case 'high':
      return 'excited'
    default:
      return null
  }
}

function optionalArousal(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return clamp(value, 0, 100)
}

export function sanitizePerformanceDirective(
  value: unknown,
): PerformanceDirective | null {
  if (!isRecord(value) || !isRecord(value.plan)) return null
  const phases = [
    'reaction',
    'delivery',
    'outcome',
    'proactive',
    'mood',
    'presence',
  ] as const
  if (!phases.includes(value.phase as (typeof phases)[number])) return null
  if (
    typeof value.moodRevision !== 'number' ||
    !Number.isFinite(value.moodRevision)
  ) {
    return null
  }
  const motionStyle = sanitizeMotionStyle(value.motionStyle)
  if (!motionStyle) return null
  const baseline = sanitizeBaseline(value.plan.baseline)
  const cues = Array.isArray(value.plan.cues)
    ? value.plan.cues
        .slice(0, 3)
        .map(sanitizeCue)
        .filter((cue): cue is PerformanceCue => cue !== null)
    : []
  const phrases = sanitizeSpeechPhrases(value.phrases)
  const score = sanitizeScore(value.score)
  if (!baseline && cues.length === 0 && phrases.length === 0 && score.length === 0) return null
  return {
    phase: value.phase as PerformanceDirective['phase'],
    moodRevision: Math.max(0, Math.trunc(value.moodRevision)),
    motionStyle,
    plan: { ...(baseline ? { baseline } : {}), cues },
    ...(phrases.length ? { phrases } : {}),
    ...(score.length ? { score } : {}),
    // A standing score's period, within the contract's bounds.
    ...(score.length && typeof value.loopMs === 'number' && Number.isFinite(value.loopMs)
      ? { loopMs: Math.max(6_000, Math.min(60_000, Math.round(value.loopMs))) }
      : {}),
  }
}

/** The looks a change passes through on the way, as many as the contract allows, each one known. */
function passedThrough(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((face): face is string => typeof face === 'string' && (face === PLAIN_FACE || Object.hasOwn(FACE_PRESETS, face)))
    .slice(0, MAX_FACES_PASSED)
}

function sanitizeMotionStyle(value: unknown): RigMotionStyle | null {
  return value === 'restrained' || value === 'even' || value === 'open'
    ? value
    : null
}

function sanitizeBaseline(value: unknown): PerformanceBaseline | null {
  const pose = isRecord(value) && value.pose !== undefined ? sanitizeBodyPose(value.pose) : undefined
  if (pose === null) return null
  if (!isRecord(value)) return null
  if (
    !isWord(PERFORMANCE_BASELINE_EXPRESSIONS, value.expression) ||
    !isWord(PERFORMANCE_POSTURES, value.posture) ||
    typeof value.motionEnergy !== 'number' ||
    !Number.isFinite(value.motionEnergy) ||
    typeof value.attention !== 'number' ||
    !Number.isFinite(value.attention)
  ) {
    return null
  }
  return {
    expression: value.expression,
    posture: value.posture,
    motionEnergy: clamp(value.motionEnergy, 0.2, 1.4),
    attention: clamp(value.attention, 0, 1),
    ...(pose ? { pose } : {}),
    ...(typeof value.face === 'string' && Object.hasOwn(FACE_PRESETS, value.face) ? { face: value.face } : {}),
    ...(typeof value.shift === 'string' && FACE_SHIFT_NAMES.includes(value.shift) ? { shift: value.shift } : {}),
    ...(passedThrough(value.via).length ? { via: passedThrough(value.via) } : {}),
  }
}

function sanitizeCue(value: unknown): PerformanceCue | null {
  if (!isRecord(value)) return null
  if (
    !isWord(PERFORMANCE_CUE_INTENTS, value.intent) ||
    !isWord(PERFORMANCE_INTERRUPT_MODES, value.interrupt)
  ) {
    return null
  }
  const numericKeys = [
    'atMs',
    'intensity',
    'tempo',
    'fadeInMs',
    'fadeOutMs',
  ] as const
  if (
    !numericKeys.every(
      (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
    )
  ) {
    return null
  }
  return {
    intent: value.intent,
    atMs: Math.trunc(clamp(value.atMs as number, 0, 5_000)),
    intensity: clamp(value.intensity as number, 0.2, 1.4),
    tempo: clamp(value.tempo as number, 0.5, 1.6),
    fadeInMs: Math.trunc(clamp(value.fadeInMs as number, 40, 600)),
    fadeOutMs: Math.trunc(clamp(value.fadeOutMs as number, 60, 800)),
    interrupt: value.interrupt,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
