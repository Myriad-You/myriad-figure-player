import type { Anime25DPlayback, Anime25DPlaybackV7 } from './types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { FigureError } from '../errors'
import { ANIME25D_COPYRIGHT, ANIME25D_LICENSE, ANIME25D_PROJECT_NAME, ANIME25D_PROJECT_URL } from './credit'
import { readAnime25DPlayback, writeAnime25DPlayback } from './packageFormat'
import { isAnime25DPlayback } from './types'

const MATERIALS = ['mouthClose', 'mouthOpen', 'mouthWide', 'mouthRound', 'mouthNarrow', 'mouthManiac'] as const
const PATCHES = [{ x: 0, y: 0, radiusX: 0.6, radiusY: 0.4, dx: 0.05, dy: -0.04 }]

/** What a package of either version holds besides its identity, its shell's corrections left to the version. */
function content() {
  return {
    pixelCanvas: { width: 100, height: 120 },
    layers: [{
      name: 'face', role: 'face', depth: 1, group: 'head' as const, phys: null, fade: null, side: null,
      x: 20, y: 10, w: 60, h: 70, atlas: { x: 0, y: 0, w: 0.5, h: 0.5 }, strands: [],
    }],
    anchors: {
      face: { x0: 25, y0: 12, x1: 75, y1: 78, cx: 50, cy: 45 },
      neckPivot: { x: 50, y: 80 }, neckTop: 76, neckBottom: 90, bodyPivot: { x: 50, y: 110 },
      mouth: { x0: 42, y0: 60, x1: 58, y1: 66, cx: 50, cy: 63 }, faceScale: 1,
    },
    mouthProfile: {
      version: 1 as const, source: 'alpha-contour' as const,
      silhouettes: MATERIALS.map(material => ({ material, centerX: 50, centerY: 63, width: 16, height: 6, leftCornerY: 63, rightCornerY: 63, fillRatio: 0.5, aperture: 0.5 })),
      bridges: MATERIALS.flatMap((first, i) => MATERIALS.slice(i + 1).map(second =>
        ({ first, second, widthScale: 1, heightScale: 1, neutralization: 0, centerOffsetX: 0, centerOffsetY: 0 }))),
    },
    chestProfile: {
      version: 2 as const, enabled: true, source: 'geometry-fallback' as const, centerX: 50, centerY: 100, radiusX: 20, radiusY: 15,
      visibleScale: 0.5, motionScale: 1, frequencyScale: 1, supportScale: 0.45, garmentMotionScale: 0.65, confidence: 0,
    },
    shell: {
      version: 1 as const, source: 'anchor-derived' as const, enabled: true, blend: 0.5,
      head: { centerX: 50, centerY: 40, radiusX: 25, radiusY: 30, radiusZ: 18 },
      faceProfile: { enabled: true, startY: 10, endY: 80, points: [0.06, 0.42, 0.62, 0.78, 0.97].map(v => ({ v, z: 0.1 })) },
      hair: {
        centerX: 50, centerY: 38, radiusX: 28, radiusY: 33, radiusZ: 19, frontGap: 0.18, frontBulge: 1, backDepth: 0.35, crownRound: 0,
        hairlinePin: { enabled: true, mode: 'strand-roots' as const, centerX: 0, centerY: -0.45, halfWidth: 1.1, halfHeight: 0.32, feather: 0.06 },
      },
      torso: { enabled: true, blend: 0.5, centerX: 50, radiusX: 40, radiusZ: 25 },
    },
  }
}

/** A package of version 7 laid out as the package builder writes it. */
function packageV7(): Anime25DPlaybackV7 {
  const { shell, ...rest } = content()
  const { pixelCanvas, layers, anchors, mouthProfile, chestProfile } = rest
  return {
    kind: 'anime-2.5d-rig',
    version: 7,
    engine: ANIME25D_PROJECT_NAME,
    engineUrl: ANIME25D_PROJECT_URL,
    license: ANIME25D_LICENSE,
    copyright: ANIME25D_COPYRIGHT,
    pixelCanvas,
    layers,
    anchors,
    mouthProfile,
    chestProfile,
    shellProfile: { ...shell, poseCorrections: [
      { surface: 'head', at: { angleX: 0.8, angleY: -0.6 }, patches: PATCHES },
      { surface: 'front-hair', at: { angleY: 0.5, eyeCloseL: 1, mouthOpen: 0.4 }, patches: PATCHES },
    ] },
    figureStance: 'ground',
  }
}

/** The same package written by hand in version 8. */
function packageV8(): Anime25DPlayback {
  const { shell, ...rest } = content()
  const { pixelCanvas, layers, anchors, mouthProfile, chestProfile } = rest
  return {
    kind: 'myriad-figure',
    version: 8,
    credits: [{ name: ANIME25D_PROJECT_NAME, url: ANIME25D_PROJECT_URL, license: ANIME25D_LICENSE, copyright: ANIME25D_COPYRIGHT }],
    pixelCanvas,
    layers,
    anchors,
    mouthProfile,
    chestProfile,
    shellProfile: { ...shell, poseCorrections: [
      { surface: 'head', at: { headYaw: 0.8, headPitch: -0.6 }, patches: PATCHES },
      { surface: 'front-hair', at: { headPitch: 0.5, lidCloseL: 1, jaw: 0.4 }, patches: PATCHES },
    ] },
    figureStance: 'ground',
  }
}

test('a package of either version holds, and both read as the same package', () => {
  assert.equal(isAnime25DPlayback(packageV7()), true)
  assert.equal(isAnime25DPlayback(packageV8()), true)
  const fromV7 = readAnime25DPlayback(packageV7())
  assert.deepEqual(fromV7, packageV8())
  assert.equal(JSON.stringify(fromV7), JSON.stringify(packageV8()), 'every field in the same place')
  assert.equal(isAnime25DPlayback(fromV7), true)
})

test('a package of the current version is held as it is', () => {
  const current = packageV8()
  assert.equal(readAnime25DPlayback(current), current)
  assert.equal(writeAnime25DPlayback(current, 8), current)
})

test('a package of version 7 read and written as version 7 again is the same, byte for byte', () => {
  const v7 = packageV7()
  assert.equal(JSON.stringify(writeAnime25DPlayback(readAnime25DPlayback(v7), 7)), JSON.stringify(v7))
  const bare = packageV7()
  delete bare.engineUrl
  delete bare.license
  delete bare.copyright
  delete bare.shellProfile.poseCorrections
  assert.equal(JSON.stringify(writeAnime25DPlayback(readAnime25DPlayback(bare), 7)), JSON.stringify(bare))
  assert.deepEqual(readAnime25DPlayback(bare).credits, [{ name: ANIME25D_PROJECT_NAME }])
})

test('a field of the other version\'s identity is not carried across', () => {
  const v7 = { ...packageV7(), credits: [{ name: 'other' }] }
  assert.deepEqual(readAnime25DPlayback(v7), packageV8())
  const v8 = { ...packageV8(), engine: 'other', engineUrl: 'other' }
  assert.equal(JSON.stringify(writeAnime25DPlayback(v8, 7)), JSON.stringify(packageV7()))
})

test('the version says which identity and which axis keys a package has', () => {
  const v7 = packageV7() as unknown as Record<string, any>
  const v8 = packageV8() as unknown as Record<string, any>
  const variants: Array<[string, Record<string, unknown>]> = [
    ['version 7 with the current axes', { ...v7, shellProfile: v8.shellProfile }],
    ['version 8 with the axes of version 7', { ...v8, shellProfile: v7.shellProfile }],
    ['version 7 of the current kind', { ...v7, kind: 'myriad-figure' }],
    ['version 8 of the kind of version 7', { ...v8, kind: 'anime-2.5d-rig' }],
    ['version 7 crediting no engine', { ...v7, engine: undefined }],
    ['version 7 as a string', { ...v7, version: '7' }],
    ['version 6', { ...v7, version: 6 }],
    ['version 9', { ...v8, version: 9 }],
    ['a credit with no name', { ...v8, credits: [{ url: ANIME25D_PROJECT_URL }] }],
    ['credits that are not a list', { ...v8, credits: { name: ANIME25D_PROJECT_NAME } }],
  ]
  for (const [name, variant] of variants) assert.equal(isAnime25DPlayback(variant), false, name)
  assert.equal(isAnime25DPlayback({ ...v8, credits: undefined }), true, 'credits are optional')
  assert.equal(isAnime25DPlayback({ ...v8, engine: ANIME25D_PROJECT_NAME }), true, 'a field version 8 does not have is not read')
})

test('a package of a version this player does not read is refused by name', () => {
  for (const version of [6, 9, '8']) {
    assert.throws(() => readAnime25DPlayback({ ...packageV8(), version } as never), (error: unknown) =>
      error instanceof FigureError && error.code === 'anime25dPlaybackVersion' && error.params.version === String(version) &&
      error.message === `This figure package is of version ${version}; this player reads versions 7, 8.`)
    assert.throws(() => writeAnime25DPlayback(packageV8(), version as never), FigureError)
  }
})
