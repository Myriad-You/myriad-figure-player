// For authoring tools (rig workbenches), not for pages that play a figure; no stability promise of any kind.
// What a tool reads of a live stage to place and preview pose corrections (Anime25DStage.poseStage() and
// previewPoseCorrections()), the driver and the motion envelope probes a workbench poses a figure with, and the
// upstream credits it shows.

export { ANIME25D_PROJECT_NAME, ANIME25D_PROJECT_URL, PERSONA_UPSTREAM_THANKS } from './anime25drig/credit'
export { WORKBENCH_DRIVER } from './anime25drig/driver'
export type { Anime25DMotionEnvelopeProbeId } from './anime25drig/motionEnvelope'
export { ANIME25D_MOTION_ENVELOPE_PROBES } from './anime25drig/motionEnvelope'
export type { PoseCorrection } from './anime25drig/poseCorrections'
export { isPoseCorrections } from './anime25drig/poseCorrections'
export type { PoseCorrectionStageSource, PoseCorrectionSurface } from './anime25drig/poseCorrectionStage'
export {
  clientDeltaToPoseCorrection,
  pickPoseCorrectionAtClient,
  poseCorrectionStageRect,
  projectPoseCorrectionToClient,
} from './anime25drig/poseCorrectionStage'
