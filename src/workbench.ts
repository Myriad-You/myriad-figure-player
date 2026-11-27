// For authoring tools (rig workbenches), not for pages that play a figure; no stability promise of any kind.
// What a tool reads of a live stage to place and preview pose corrections (Anime25DStage.poseStage() and
// previewPoseCorrections()), the geometry of authoring them (named regions on the face and crown, a new patch's
// reach, the pose it keys on, the driver that previews it, bounds and unsaved-change counts), the driver and the
// motion envelope probes a workbench poses a figure with, and the credits (project, licence, copyright) it shows and
// records in each package.

export { ANIME25D_COPYRIGHT, ANIME25D_LICENSE, ANIME25D_PROJECT_NAME, ANIME25D_PROJECT_URL, CREDITED_AUTHORS } from './anime25drig/credit'
export { WORKBENCH_DRIVER } from './anime25drig/driver'
export type { Anime25DMotionEnvelopeProbeId } from './anime25drig/motionEnvelope'
export { ANIME25D_MOTION_ENVELOPE_PROBES } from './anime25drig/motionEnvelope'
export type { PoseCorrectionProblem, PoseCorrectionRegion } from './anime25drig/poseAuthoring'
export {
  appendPoseCorrectionPatch,
  clampPoseCorrectionPatch,
  countPoseCorrectionChanges,
  nearestPoseCorrectionRegion,
  newPoseCorrectionPatch,
  POSE_CORRECTION_REGIONS,
  poseCorrectionCorner,
  poseCorrectionPreviewDriver,
  poseCorrectionRegionPoint,
  poseCorrectionTransitionDriver,
} from './anime25drig/poseAuthoring'
export type { PoseCorrection, PoseCorrectionAxis, PoseCorrectionAxisV7, PoseCorrectionDriver, PoseCorrectionV7 } from './anime25drig/poseCorrections'
export { isPoseCorrections, isPoseCorrectionsV7, poseCorrectionsFromV7, poseCorrectionsToV7 } from './anime25drig/poseCorrections'
export type { PoseCorrectionAtlas, PoseCorrectionPlayerLayer, PoseCorrectionStageLayer, PoseCorrectionStagePick, PoseCorrectionStageSource, PoseCorrectionSurface } from './anime25drig/poseCorrectionStage'
export {
  clientDeltaToPoseCorrection,
  pickPoseCorrectionAtClient,
  poseCorrectionStageRect,
  projectPoseCorrectionToClient,
} from './anime25drig/poseCorrectionStage'
