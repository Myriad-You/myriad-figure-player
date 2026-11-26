import type { Anime25DDriver } from './driver'
import type { Anime25DExpressionDeformationKind } from './expressionDeformation'
import type { Anime25DEyeFeatureKind } from './layerDeformation'
import type { Anime25DMouthDeformationKind } from './mouthDeformation'
import type { MouthMorphState } from './mouthRuntime'
import type { Anime25DStickerFaceMotion } from './stickerFaceMotion'
import type { Anime25DFade } from './types'

export const ANIME25D_DEFORMATION_EYE = 1 << 0
export const ANIME25D_DEFORMATION_MOUTH = 1 << 1
export const ANIME25D_DEFORMATION_JAW = 1 << 2
export const ANIME25D_DEFORMATION_STICKER_FACE = 1 << 3
export const ANIME25D_DEFORMATION_TIME = 1 << 4

const ALL_DEFORMATION_CHANGES =
  ANIME25D_DEFORMATION_EYE |
  ANIME25D_DEFORMATION_MOUTH |
  ANIME25D_DEFORMATION_JAW |
  ANIME25D_DEFORMATION_STICKER_FACE |
  ANIME25D_DEFORMATION_TIME

const EYE_DRIVER_KEYS = [
  'lidL',
  'lidR',
  'eyeScaleL',
  'eyeScaleR',
  'eyeCY',
  'eyeCAng',
  'gazeX',
  'gazeY',
  'irisScale',
  'eyeSmile',
  'eyeWide',
  'browLift',
  'browTiltL',
  'browTiltR',
  'browTilt',
  'eyeCry',
] as const satisfies readonly (keyof Anime25DDriver)[]

const MOUTH_DRIVER_KEYS = [
  'lipCurve',
  'mouthCY',
  'mouthCAng',
  'mouthScale',
  'eyeCry',
] as const satisfies readonly (keyof Anime25DDriver)[]

const MOUTH_MORPH_KEYS = [
  'centerX',
  'centerY',
  'width',
  'height',
  'openMix',
  'wide',
  'round',
  'narrow',
  'openCenterY',
  'openHeight',
] as const satisfies readonly (keyof MouthMorphState)[]

const STICKER_FACE_MOTION_KEYS = [
  'maniac',
  'maniacUpperMouthPulse',
  'sillyEyeScale',
  'sillyIrisOffsetXL',
  'sillyIrisOffsetYL',
  'sillyIrisOffsetXR',
  'sillyIrisOffsetYR',
  'sillyMouthOpen',
  'lovestruckHeartScale',
  'lovestruckFaceScale',
  'lovestruckDroolOffsetY',
  'angerMarkScale',
  'angerMarkOffsetY',
  'angerMarkRotation',
  'speechlessSweatScale',
  'speechlessSweatOffsetX',
  'speechlessSweatOffsetY',
  'speechlessSweatRotation',
] as const satisfies readonly (keyof Anime25DStickerFaceMotion)[]

export interface Anime25DDeformationChangeState {
  initialized: boolean
  eye: Float64Array
  mouthDriver: Float64Array
  mouthMorph: Float64Array
  stickerFace: Float64Array
  jawDrop: number
  jawOpen: number
  irisReboundX: number
  irisReboundY: number
}

export interface Anime25DLayerDeformationPlan {
  cacheable: boolean
  dependencyMask: number
  pendingMask: number
  initialized: boolean
}

export function createAnime25DDeformationChangeState(): Anime25DDeformationChangeState {
  return {
    initialized: false,
    eye: new Float64Array(EYE_DRIVER_KEYS.length),
    mouthDriver: new Float64Array(MOUTH_DRIVER_KEYS.length),
    mouthMorph: new Float64Array(MOUTH_MORPH_KEYS.length),
    stickerFace: new Float64Array(STICKER_FACE_MOTION_KEYS.length),
    jawDrop: 0,
    jawOpen: 0,
    irisReboundX: 1,
    irisReboundY: 1,
  }
}

export function captureAnime25DDeformationChanges(
  state: Anime25DDeformationChangeState,
  driver: Readonly<Anime25DDriver>,
  mouthMorph: Readonly<MouthMorphState>,
  jawDrop: number,
  jawOpen: number,
  stickerFaceMotion: Readonly<Anime25DStickerFaceMotion> | null,
  irisRebound?: Readonly<{ x: number; y: number }>,
): number {
  const firstFrame = !state.initialized
  let changes = ANIME25D_DEFORMATION_TIME

  if (captureValues(driver, EYE_DRIVER_KEYS, state.eye) || firstFrame) {
    changes |= ANIME25D_DEFORMATION_EYE
  }
  const reboundX = irisRebound?.x ?? 1
  const reboundY = irisRebound?.y ?? 1
  if (reboundX !== state.irisReboundX || reboundY !== state.irisReboundY)
    changes |= ANIME25D_DEFORMATION_EYE
  state.irisReboundX = reboundX
  state.irisReboundY = reboundY
  const mouthDriverChanged = captureValues(
    driver,
    MOUTH_DRIVER_KEYS,
    state.mouthDriver,
  )
  const mouthMorphChanged = captureValues(
    mouthMorph,
    MOUTH_MORPH_KEYS,
    state.mouthMorph,
  )
  if (mouthDriverChanged || mouthMorphChanged || firstFrame) {
    changes |= ANIME25D_DEFORMATION_MOUTH
  }
  if (jawDrop !== state.jawDrop || jawOpen !== state.jawOpen || firstFrame) {
    changes |= ANIME25D_DEFORMATION_JAW
  }
  state.jawDrop = jawDrop
  state.jawOpen = jawOpen
  if (captureStickerFaceValues(stickerFaceMotion, state.stickerFace) || firstFrame) {
    changes |= ANIME25D_DEFORMATION_STICKER_FACE
  }
  state.initialized = true
  return firstFrame ? ALL_DEFORMATION_CHANGES : changes
}

export function resolveAnime25DDeformationDependencies(input: {
  baseRole: string
  fade: Anime25DFade | null
  shaderGlobalTransform: boolean
  localDynamic: boolean
  eyeFeatureKind: Anime25DEyeFeatureKind | null
  expressionDeformationKind: Anime25DExpressionDeformationKind | null
  mouthDeformationKind: Anime25DMouthDeformationKind | null
}): number {
  if (!input.localDynamic || !input.shaderGlobalTransform) return 0
  let dependencies = 0
  if (input.eyeFeatureKind) dependencies |= ANIME25D_DEFORMATION_EYE

  switch (input.expressionDeformationKind) {
    case 'cry-eye':
      dependencies |= ANIME25D_DEFORMATION_EYE | ANIME25D_DEFORMATION_TIME
      break
    case 'silly-eye':
      dependencies |= ANIME25D_DEFORMATION_STICKER_FACE
      break
    case 'lovestruck-heart':
      dependencies |= ANIME25D_DEFORMATION_EYE | ANIME25D_DEFORMATION_STICKER_FACE
      break
    case 'lovestruck-drool':
      dependencies |= ANIME25D_DEFORMATION_MOUTH | ANIME25D_DEFORMATION_STICKER_FACE
      break
    case 'lovestruck-face':
    case 'nose-lift':
    case 'anger-mark':
    case 'speechless-sweat':
      dependencies |= ANIME25D_DEFORMATION_STICKER_FACE
      break
    default:
      break
  }

  if (input.mouthDeformationKind) {
    dependencies |= ANIME25D_DEFORMATION_MOUTH
    if (input.fade !== 'mouthSilly') {
      dependencies |= ANIME25D_DEFORMATION_JAW
    }
    if (input.mouthDeformationKind === 'cry') {
      dependencies |= ANIME25D_DEFORMATION_TIME
    }
    if (input.fade === 'mouthManiac' || input.fade === 'mouthSilly') {
      dependencies |= ANIME25D_DEFORMATION_STICKER_FACE
    }
  }
  if (input.baseRole === 'face') dependencies |= ANIME25D_DEFORMATION_JAW
  return dependencies
}

export function createAnime25DLayerDeformationPlan(
  cacheable: boolean,
  dependencyMask: number,
): Anime25DLayerDeformationPlan {
  return {
    cacheable,
    dependencyMask,
    pendingMask: 0,
    initialized: false,
  }
}

export function shouldUpdateAnime25DLayerGeometry(
  plan: Anime25DLayerDeformationPlan,
  changeMask: number,
  visible: boolean,
): boolean {
  plan.pendingMask |= changeMask
  if (!visible) return false
  return (
    !plan.cacheable ||
    !plan.initialized ||
    (plan.pendingMask & plan.dependencyMask) !== 0
  )
}

export function markAnime25DLayerGeometryUpdated(
  plan: Anime25DLayerDeformationPlan,
): void {
  plan.initialized = true
  plan.pendingMask &= ~plan.dependencyMask
}

function captureValues<TValue extends object, TKey extends keyof TValue>(
  current: Readonly<TValue>,
  keys: readonly TKey[],
  previous: Float64Array,
): boolean {
  let changed = false
  for (let index = 0; index < keys.length; index += 1) {
    const value = current[keys[index]] as number
    if (value !== previous[index]) changed = true
    previous[index] = value
  }
  return changed
}

function captureStickerFaceValues(
  current: Readonly<Anime25DStickerFaceMotion> | null,
  previous: Float64Array,
): boolean {
  let changed = false
  for (let index = 0; index < STICKER_FACE_MOTION_KEYS.length; index += 1) {
    const value = current?.[STICKER_FACE_MOTION_KEYS[index]] ?? 0
    if (value !== previous[index]) changed = true
    previous[index] = value
  }
  return changed
}
