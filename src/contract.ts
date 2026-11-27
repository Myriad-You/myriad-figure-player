// The words, bounds and checks of the two contracts a figure is spoken to in: the performance contract (what
// the director sends, what her state reports) and the rig contract (a rig's versions, limits and manifest, what
// an import hands the importer; the manifest's types and limits are here whole, so checking one needs
// nothing else). Both are byte copies of myriad-core's, in contracts/. A host that directs a
// figure, stores her rig or takes one in reads and checks them here, whatever plays the figure. Unstable: names
// and shapes here may change in any release before 1.0.

export type { FaceLife, FaceShift } from './performance/contract'
export {
  BODY_CONTROLS,
  BODY_POSE_TIMING,
  FACE_PRESETS,
  FACE_SHIFT_NAMES,
  faceLife,
  facePose,
  faceShift,
  MAX_FACES_PASSED,
  performanceCuePriority,
  PLAIN_FACE,
  sanitizeBodyPose,
  sanitizeScore,
  sanitizeSpeechPhrases,
  SCORE_MOVES,
  SCORE_TIMING,
  tierExtent,
} from './performance/contract'
export type { MeropePerformanceEventDetail, MeropeStateEventDetail } from './performance/directive'
export { meropePerformanceEventDetail, meropeStateEventDetail, sanitizePerformanceDirective } from './performance/directive'
export type { MoodBand } from './performance/mood'
export { moodBand } from './performance/mood'
export type {
  BodyControl,
  BodyPose,
  MeropeActivity,
  MoodTransition,
  PerformanceBaseline,
  PerformanceCue,
  PerformanceDirective,
  PerformancePhase,
  RigBeatPhase,
  RigBehaviorFunction,
  RigBehaviorPhase,
  RigMotionStyle,
  RigMusicEnergy,
  RigStateSummary,
  ScoreBeat,
  ScoreDirection,
  ScoreMove,
  ScoreMoveKind,
  ScoreSide,
  SpeechPhrase,
} from './performance/types'
export { BASELINE_EXPRESSIONS, CUE_INTENTS, INTERRUPT_MODES, PHRASE_INTENTS, POSTURES, SCORE_DIRECTIONS, SCORE_SIDES } from './performance/vocabulary'
export type { AuthoredExpressionKind } from './rig/authoredExpression'
export { AUTHORED_EXPRESSION_KINDS } from './rig/authoredExpression'
export type { CharacterAssetProfile } from './rig/contract'
export {
  CHARACTER_ASSET_PROFILES,
  characterAssetProfileOf,
  isCharacterAssetProfile,
  MAX_RIG_BONES,
  MAX_RIG_COLLISION_VOLUMES,
  MAX_RIG_PARTS,
  MAX_RIG_TEXTURES,
  MAX_RIG_TOTAL_VERTICES,
  MAX_RIG_VERTICES_PER_PART,
  MIN_SUPPORTED_RIG_IR_VERSION,
  RIG_IR_VERSION,
  RIG_OUTFIT_SAFETY,
  RIG_PRESENTATION_SLOTS,
  RIG_SCHEMA_VERSION,
  RIG_SECONDARY_PART_PATTERNS,
  RIG_SEMANTIC_BONE_ROLES,
  RIG_SEMANTIC_CHAIN_ROLES,
} from './rig/contract'
export type { DocumentTurnKeyforms } from './rig/documentTurnKeyforms'
export { isDocumentTurnKeyforms } from './rig/documentTurnKeyforms'
export type { MeropeRigImportSource, RigBoneHandle, RigLayerMeshSource, RigLayerSource, RigRect } from './rig/importSource'
export { isLiveMeropeManifest, isRigManifest } from './rig/manifestValidation'
export type { MeropeRigManifest, RigBone, RigCollisionVolume, RigMotionProfile, RigOutfitProfile, RigOutfitTopology, RigPart, RigPoint, RigQuality, RigSemanticAnchor, RigSemanticBoneRole, RigSemanticChainRole, RigSemantics, RigSize, RigSpatialProfile, RigTexture, RigVertex } from './rig/types'
export { RIG_OUTFIT_TOPOLOGIES } from './rig/types'
