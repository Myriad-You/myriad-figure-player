// The expressions a page may hand the importer a redrawn picture of.

export const AUTHORED_EXPRESSION_KINDS = ['cry', 'squeeze', 'close'] as const
export type AuthoredExpressionKind = (typeof AUTHORED_EXPRESSION_KINDS)[number]
