// Turn keys measured on a decomposition, in its document's pixels, as a page hands them to the importer.
import type { Anime25DTurnKeyforms } from '../anime25drig/turnKeyforms'
import { isAnime25DTurnKeyforms } from '../anime25drig/turnKeyforms'
import { everyItem } from './lists'

/** Keys measured on a decomposition, in its document's pixels. */
export interface DocumentTurnKeyforms {
  canvas: [number, number]
  keyforms: Anime25DTurnKeyforms
  /** A standing figure's body turn keys (bodyTurnKeyforms), on the same document. */
  bodyKeyforms?: Anime25DTurnKeyforms
}

/** What fits a texture (the manifest's own limit); the PSD it is measured on is 4096 at most. */
const MAX_DOCUMENT_EDGE = 16_384

export function isDocumentTurnKeyforms(value: unknown): value is DocumentTurnKeyforms {
  if (!value || typeof value !== 'object') return false
  const { canvas, keyforms, bodyKeyforms } = value as Record<string, unknown>
  return Array.isArray(canvas) && canvas.length === 2 && everyItem(canvas, (v) => typeof v === 'number' && v > 0 && v <= MAX_DOCUMENT_EDGE) &&
    isAnime25DTurnKeyforms(keyforms) && (bodyKeyforms === undefined || isAnime25DTurnKeyforms(bodyKeyforms))
}
