import { formatTemplate } from './rig/formatTemplate'

/**
 * Why the figure could not play, in English. The page shows its own words for
 * each code, filling them with the error's params.
 */
export const FIGURE_ERROR_TEXT = {
  anime25dPlaybackFailed: '2.5D motion could not play.',
  anime25dWebglFailed: 'This browser does not support WebGL2, so 2.5D motion cannot play.',
} as const

export type FigureErrorCode = keyof typeof FIGURE_ERROR_TEXT
export type FigureErrorParams = Record<string, string | number>

export class FigureError extends Error {
  override readonly name = 'FigureError'

  constructor(
    readonly code: FigureErrorCode,
    readonly params: FigureErrorParams = {},
  ) {
    super(formatTemplate(FIGURE_ERROR_TEXT[code], params))
  }
}

export function isFigureErrorCode(value: unknown): value is FigureErrorCode {
  return typeof value === 'string' && Object.hasOwn(FIGURE_ERROR_TEXT, value)
}
