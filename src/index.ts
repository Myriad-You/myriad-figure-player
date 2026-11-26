// The public surface of this package: an Anime25DStage on a canvas draws a package (Anime25DPlayback; of any version
// it reads, an Anime25DPlaybackDocument, the format in docs/format.md), and an
// Anime25DDriving writes the driver values it draws (Anime25DStageShared: `current`, starting from IDENTITY_DRIVER,
// with a new Anime25DClosedEyePresentation and Anime25DIrisRebound). Anime25DBasicDriving is a driving with no performance:
// idle sway, blinks and easing toward a target; FigurePlayer is a stage moved by it. A drawn frame is an
// Anime25DPose: poseToJSON and poseFromJSON write and read it, blendPoses gives frames between two. What authoring
// tools read of a stage is in ./workbench. Everything else under src/ is internal.
// The types here are those a host names to use these; the package format's and the manifest's parts are in
// ./internals. Unstable: names and shapes here may change in any release before 1.0.

export type { Anime25DArmAim } from './anime25drig/arm3dReach'
export type { Anime25DArmSide } from './anime25drig/armVariantPresenter'
export type { Anime25DBasicFigure } from './anime25drig/basicDriving'
export { Anime25DBasicDriving, measureAnime25DBasicFigure } from './anime25drig/basicDriving'
export { Anime25DClosedEyePresentation } from './anime25drig/closedEyePresentation'
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
export type { Anime25DMotionEnvelopeProfile } from './anime25drig/motionEnvelope'
export type { Anime25DPlaybackVersion } from './anime25drig/packageFormat'
export { ANIME25D_PLAYBACK_VERSIONS_READ, readAnime25DPlayback, writeAnime25DPlayback } from './anime25drig/packageFormat'
export type { Anime25DDebugSnapshot } from './anime25drig/playerDebug'
export type { Anime25DInspection, Anime25DLayerView, Anime25DPoint } from './anime25drig/playerInspection'
export type { Anime25DPose } from './anime25drig/pose'
export { blendPoses, POSE_VERSION, poseFromJSON, poseToJSON } from './anime25drig/pose'
export type { Anime25DStageShared } from './anime25drig/stage'
export { Anime25DStage } from './anime25drig/stage'
export type { Anime25DStickerFaceMotion } from './anime25drig/stickerFaceMotion'
export type { Anime25DTouchMeshHit } from './anime25drig/touchHitTest'
export type { Anime25DTouchRegion, VisibleTouchHit } from './anime25drig/touchVisibility'
export type { Anime25DPlayback, Anime25DPlaybackDocument, Anime25DPlaybackV7 } from './anime25drig/types'
export { isAnime25DPlayback } from './anime25drig/types'
export type { FigureErrorCode, FigureErrorParams } from './errors'
export { FIGURE_ERROR_TEXT, FigureError, isFigureErrorCode } from './errors'
export { FigurePlayer } from './player'
export type { MeropeRigManifest } from './rig/types'
