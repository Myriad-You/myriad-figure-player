/** The gestures an arm can be drawn in beside the portrait's own, one arm picture each. */
export const ARM_VARIANT_GESTURES = ['wave', 'point', 'chest', 'chin'] as const
export type ArmVariantGesture = (typeof ARM_VARIANT_GESTURES)[number]
