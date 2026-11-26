// The public surface of this package: an Anime25DStage on a canvas draws a package (Anime25DPlayback), and an
// Anime25DDriving writes the driver values it draws (Anime25DStageShared: `current`, starting from IDENTITY_DRIVER,
// with a new ClosedEyePresentation and Anime25DIrisRebound). Anime25DBasicDriving is a driving with no performance:
// idle sway, blinks and easing toward a target; FigurePlayer is a stage moved by it. A drawn frame is an
// Anime25DPose: poseToJSON and poseFromJSON write and read it, blendPoses gives frames between two. What authoring
// tools read of a stage is in ./workbench. Everything else under src/ is internal.
// Unstable: names and shapes here may change in any release before 1.0.

export type { Anime25DArmAim } from './anime25drig/arm3dReach'
export type { Anime25DArmSide } from './anime25drig/armVariantPresenter'
export type { Anime25DBasicFigure } from './anime25drig/basicDriving'
export { Anime25DBasicDriving, measureAnime25DBasicFigure } from './anime25drig/basicDriving'
export type { BodyLift } from './anime25drig/bodyLift'
export { ClosedEyePresentation } from './anime25drig/closedEyePresentation'
export type { ContinuousMouthShape } from './anime25drig/continuousMouth'
export type { Anime25DDriver } from './anime25drig/driver'
export { IDENTITY_DRIVER } from './anime25drig/driver'
export type {
  Anime25DBodyDriving,
  Anime25DBoundBody,
  Anime25DDirectedBodyControl,
  Anime25DDriving,
  Anime25DFrameSample,
} from './anime25drig/driving'
export { Anime25DIrisRebound } from './anime25drig/irisRebound'
export type { Anime25DMotionEnvelopeAxis, Anime25DMotionEnvelopeProfile } from './anime25drig/motionEnvelope'
export type { Anime25DFrameWork, Anime25DPerformanceSample, Anime25DPerformanceSnapshot } from './anime25drig/performanceTelemetry'
export type { Anime25DDebugSnapshot } from './anime25drig/playerDebug'
export type { Anime25DInspection, Anime25DLayerView, Anime25DPoint } from './anime25drig/playerInspection'
export type { Anime25DArmPose, Anime25DClothPose, Anime25DDrawnArmPose, Anime25DLayerPose, Anime25DPose } from './anime25drig/pose'
export { blendPoses, poseFromJSON, poseToJSON } from './anime25drig/pose'
export type { PoseCorrection, PoseCorrectionAxis } from './anime25drig/poseCorrections'
export type { Anime25DRenderFrame } from './anime25drig/renderer'
export type { Anime25DSpinnerFrame } from './anime25drig/spinnerSticker'
export type { Anime25DStageShared } from './anime25drig/stage'
export { Anime25DStage } from './anime25drig/stage'
export type { Anime25DStickerFaceMotion } from './anime25drig/stickerFaceMotion'
export type { TouchMeshHit } from './anime25drig/touchHitTest'
export type { Anime25DTouchRegion, VisibleTouchHit } from './anime25drig/touchVisibility'
export type { Anime25DTurnKey, Anime25DTurnKeyforms, Anime25DTurnLattice } from './anime25drig/turnKeyforms'
export type {
  Anime25DArmJoints,
  Anime25DArmLift,
  Anime25DArmModel,
  Anime25DArmVariant,
  Anime25DChestProfile,
  Anime25DChestProfileSource,
  Anime25DEnhancement,
  Anime25DEyeAnchor,
  Anime25DFade,
  Anime25DGroup,
  Anime25DHairlinePinProfile,
  Anime25DJoint,
  Anime25DJointName,
  Anime25DMouthBridgeTuning,
  Anime25DMouthMaterial,
  Anime25DMouthProfile,
  Anime25DMouthSilhouette,
  Anime25DPart,
  Anime25DPartProfile,
  Anime25DPlayback,
  Anime25DPlaybackAnchors,
  Anime25DPlaybackLayer,
  Anime25DShellCurvePoint,
  Anime25DShellEllipsoid,
  Anime25DShellProfile,
  Anime25DSkeleton,
  Anime25DStrand,
  Anime25DTorsoShellProfile,
  Anime25DVec3,
} from './anime25drig/types'
export { isAnime25DPlayback } from './anime25drig/types'
export type { FigureErrorCode, FigureErrorParams } from './errors'
export { FIGURE_ERROR_TEXT, FigureError, isFigureErrorCode } from './errors'
export { FigurePlayer } from './player'
export type { CharacterAssetProfile } from './rig/contract'
export type {
  MeropeRigManifest,
  RigBone,
  RigCollisionVolume,
  RigMotionProfile,
  RigOutfitProfile,
  RigOutfitTopology,
  RigPart,
  RigPoint,
  RigQuality,
  RigSemanticAnchor,
  RigSemanticBoneRole,
  RigSemanticChainRole,
  RigSemantics,
  RigSize,
  RigSpatialProfile,
  RigTexture,
  RigVertex,
} from './rig/types'
