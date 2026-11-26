export interface Anime25DDriver {
  /** The head's turn, −1…1: + turns it toward image right. */
  headYaw: number
  /** The head's nod, −1…1: + raises the face. */
  headPitch: number
  /** The head's tilt, −1…1 (not radians: headRollRadians converts). */
  headRoll: number
  /** How open each eyelid is: 1 open as drawn, 0 shut. */
  lidL: number
  lidR: number
  eyeDizzy: number
  eyeSqueeze: number
  eyeCry: number
  anger: number
  speechless: number
  /** Drawn accents beside the face: music notes, ?, Z z z, sparkles, blush. */
  accentNotes: number
  accentQuestion: number
  accentSleep: number
  accentSparkle: number
  accentBlush: number
  /** Drawn gesture arms, one per side of the picture (armVariantPresenter): above 0.5 raises it. */
  handWaveL: number
  handPointL: number
  handChestL: number
  handChinL: number
  handWaveR: number
  handPointR: number
  handChestR: number
  handChinR: number
  maniac: number
  silly: number
  lovestruck: number
  /** Where the irises look, −1…1: across and down the picture. */
  gazeX: number
  gazeY: number
  /** The brows' height: + raises them. */
  browLift: number
  /** How far the mouth opens: 0 shut, 1 fully open. */
  jaw: number
  mouthWide: number
  mouthRound: number
  mouthNarrow: number
  mouthSeal: number
  /** The mouth's corners: + curves them up, − down. */
  lipCurve: number
  mouthCY: number
  /** The body's side lean, −1…1 (not radians). */
  bodyLean: number
  /** How much of the head's turn the torso follows on its own, 0…1. */
  torsoFollow: number
  /** Actual torso turn; torsoFollow above is the automatic head-follow gain. */
  torsoTurn: number
  /** Upper-body rise (+) / settle (-), independent of head pitch and physics. */
  bodyLift: number
  /** Forward/back torso orientation; independent of vertical lift. */
  bodyPitch: number
  /** The sway of the hair behind the face (not the front hair: fhAmp); DEFAULT_REAR_HAIR_SWAY as authored. */
  rearHairSway: number
  soft: number
  /** Each brow's tilt, and a tilt of both mirrored about the face. */
  browTiltL: number
  browTiltR: number
  browTilt: number
  bangL: number
  bangC: number
  bangR: number
  armY: number
  armPos: number
  armRaiseL: number
  armRaiseR: number
  armSwingL: number
  armSwingR: number
  bust: number
  bustY: number
  irisScale: number
  /** A smile reaching the eyes: the lower lids push up under the irises. */
  eyeSmile: number
  /** Eyes opened wider than drawn: surprise, sudden interest. The irises tighten. */
  eyeWide: number
  mouthEase: number
  eyeEase: number
  fhAmp: number
  fhSoft: number
  eyeCY: number
  eyeCAng: number
  mouthCAng: number
  eyeScaleL: number
  eyeScaleR: number
  mouthScale: number
  /**
   * The stage's breath, one every 3.4 s: the head and body rise and fall a little and the chest swells. Off, they
   * ease to mid-breath and stay there (a figure made with it off starts there), and `torsoBreath`, `talking` and
   * `singing` lift nothing; with the other switches here off too, the figure holds fully still.
   */
  breathing: boolean
  /**
   * The breath also lifts the upper body; so it does while `talking` or `singing` is on. Read by the stage. With
   * `breathing` off there is no breath to lift it, whatever this and those say.
   */
  torsoBreath: boolean
  /** A light wind through the hair springs; needs `physics`. Read by the stage. */
  hairWind: boolean
  /** Hair, chest, cloth and accessory physics. Off, they hang as posed. Read by the stage. */
  physics: boolean
  /**
   * The basic driving's slow idle sway: the head drifts in turn, nod and tilt and the body leans, and a standing
   * figure shifts its weight from leg to leg.
   */
  idleSway: boolean
  /** Blinks on their own, at a random pace and after large gaze shifts (the basic driving). */
  autoBlink: boolean
  /** The head and eyes follow the pointer given to setPointer() (the basic driving). */
  followPointer: boolean
  /** The figure is thinking. Not read by the stage; a driving may keep it as part of what it was asked to be. */
  thinking: boolean
  /** The figure is singing: the stage lifts the upper body with the breath, as for `torsoBreath`. */
  singing: boolean
  /** The figure is talking: the stage lifts the upper body with the breath, as for `torsoBreath`. */
  talking: boolean
}

export const DEFAULT_FRONT_HAIR_SWAY = 1
export const DEFAULT_REAR_HAIR_SWAY = 0.5

export const IDENTITY_DRIVER: Anime25DDriver = {
  headYaw: 0,
  headPitch: 0,
  headRoll: 0,
  lidL: 1,
  lidR: 1,
  eyeDizzy: 0,
  eyeSqueeze: 0,
  eyeCry: 0,
  anger: 0,
  speechless: 0,
  accentNotes: 0,
  accentQuestion: 0,
  accentSleep: 0,
  accentSparkle: 0,
  accentBlush: 0,
  handWaveL: 0,
  handPointL: 0,
  handChestL: 0,
  handChinL: 0,
  handWaveR: 0,
  handPointR: 0,
  handChestR: 0,
  handChinR: 0,
  maniac: 0,
  silly: 0,
  lovestruck: 0,
  gazeX: 0,
  gazeY: 0,
  browLift: 0,
  jaw: 0,
  mouthWide: 0,
  mouthRound: 0,
  mouthNarrow: 0,
  mouthSeal: 0,
  lipCurve: 0,
  mouthCY: 0,
  bodyLean: 0,
  torsoFollow: 1,
  torsoTurn: 0,
  bodyLift: 0,
  bodyPitch: 0,
  rearHairSway: DEFAULT_REAR_HAIR_SWAY,
  soft: 2,
  browTiltL: 0,
  browTiltR: 0,
  browTilt: 0,
  bangL: 0,
  bangC: 0,
  bangR: 0,
  armY: 0,
  armPos: 0,
  armRaiseL: 0,
  armRaiseR: 0,
  armSwingL: 0,
  armSwingR: 0,
  bust: 2.5,
  bustY: 1,
  irisScale: 1,
  eyeSmile: 0,
  eyeWide: 0,
  mouthEase: 0.45,
  eyeEase: 0.3,
  fhAmp: DEFAULT_FRONT_HAIR_SWAY,
  fhSoft: 0.4,
  eyeCY: 0,
  eyeCAng: 0,
  mouthCAng: 0,
  eyeScaleL: 1,
  eyeScaleR: 1,
  mouthScale: 1,
  breathing: true,
  torsoBreath: true,
  hairWind: true,
  physics: true,
  idleSway: true,
  autoBlink: true,
  followPointer: false,
  thinking: false,
  singing: false,
  talking: true,
}

export const WORKBENCH_DRIVER: Anime25DDriver = {
  ...IDENTITY_DRIVER,
  torsoBreath: false,
  hairWind: false,
  idleSway: false,
  talking: false,
  autoBlink: true,
  followPointer: false,
  physics: true,
}

const DRIVER_LIMITS: Partial<
  Record<keyof Anime25DDriver, readonly [number, number]>
> = {
  headYaw: [-1, 1],
  headPitch: [-1, 1],
  headRoll: [-1, 1],
  lidL: [0, 1],
  lidR: [0, 1],
  eyeDizzy: [0, 1],
  eyeSqueeze: [0, 1],
  eyeCry: [0, 1],
  anger: [0, 1],
  speechless: [0, 1],
  accentNotes: [0, 1],
  accentQuestion: [0, 1],
  accentSleep: [0, 1],
  accentSparkle: [0, 1],
  accentBlush: [0, 1],
  handWaveL: [0, 1],
  handPointL: [0, 1],
  handChestL: [0, 1],
  handChinL: [0, 1],
  handWaveR: [0, 1],
  handPointR: [0, 1],
  handChestR: [0, 1],
  handChinR: [0, 1],
  maniac: [0, 1],
  silly: [0, 1],
  lovestruck: [0, 1],
  gazeX: [-1, 1],
  gazeY: [-1, 1],
  browLift: [-1, 1],
  jaw: [0, 1],
  mouthWide: [0, 1],
  mouthRound: [0, 1],
  mouthNarrow: [0, 1],
  mouthSeal: [0, 1],
  lipCurve: [-1, 1],
  mouthCY: [-1, 1],
  bodyLean: [-1, 1],
  torsoFollow: [0, 1],
  torsoTurn: [-1, 1],
  bodyLift: [-1, 1],
  bodyPitch: [-1, 1],
  rearHairSway: [0, 3],
  soft: [0, 3],
  browTiltL: [-1, 1],
  browTiltR: [-1, 1],
  browTilt: [-1, 1],
  bangL: [-1, 1],
  bangC: [-1, 1],
  bangR: [-1, 1],
  armY: [-1, 1],
  armPos: [-1, 1],
  armRaiseL: [-1, 1],
  armRaiseR: [-1, 1],
  armSwingL: [-1, 1],
  armSwingR: [-1, 1],
  bust: [0, 4],
  bustY: [-3, 3],
  irisScale: [0.5, 1.3],
  eyeSmile: [0, 1],
  eyeWide: [0, 1],
  mouthEase: [0, 1],
  eyeEase: [0, 1],
  fhAmp: [0, 3],
  fhSoft: [0, 2],
  eyeCY: [-1, 1],
  eyeCAng: [-1, 1],
  mouthCAng: [-1, 1],
  eyeScaleL: [0.5, 1.5],
  eyeScaleR: [0.5, 1.5],
  mouthScale: [0.5, 1.5],
}

export function sanitizeDriverPatch(
  partial: Partial<Anime25DDriver>,
): Partial<Anime25DDriver> {
  const sanitized: Partial<Anime25DDriver> = {}
  const output = sanitized as Record<string, unknown>
  for (const [rawKey, rawValue] of Object.entries(partial)) {
    const key = rawKey as keyof Anime25DDriver
    const identityValue = IDENTITY_DRIVER[key]
    if (typeof identityValue === 'boolean') {
      if (typeof rawValue === 'boolean') output[rawKey] = rawValue
      continue
    }
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) continue
    const limits = DRIVER_LIMITS[key]
    output[rawKey] = limits
      ? Math.max(limits[0], Math.min(limits[1], rawValue))
      : rawValue
  }
  return sanitized
}
