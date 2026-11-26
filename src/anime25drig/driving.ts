import type { MeropeRigManifest } from '../rig/types'
import type { Anime25DMotionEnvelopeProfile } from './motionEnvelope'
import type { Anime25DStickerFaceMotion } from './stickerFaceMotion'
import type { Anime25DPlayback } from './types'

// What the stage reads of whatever moves the figure. The stage draws `current`; a driving writes it, once per
// substep, and answers the few questions the body, the face and the stickers ask besides.

/** Body controls a driving can direct, which the body's own automatic posture then gives way to. */
export type Anime25DDirectedBodyControl =
  | 'torsoTurn' | 'torsoRise' | 'torsoPitch'
  | 'leftArmRaise' | 'rightArmRaise' | 'leftArmSwing' | 'rightArmSwing'

/** What the body reads of the driving each substep. */
export interface Anime25DBodyDriving {
  /**
   * How far the driving directs a body control, 0 to 1. The body's own motion of it (the torso following the head,
   * the lift a nod or the breath gives, the arms' hang) gives way by as much; at 1 only the driver value moves it.
   */
  directedBodyWeight: (control: Anime25DDirectedBodyControl) => number
  /** Opens the jaw a little wider than `jaw` asks, 0 to 1 (at 1, a tenth wider). 0 leaves the jaw to `jaw`. */
  readonly jawBoost: number
  /**
   * This substep's motion of the sticker faces (the `maniac`, `silly`, `lovestruck`, `anger` and `speechless`
   * drawings): their art's scales, offsets and turns, and the head pulses. Null draws them as authored, still.
   */
  readonly stickerFaceMotion: Readonly<Anime25DStickerFaceMotion> | null
  /** How much of `stickerFaceMotion`'s head pulses moves the head, 0 to 1. */
  readonly stickerFaceHeadShare: number
}

/** One drawn frame, reported as the tick ends. */
export interface Anime25DFrameSample {
  /** The tick came late (more than 50 ms after the last). */
  dropped: boolean
  /** What the tick cost the CPU, in milliseconds; only on the ticks the stage samples. */
  cpuMs?: number
}

/** The bound geometry of a package, as the stage measured it, that decides what of the body can be moved. */
export interface Anime25DBoundBody {
  /** The torso turns as a volume (its shell is on). */
  torsoVolume: boolean
  /** The sides of the picture whose arm swings as a modelled mesh. */
  arms: readonly ('L' | 'R')[]
}

/**
 * What drives the stage. `Measured` is what the driving measures of a package before the stage takes it: measured
 * beside the live package (and may fail there), taken with it in a step that cannot fail.
 */
export interface Anime25DDriving<Measured = unknown> extends Anime25DBodyDriving {
  /** How much of the `silly` sticker face's own mouth is drawn, 0 to 1; the mouth's driver values have the rest. */
  readonly stickerMouthShare: number
  /** One substep: writes the stage's `current` for `time` (seconds since the stage began), `dt` after the last. */
  step: (dt: number, time: number) => void
  /** How strongly the spinner sticker (a ring turning beside the head) shows, 0 to 1; read every substep. */
  spinnerLevel: () => number
  /** The figure's own frame was drawn: each tick, and when a resize redraws it. */
  drawn: () => void
  /** A tick ended: called for each tick the stage times, and for each late one. */
  frame: (sample: Anime25DFrameSample) => void
  /** Measures a package; changes nothing live. */
  measure: (playback: Anime25DPlayback) => Measured
  /**
   * Takes a package measured with measure(), as the stage takes it, with the limits its motion envelope puts on the
   * pose. Cannot fail.
   */
  bind: (measured: Measured, motionEnvelopeProfile: Anime25DMotionEnvelopeProfile) => void
  /**
   * What the driving can move of a package once the stage has compiled and measured it (as named by the driving;
   * the stage only hands it back to bindCapabilities()). Changes nothing live, and may fail.
   */
  measureCapabilities: (rigManifest: MeropeRigManifest | undefined, body: Anime25DBoundBody) => readonly string[]
  /** Takes what measureCapabilities() gave, as the stage takes the package. Cannot fail. */
  bindCapabilities: (capabilities: readonly string[]) => void
}
