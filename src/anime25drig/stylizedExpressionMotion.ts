/**
 * One sample of a sticker face's motion: the numbers a driving hands the stage through
 * `Anime25DDriving.stylizedMotion` each substep. The stage only draws them; how they move over time is the driving's.
 *
 * The fields are what the stage reads: the sticker art's scales, offsets and rotations, `maniac`, the two mouth
 * fields (`maniacUpperMouthPulse`, `sillyMouthOpen`) and the three head pulses (`maniacHeadPulse`, `sillyHeadPulse`,
 * `lovestruckHeadPulse`). A driving may hand over an object with more; the stage reads only these.
 */
export interface StylizedExpressionMotion {
  maniac: number
  maniacUpperMouthPulse: number
  maniacHeadPulse: number
  sillyEyeScale: number
  sillyIrisOffsetXL: number
  sillyIrisOffsetYL: number
  sillyIrisOffsetXR: number
  sillyIrisOffsetYR: number
  sillyMouthOpen: number
  sillyHeadPulse: number
  lovestruckHeartScale: number
  lovestruckFaceScale: number
  lovestruckDroolOffsetY: number
  lovestruckHeadPulse: number
  angerMarkScale: number
  angerMarkOffsetY: number
  angerMarkRotation: number
  speechlessSweatScale: number
  speechlessSweatOffsetX: number
  speechlessSweatOffsetY: number
  speechlessSweatRotation: number
}
