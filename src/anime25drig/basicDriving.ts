import type { MeropeRigManifest } from '../rig/types'
import type { CryMouthMotion } from './cryMotion'
import type { Anime25DDriver } from './driver'
import type { Anime25DBlinkState, Anime25DPointerPose, Anime25DStylizedTargets } from './driverComposition'
import type { Anime25DBoundBody, Anime25DDirectedBodyControl, Anime25DDriving, Anime25DFrameSample } from './driving'
import type { IdleBreathOffset } from './idleBreath'
import type { Anime25DMotionEnvelopeProfile, Anime25DMotionEnvelopeResult } from './motionEnvelope'
import type { Anime25DStageShared } from './stage'
import type { StylizedExpressionMotion } from './stylizedExpressionMotion'
import type { Anime25DPlayback } from './types'
import { bodyKeyShare, headRidesBody } from './bodyTurnKeyforms'
import { ClosedEyePresentation } from './closedEyePresentation'
import { IDENTITY_DRIVER, sanitizeDriverPatch } from './driver'
import {
  applyAnime25DCryMouth,
  applyAnime25DSillyMouthOwnership,
  mixBoundedExpressionChannel,
  prepareAnime25DWorkingTarget,
  resolveAnime25DStylizedTargets,
  smoothAnime25DUnit,
  stepAnime25DBlink,
  stepAnime25DDriverResponse,
} from './driverComposition'
import { GazeShiftBlink } from './gazeBlink'
import { idleBreathOffset } from './idleBreath'
import { Anime25DIrisRebound } from './irisRebound'
import { projectAnime25DMotionEnvelope } from './motionEnvelope'
import { PoseResponseController } from './poseResponse'
import { isStandingFigure, STANDING_HEAD_ROLL, STANDING_IDLE_SHARE, standingWeightShift } from './standing'

/** What the basic driving measures of a package: whether the figure stands, and how much its head rides a torso turn. */
export interface Anime25DBasicFigure {
  standing: boolean
  headRidesBody: number
}

export function measureAnime25DBasicFigure(
  playback: Pick<Anime25DPlayback, 'anchors' | 'bodyTurnKeyforms' | 'turnKeyforms'>,
): Anime25DBasicFigure {
  return { standing: isStandingFigure(playback.anchors), headRidesBody: headRidesBody(bodyKeyShare(playback), Boolean(playback.turnKeyforms)) }
}

/** How fast the pointer takes the head and eyes, and lets them go (per second). */
const POINTER_ATTACK_RATE = 16
const POINTER_RELEASE_RATE = 5.5
/** How much of the breath comes through while the pointer leads the head. */
const POINTER_BREATH_SHARE = 0.1
/** How fast the breath's share rises and falls (per second), then the spring that eases it (Hz). */
const BREATH_ATTACK_RATE = 18
const BREATH_RELEASE_RATE = 6.2
const BREATH_GATE_ATTACK_HZ = 8
const BREATH_GATE_RELEASE_HZ = 4.5
/** A sticker face or a special eye above this shuts out the blink, and holds the iris still. */
const STYLIZED_EYES = 0.03
/** The share of a sticker face's head pulse that comes through while nothing performs. */
const IDLE_STYLIZED_HEAD_SHARE = 0.25

/** The envelope before a package is bound: every axis free. */
const OPEN_MOTION_ENVELOPE: Anime25DMotionEnvelopeProfile = {
  highCollar: false,
  armMotion: true,
  pitch: { startsAt: 1, limit: 1 },
  torso: { startsAt: 1, limit: 1 },
  rigidArm: { startsAt: 1, limit: 1 },
  headTurn: { startsAt: 1, limit: 1 },
  headTilt: { startsAt: 1, limit: 1 },
}

/**
 * Where the basic driving starts: IDENTITY_DRIVER, but not talking, since nothing here talks. The stage breathes the
 * torso's lift while `idle` or `talk` is on, so a `talk` left on would keep it breathing after `idle` is turned off.
 */
const BASIC_DRIVER: Readonly<Anime25DDriver> = { ...IDENTITY_DRIVER, talk: false }

/**
 * A driving with no performance: `current` eases toward `target`, with the figure's idle breath, its own blinks and,
 * while `target.mouse` is on, its look following the pointer (setPointer). The flags in `target` switch them:
 * `rand` the breath of head and body, `blink` the blinks, `mouse` the pointer; `idle` (the chest's breath and the
 * hair's wind) and `phys` (hair, chest and cloth physics) are read by the stage itself from `current`.
 *
 * Speech, song, directed poses, behaviours, stickers and the stylized faces' own motion are not here: what they would
 * give the stage is what the stage reads when nothing performs. `random` decides the blinks; seed it for a repeatable
 * figure.
 */
export class Anime25DBasicDriving implements Anime25DDriving<Anime25DBasicFigure> {
  /** What the stage shares with this driving; hand it to the stage with this driving. */
  readonly shared: Anime25DStageShared = {
    current: { ...BASIC_DRIVER },
    closedEyes: new ClosedEyePresentation(),
    irisRebound: new Anime25DIrisRebound(),
  }

  /** The driver `current` eases toward. Set it with set(); written directly, it is not sanitized. */
  readonly target: Anime25DDriver = { ...BASIC_DRIVER }

  /** No directed pose: the body's own posture keeps all of every control. */
  readonly directedBodyWeight = (_control: Anime25DDirectedBodyControl): number => 0
  /** No speech accent: the jaw follows `jaw` alone. */
  readonly jawEmphasis = 0
  /** No stylized motion: the head and mouth deformers keep their drawn shapes. */
  readonly stylizedMotion: Readonly<StylizedExpressionMotion> | null = null
  readonly stylizedHeadShare = IDLE_STYLIZED_HEAD_SHARE
  /** Nothing talks over a sticker face: it owns the mouth. */
  readonly sillyMouthShare = 1

  private readonly working: Anime25DDriver = { ...IDENTITY_DRIVER }
  private readonly pointer: Anime25DPointerPose = { x: 0, y: 0, inside: false }
  private readonly noPointer: Readonly<Anime25DPointerPose> = { x: 0, y: 0, inside: false }
  private pointerAuthority = 0
  private breathShare = Number.NaN
  private breathWeight = Number.NaN
  private breathVelocity = 0
  private readonly breath: IdleBreathOffset = { angleX: 0, angleY: 0, angleZ: 0, body: 0 }
  private readonly stylizedTargets: Anime25DStylizedTargets = { anger: 0, speechless: 0, maniac: 0, silly: 0, lovestruck: 0 }
  private readonly cryMouth: CryMouthMotion = { jaw: 0, lipCurve: 0, mouthCY: 0, mouthScale: 0 }
  private readonly envelopeResult: Anime25DMotionEnvelopeResult = { clippedEnergy: 0, transferredEnergy: 0 }
  private readonly poseResponse = new PoseResponseController()
  private readonly gazeBlink = new GazeShiftBlink()
  private readonly blinkState: Anime25DBlinkState = { activeSeconds: -1, nextAtSeconds: 1.8 }
  private unblinkedLidL = 1
  private unblinkedLidR = 1
  private figure: Anime25DBasicFigure = { standing: false, headRidesBody: 0 }
  private motionEnvelope: Anime25DMotionEnvelopeProfile = OPEN_MOTION_ENVELOPE

  constructor(private readonly random: () => number = Math.random) {}

  /** Writes a part of `target`, each value bounded to its range; values that are not are dropped. */
  set(partial: Partial<Anime25DDriver>): void {
    Object.assign(this.target, sanitizeDriverPatch(partial))
  }

  /**
   * Where the pointer is, −1…1 across and down the canvas, and whether it is over it at all. Followed only while
   * `target.mouse` is on; once it leaves, the look eases back to `target`.
   */
  setPointer(x: number, y: number, inside: boolean): void {
    this.pointer.inside = inside
    if (!inside) return
    this.pointer.x = Number.isFinite(x) ? x : 0
    this.pointer.y = Number.isFinite(y) ? y : 0
  }

  /** Blinks now, then goes on blinking at its own pace. */
  blinkNow(time: number): void {
    this.blinkState.activeSeconds = 0
    this.blinkState.nextAtSeconds = time + 1.6 + this.random() * 3.8
  }

  step(dt: number, time: number): void {
    const target = this.target
    const current = this.shared.current
    const pointer = target.mouse ? this.pointer : this.noPointer
    const pointerWanted = pointer.inside ? 1 : 0
    const pointerRate = pointerWanted > this.pointerAuthority ? POINTER_ATTACK_RATE : POINTER_RELEASE_RATE
    this.pointerAuthority += (pointerWanted - this.pointerAuthority) * (1 - Math.exp(-pointerRate * dt))
    const working = prepareAnime25DWorkingTarget(this.working, target, pointer, this.pointerAuthority)
    const stylized = resolveAnime25DStylizedTargets(this.stylizedTargets, working)

    this.addBreath(working, dt, time, target.rand ? (target.mouse && pointer.inside ? POINTER_BREATH_SHARE : 1) : 0)
    applyAnime25DCryMouth(working, current.eyeCry, time, dt, this.cryMouth)
    applyAnime25DSillyMouthOwnership(working, smoothAnime25DUnit(stylized.silly) * this.sillyMouthShare)
    working.headYaw += working.torsoTurn * this.figure.headRidesBody
    projectAnime25DMotionEnvelope(working, this.motionEnvelope, this.envelopeResult)
    this.shared.closedEyes.step(working, dt)

    // The response eases the eyes as they would be without the blink; the blink is laid over what it gives.
    current.lidL = this.unblinkedLidL
    current.lidR = this.unblinkedLidR
    stepAnime25DDriverResponse(current, target, working, this.poseResponse, dt)
    this.unblinkedLidL = current.lidL
    this.unblinkedLidR = current.lidR

    const blinkSuppressed = stylized.maniac > STYLIZED_EYES || stylized.silly > STYLIZED_EYES
    const blinking = this.blinkState.activeSeconds >= 0
    if (
      this.gazeBlink.step(current.headYaw, current.headPitch, current.gazeX, current.gazeY, dt, blinking, this.random)
      && target.blink && !blinkSuppressed && !blinking
    ) {
      this.blinkNow(time)
    }
    stepAnime25DBlink(current, this.blinkState, time, dt, target.blink, blinkSuppressed, this.random)
    this.shared.irisRebound.step(
      dt,
      Math.max(current.lidL, current.lidR),
      current.eyeWide,
      current.gazeX,
      current.gazeY,
      Math.max(
        stylized.maniac, stylized.silly, stylized.lovestruck,
        current.maniac, current.silly, current.lovestruck,
        working.eyeCry, working.eyeDizzy, working.eyeSqueeze,
        current.eyeCry, current.eyeDizzy, current.eyeSqueeze,
      ) > STYLIZED_EYES,
    )
  }

  /** The thinking sticker never shows. */
  thinkingLevel(): number {
    return 0
  }

  drawn(): void {}

  frame(_sample: Anime25DFrameSample): void {}

  measure(playback: Anime25DPlayback): Anime25DBasicFigure {
    return measureAnime25DBasicFigure(playback)
  }

  bind(figure: Anime25DBasicFigure, motionEnvelopeProfile: Anime25DMotionEnvelopeProfile): void {
    this.figure = figure
    this.motionEnvelope = motionEnvelopeProfile
  }

  /** Nothing is directed, so nothing of the package needs to be movable. */
  measureCapabilities(_rigManifest: MeropeRigManifest | undefined, _body: Anime25DBoundBody): readonly string[] {
    return []
  }

  bindCapabilities(_capabilities: readonly string[]): void {}

  /**
   * Lays the idle breath over the head and body, at `wanted` of its strength once its share has eased there; a
   * standing figure breathes at its idle share and shifts its weight from leg to leg.
   */
  private addBreath(working: Anime25DDriver, dt: number, time: number, wanted: number): void {
    const step = Math.max(0, Math.min(0.05, Number.isFinite(dt) ? dt : 0))
    if (Number.isNaN(this.breathShare)) {
      this.breathShare = wanted
      this.breathWeight = wanted
    } else {
      const rate = wanted > this.breathShare ? BREATH_ATTACK_RATE : BREATH_RELEASE_RATE
      this.breathShare += (wanted - this.breathShare) * (1 - Math.exp(-rate * step))
      this.stepBreathWeight(step)
    }
    const weight = Math.max(0, Math.min(1, this.breathWeight))
    if (weight <= 0) return
    const breath = idleBreathOffset(time, this.breath)
    if (this.figure.standing) {
      const shift = standingWeightShift(time) * STANDING_IDLE_SHARE
      breath.body = breath.body * STANDING_IDLE_SHARE + shift
      breath.angleZ += shift * STANDING_HEAD_ROLL
    }
    working.headYaw = addBreathChannel(working.headYaw, breath.angleX * weight)
    working.headPitch = addBreathChannel(working.headPitch, breath.angleY * weight)
    working.headRoll = addBreathChannel(working.headRoll, breath.angleZ * weight)
    working.bodyLean = addBreathChannel(working.bodyLean, breath.body * weight)
  }

  /** A critically damped spring from the breath's weight toward its share, quicker rising than falling. */
  private stepBreathWeight(dt: number): void {
    if (dt <= 0) return
    const target = this.breathShare
    const value = this.breathWeight
    const frequency = target > value ? BREATH_GATE_ATTACK_HZ : BREATH_GATE_RELEASE_HZ
    const omega = Math.PI * 2 * frequency
    const displacement = value - target
    const coefficient = this.breathVelocity + omega * displacement
    const decay = Math.exp(-omega * dt)
    const next = target + (displacement + coefficient * dt) * decay
    this.breathVelocity = next < 0 || next > 1 ? 0 : (this.breathVelocity - omega * coefficient * dt) * decay
    this.breathWeight = Math.max(0, Math.min(1, next))
  }
}

/** One breath channel over the pose: bounded to −1…1, easing in as it nears either end. */
function addBreathChannel(base: number, offset: number): number {
  return mixBoundedExpressionChannel(base, mixBoundedExpressionChannel(0, offset, -1, 1, 0), -1, 1, 0)
}
