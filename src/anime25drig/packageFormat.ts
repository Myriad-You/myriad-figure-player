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
// Which version a package is of is its `version` field alone. Converting renames, keeping every field and its value;
// what cannot be kept fails the conversion instead of being dropped.

/** The versions this player reads, oldest first. */
export const ANIME25D_PLAYBACK_VERSIONS_READ = [ANIME25D_PLAYBACK_VERSION, ANIME25D_PLAYBACK_CURRENT_VERSION] as const

export type Anime25DPlaybackVersion = typeof ANIME25D_PLAYBACK_VERSIONS_READ[number]

/** The identity fields of version 7 and of the current version. */
const V7_IDENTITY = ['kind', 'version', 'engine', 'engineUrl', 'license', 'copyright'] as const
const CURRENT_IDENTITY = ['kind', 'version', 'credits'] as const

/**
 * Where the current form keeps a version 7 package's own `credits` field, which version 7 does not define: carried
 * under a name no version defines, and written back as `credits` in version 7.
 */
export const V7_CREDITS_CARRIED = 'credits@7'

/**
 * A package as the runtime holds it, whichever version it was written in: one of the current version is itself; one of
 * version 7 is a copy with its identity and pose-correction axes renamed, every other field in its place. Converts
 * only; whether the package holds, isAnime25DPlayback says. Throws a FigureError: `anime25dPlaybackVersion` for a
 * version this player does not read, `anime25dPlaybackInvalid` where a version 7 package is not shaped as its
 * conversion needs.
 */
export function readAnime25DPlayback(document: Anime25DPlaybackDocument): Anime25DPlayback {
  if (!isRecord(document)) throw invalid('package')
  const { version } = document
  if (version === ANIME25D_PLAYBACK_CURRENT_VERSION) return document as unknown as Anime25DPlayback
  if (version !== ANIME25D_PLAYBACK_VERSION) throw unreadable(version)
  const { engine, engineUrl, license, copyright } = document
  if (typeof engine !== 'string') throw invalid('engine')
  const texts = { url: engineUrl, license, copyright }
  for (const [field, text] of Object.entries(texts)) {
    if (text !== undefined && typeof text !== 'string') throw invalid(field === 'url' ? 'engineUrl' : field)
  }
  if (Object.hasOwn(document, V7_CREDITS_CARRIED)) throw unconvertible(ANIME25D_PLAYBACK_CURRENT_VERSION, V7_CREDITS_CARRIED)
  const credit: Anime25DCredit = { name: engine, ...defined(texts as Record<string, string | undefined>) }
  return convert(document, {
    identity: { kind: ANIME25D_PLAYBACK_CURRENT_KIND, version: ANIME25D_PLAYBACK_CURRENT_VERSION, credits: [credit] },
    dropped: V7_IDENTITY,
    carried: { credits: V7_CREDITS_CARRIED },
    corrections: corrections => poseCorrectionsFromV7(corrections as never),
  }) as unknown as Anime25DPlayback
}

/**
 * A package written in `version`, every field in its place. Version 7 names its one credit, the reference project, as
 * `engine` with that credit's url, licence and copyright: a package whose credits are not exactly that one cannot be
 * written in version 7, nor one carrying a field version 7 gives another meaning. Throws a FigureError
 * (`anime25dPlaybackUnconvertible`, `anime25dPlaybackInvalid`, `anime25dPlaybackVersion`) rather than lose a value.
 */
export function writeAnime25DPlayback(playback: Anime25DPlayback, version: typeof ANIME25D_PLAYBACK_VERSION): Anime25DPlaybackV7
export function writeAnime25DPlayback(playback: Anime25DPlayback, version: typeof ANIME25D_PLAYBACK_CURRENT_VERSION): Anime25DPlayback
export function writeAnime25DPlayback(playback: Anime25DPlayback, version: Anime25DPlaybackVersion): Anime25DPlaybackDocument
export function writeAnime25DPlayback(playback: Anime25DPlayback, version: Anime25DPlaybackVersion): Anime25DPlaybackDocument {
  if (version === ANIME25D_PLAYBACK_CURRENT_VERSION) return playback
  if (version !== ANIME25D_PLAYBACK_VERSION) throw unreadable(version)
  if (!isRecord(playback)) throw invalid('package')
  const credits: unknown = playback.credits
  const credit = Array.isArray(credits) && credits.length === 1 && isRecord(credits[0]) ? credits[0] : null
  if (credit?.name !== ANIME25D_PROJECT_NAME) throw unconvertible(ANIME25D_PLAYBACK_VERSION, 'credits')
  for (const field of Object.keys(credit)) {
    if (!['name', 'url', 'license', 'copyright'].includes(field)) throw unconvertible(ANIME25D_PLAYBACK_VERSION, `credits.0.${field}`)
  }
  for (const field of V7_IDENTITY) {
    if (!(CURRENT_IDENTITY as readonly string[]).includes(field) && Object.hasOwn(playback, field)) throw unconvertible(ANIME25D_PLAYBACK_VERSION, field)
  }
  return convert(playback, {
    identity: {
      kind: ANIME25D_PLAYBACK_KIND,
      version: ANIME25D_PLAYBACK_VERSION,
      engine: ANIME25D_PROJECT_NAME,
      ...defined({ engineUrl: credit.url, license: credit.license, copyright: credit.copyright } as Record<string, string | undefined>),
    },
    dropped: CURRENT_IDENTITY,
    carried: { [V7_CREDITS_CARRIED]: 'credits' },
    corrections: corrections => poseCorrectionsToV7(corrections as never),
  }) as unknown as Anime25DPlaybackV7
}

interface Conversion {
  /** The identity written, where the source's `kind` was (first, if it has none). */
  identity: Record<string, unknown>
  /** The source's identity fields, replaced by `identity`. */
  dropped: readonly string[]
  /** Fields moved to another name, in place. */
  carried: Readonly<Record<string, string>>
  corrections: (corrections: unknown[]) => unknown
}

/** `from` converted as `conversion` says: every other field is the same value, in the same place. */
function convert(from: Record<string, unknown>, conversion: Conversion): Record<string, unknown> {
  const { identity, dropped, carried, corrections } = conversion
  const entries = Object.entries(from).flatMap(([key, value]): Array<[string, unknown]> => {
    if (key === 'kind') return Object.entries(identity)
    if (dropped.includes(key)) return []
    if (Object.hasOwn(carried, key)) return [[carried[key]!, value]]
    if (key !== 'shellProfile') return [[key, value]]
    if (!isRecord(value)) throw invalid('shellProfile')
    return [[key, Object.fromEntries(Object.entries(value).map(([field, inner]) =>
      [field, field === 'poseCorrections' ? corrections(checkedCorrections(inner)) : inner]))]]
  })
  return Object.fromEntries(Object.hasOwn(from, 'kind') ? entries : [...Object.entries(identity), ...entries])
}

/** Pose corrections shaped as renaming their axes needs: a list of records, each with a record `at`. */
function checkedCorrections(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw invalid('shellProfile.poseCorrections')
  value.forEach((correction, index) => {
    if (!isRecord(correction) || !isRecord(correction.at)) throw invalid(`shellProfile.poseCorrections.${index}.at`)
  })
  return value
}

function unreadable(version: unknown): FigureError {
  return new FigureError('anime25dPlaybackVersion', { version: String(version), read: ANIME25D_PLAYBACK_VERSIONS_READ.join(', ') })
}

function invalid(field: string): FigureError {
  return new FigureError('anime25dPlaybackInvalid', { field })
}

function unconvertible(version: number, field: string): FigureError {
  return new FigureError('anime25dPlaybackUnconvertible', { version, field })
}

/** The fields that have a value. */
function defined(fields: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
