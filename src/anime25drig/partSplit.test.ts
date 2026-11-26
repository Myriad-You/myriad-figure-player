import type { Anime25DPart, Anime25DPlaybackLayer } from './types'
import type { CroppedLayerPixels } from './webglRuntime'
import assert from 'node:assert/strict'
import test from 'node:test'
import { partOfLayer, splitHangingParts, splitLayerName } from './partSplit'

const PINK = [240, 170, 190]
const GOLD = [210, 160, 40]

/** A w×h layer, pink and opaque, with a gold block at [gx0, gy0, gx1, gy1). */
function art(w: number, h: number, gold: [number, number, number, number] | null, clear: [number, number, number, number] | null = null): CroppedLayerPixels {
  const pixels = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const inGold = gold && x >= gold[0] && x < gold[2] && y >= gold[1] && y < gold[3]
      const inClear = clear && x >= clear[0] && x < clear[2] && y >= clear[1] && y < clear[3]
      const colour = inGold ? GOLD : PINK
      pixels.set([...colour, inClear && !inGold ? 0 : 255], i)
    }
  }
  return { pixels, width: w, height: h }
}

test('the pieces of an inventory are cut out of their hosts, named for their part', () => {
  const layer = (name: string, role: string): Anime25DPlaybackLayer => ({
    name, role, x: 100, y: 100, w: 60, h: 40, atlas: { x: 0, y: 0, w: 0.1, h: 0.1 },
  }) as Anime25DPlaybackLayer
  const choker = layer('neckwear', 'neckwear')
  const face = layer('face', 'face')
  const part = (patch: Partial<Anime25DPart>): Anime25DPart => ({
    name: 'pendant', layer: 'neckwear', separate: false, box: [114, 112, 126, 132], anchor: [120, 112],
    bone: 'neck', motion: 'dangle', material: 'metal', stiffness: 0.6, weight: 0.5, ...patch,
  })
  const profile = { version: 1 as const, source: 'ai-vision' as const, parts: [
    part({}),
    part({ name: 'unnamed', layer: null, box: [143, 130, 151, 139], anchor: [147, 130] }),
    part({ name: 'cloth', motion: 'sway' }),
    part({ name: 'earring', bone: 'head' }),
  ] }
  const pixels = art(60, 40, [16, 14, 24, 30], [0, 16, 60, 40])
  // A second charm low on the right, which the inventory did not place in a layer.
  for (let y = 32; y < 38; y++) {
    for (let x = 44; x < 50; x++) pixels.pixels.set([...GOLD, 255], (y * 60 + x) * 4)
  }
  const cut = splitHangingParts([face, choker], profile, { width: 1000, height: 1000 }, (l) => (l === choker ? pixels : null))
  assert.equal(cut.length, 2, 'the named and the found host; cloth stays, and an "earring" on the choker is not cut')
  assert.equal(cut[0].source.name, splitLayerName(0, profile.parts[0]))
  assert.equal(cut[0].source.role, 'objects')
  assert.equal(cut[0].host, choker)
  assert.equal(cut[1].host, choker, 'the topmost layer opaque at its middle')
  assert.equal(partOfLayer(profile, cut[0].source.name), profile.parts[0])
  assert.equal(partOfLayer(profile, 'neckwear'), profile.parts[0])
})

test('a piece found outside where its part may be, on a layer drawn at another scale one way than the other, stays', () => {
  // A wide gold block hanging from a band; the part is a thin strip of it.
  const image = art(120, 120, [30, 30, 90, 100], [0, 34, 120, 120])
  const hostOf = (w: number): Anime25DPlaybackLayer => ({
    name: 'hair', role: 'back-hair', z: 0, depth: 1, group: 'head', x: 0, y: 0, w, h: 120,
    atlas: { x: 0, y: 0, w: 1, h: 1 }, strands: [], phys: 'hair', fade: null, side: null,
  })
  const cutAt = (scale: number, half: number) => splitHangingParts([hostOf(120 * scale)], { version: 1, source: 'ai-vision', parts: [{
    name: 'block', layer: 'hair', separate: false,
    box: [(60 - half) * scale, 30, (60 + half) * scale, 100], anchor: [60 * scale, 30],
    bone: 'head', motion: 'dangle', material: 'metal', stiffness: 0.2, weight: 0.5,
  } satisfies Anime25DPart] }, { width: 8192, height: 8192 }, () => image)
  assert.equal(cutAt(1, 30).length, 1, 'one to one, it is cut')
  assert.equal(cutAt(20, 30).length, 1, 'stretched, it is cut where its box is')
  assert.equal(cutAt(20, 9).length, 0, 'found past its window, it is not the part')
})
