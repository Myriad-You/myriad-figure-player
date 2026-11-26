import contract from '../../contracts/merope_rig_contract.json' with { type: 'json' }

/**
 * The two kinds of character asset: the bust, and the optional standing
 * full figure. Each has its own portrait, rig and contract
 * version, so changing one never invalidates the other.
 */
export const CHARACTER_ASSET_PROFILES = contract.characterAsset.profiles
export type CharacterAssetProfile = keyof typeof CHARACTER_ASSET_PROFILES

export const RIG_SEMANTIC_BONE_ROLES =
  contract.semanticBoneRoles as unknown as readonly [
    'root',
    'torso',
    'head',
    'face',
    'left-eye',
    'right-eye',
    'mouth',
    'handwear',
  ]
export const RIG_SEMANTIC_CHAIN_ROLES =
  contract.semanticChainRoles as unknown as readonly ['torso']
export const MAX_RIG_BONES = contract.limits.maxBones
export const RIG_MATRIX_CAPACITY = contract.limits.maxGpuBones
export const MAX_RIG_PARTS = contract.limits.maxParts

if (RIG_MATRIX_CAPACITY < MAX_RIG_BONES) {
  throw new Error(
    `Rig GPU capacity ${RIG_MATRIX_CAPACITY} is below manifest capacity ${MAX_RIG_BONES}`,
  )
}
