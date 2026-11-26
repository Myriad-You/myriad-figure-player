import type { Anime25DCredit, Anime25DPlayback, Anime25DPlaybackDocument, Anime25DPlaybackV7 } from './types'
import { FigureError } from '../errors'
import {
  ANIME25D_PLAYBACK_CURRENT_KIND,
  ANIME25D_PLAYBACK_CURRENT_VERSION,
  ANIME25D_PLAYBACK_KIND,
  ANIME25D_PLAYBACK_VERSION,
  ANIME25D_PROJECT_NAME,
} from './credit'
import { poseCorrectionsFromV7, poseCorrectionsToV7 } from './poseCorrections'

// A package's versions (docs/format.md) and the one form the runtime holds every package in, the current version's.
// Which version a package is of is its `version` field alone.

/** The versions this player reads, oldest first. */
export const ANIME25D_PLAYBACK_VERSIONS_READ = [ANIME25D_PLAYBACK_VERSION, ANIME25D_PLAYBACK_CURRENT_VERSION] as const

export type Anime25DPlaybackVersion = typeof ANIME25D_PLAYBACK_VERSIONS_READ[number]

/**
 * A package as the runtime holds it, whichever version it was written in: one of the current version is itself; one of
 * an earlier version is a copy with its identity and keys renamed, every field in its place. Converts only; whether the
 * package holds, isAnime25DPlayback says. Throws a FigureError (`anime25dPlaybackVersion`) for a version this player
 * does not read.
 */
export function readAnime25DPlayback(document: Anime25DPlaybackDocument): Anime25DPlayback {
  const version: unknown = (document as { version?: unknown } | null)?.version
  if (version === ANIME25D_PLAYBACK_CURRENT_VERSION) return document as Anime25DPlayback
  if (version !== ANIME25D_PLAYBACK_VERSION) throw unreadable(version)
  const { engine, engineUrl, license, copyright } = document as Anime25DPlaybackV7
  const credit: Anime25DCredit = { name: engine, ...defined({ url: engineUrl, license, copyright }) }
  return convert(document, {
    kind: ANIME25D_PLAYBACK_CURRENT_KIND,
    version: ANIME25D_PLAYBACK_CURRENT_VERSION,
    credits: [credit],
  }, poseCorrectionsFromV7 as (corrections: never) => unknown) as unknown as Anime25DPlayback
}

/**
 * A package written in `version`, every field in its place. Version 7 credits its reference project as `engine`, with
 * the url, licence and copyright of the credit by that name, so a package of version 7 read and written again is the
 * same, key for key.
 */
export function writeAnime25DPlayback(playback: Anime25DPlayback, version: typeof ANIME25D_PLAYBACK_VERSION): Anime25DPlaybackV7
export function writeAnime25DPlayback(playback: Anime25DPlayback, version: typeof ANIME25D_PLAYBACK_CURRENT_VERSION): Anime25DPlayback
export function writeAnime25DPlayback(playback: Anime25DPlayback, version: Anime25DPlaybackVersion): Anime25DPlaybackDocument
export function writeAnime25DPlayback(playback: Anime25DPlayback, version: Anime25DPlaybackVersion): Anime25DPlaybackDocument {
  if (version === ANIME25D_PLAYBACK_CURRENT_VERSION) return playback
  if (version !== ANIME25D_PLAYBACK_VERSION) throw unreadable(version)
  const credit = playback.credits?.find(entry => entry.name === ANIME25D_PROJECT_NAME)
  return convert(playback, {
    kind: ANIME25D_PLAYBACK_KIND,
    version: ANIME25D_PLAYBACK_VERSION,
    engine: ANIME25D_PROJECT_NAME,
    ...defined({ engineUrl: credit?.url, license: credit?.license, copyright: credit?.copyright }),
  }, poseCorrectionsToV7 as (corrections: never) => unknown) as unknown as Anime25DPlaybackV7
}

/** The fields that say what a package is, in any version. */
const IDENTITY: ReadonlySet<string> = new Set(['kind', 'version', 'engine', 'engineUrl', 'license', 'copyright', 'credits'])

/**
 * `from` with `identity` where its `kind` was (every other identity field of either version gone) and its pose
 * corrections converted where they were; everything else is the same object.
 */
function convert(
  from: object,
  identity: Record<string, unknown>,
  corrections: (corrections: never) => unknown,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(from).flatMap(([key, value]): Array<[string, unknown]> => {
    if (key === 'kind') return Object.entries(identity)
    if (IDENTITY.has(key)) return []
    if (key !== 'shellProfile') return [[key, value]]
    const shell = Object.fromEntries(Object.entries(value as object).map(([field, inner]) =>
      [field, field === 'poseCorrections' ? corrections(inner as never) : inner]))
    return [[key, shell]]
  }))
}

function unreadable(version: unknown): FigureError {
  return new FigureError('anime25dPlaybackVersion', { version: String(version), read: ANIME25D_PLAYBACK_VERSIONS_READ.join(', ') })
}

/** The fields that have a value. */
function defined<T extends Record<string, string | undefined>>(fields: T): { [K in keyof T]?: string } {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as { [K in keyof T]?: string }
}
