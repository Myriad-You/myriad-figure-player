import type { Anime25DRgb } from './rgb'

export type MouthExpressionKind =
  'open' | 'wide' | 'round' | 'narrow' | 'cry' | 'maniac' | 'silly'

export interface MouthExpressionPalette {
  line: Anime25DRgb
  cavity: Anime25DRgb
  fill: Anime25DRgb
}

/** A point of a generated mouth's outline, in the mouth's own unit box. */
export type Anime25DMouthPathPoint = readonly [x: number, y: number]
