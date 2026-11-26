import type { Anime25DPlaybackLayer } from './types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { removeDuplicatedNeckComponents, splitPairedHeadAccessory } from './accessoryComponents'

test('a paired head piece splits only across transparent face space and preserves every atlas pixel', () => {
  const source = { name: 'earwear', role: 'earwear', group: 'head', side: null,
    x: 100, y: 200, w: 100, h: 80, atlas: { x: 0.1, y: 0.2, w: 0.4, h: 0.3 },
  } as Anime25DPlaybackLayer
  const art = { width: 20, height: 16, pixels: new Uint8ClampedArray(20 * 16 * 4) }
  for (let y = 0; y < 16; y++) { for (const x of [1, 2, 3, 16, 17, 18]) art.pixels[(y * 20 + x) * 4 + 3] = 255
}
  const original = structuredClone(source)
  const pixels = art.pixels.slice()
  const parts = splitPairedHeadAccessory(source, art, 150)!
  assert.equal(parts.length, 2)
  assert.deepEqual(parts.map(p => p.side), ['L', 'R'])
  assert.equal(parts[0].x, source.x)
  assert.equal(parts[0].x + parts[0].w, parts[1].x)
  assert.equal(parts[1].x + parts[1].w, source.x + source.w)
  assert.equal(parts[0].atlas.x + parts[0].atlas.w, parts[1].atlas.x)
  assert.ok(Math.abs(parts[1].atlas.x + parts[1].atlas.w - source.atlas.x - source.atlas.w) < 1e-12)
  assert.deepEqual(source, original)
  assert.deepEqual(art.pixels, pixels)
  assert.equal(splitPairedHeadAccessory(parts[0], art, 150), null)
  // Two hair clips either side of the face part the same way; a neck piece never does.
  assert.deepEqual(splitPairedHeadAccessory({ ...source, role: 'headwear' }, art, 150)!.map(p => p.side), ['L', 'R'])
  assert.equal(splitPairedHeadAccessory({ ...source, role: 'neckwear' }, art, 150), null)
  assert.equal(splitPairedHeadAccessory(source, null, 150), null)
  art.pixels[(8 * 20 + 10) * 4 + 3] = 1
  assert.equal(splitPairedHeadAccessory(source, art, 150), null, 'even a translucent connector is not cut')
})

function fixture() {
  const source = {
    role: 'headwear',
    x: 0,
    y: 0,
    w: 32,
    h: 48,
  } as Anime25DPlaybackLayer
  const layer = { ...source, role: 'neckwear' }
  const art = {
    width: 32,
    height: 48,
    pixels: new Uint8ClampedArray(32 * 48 * 4),
  }
  const image = { ...art, pixels: art.pixels.slice() }
  for (const top of [0, 32]) {
    for (let y = top; y < top + 8; y++) {
      for (let x = 4; x < 12; x++) {
        const i = (y * 32 + x) * 4
        const v = 100 + ((x * 31 + y * 17) % 130)
        art.pixels.set([v, v - 10, v - 20, 255], i)
        if (top === 32) image.pixels.set(art.pixels.subarray(i, i + 4), i)
      }
}
}
  return { source, layer, art, image }
}

test('removes only a co-located disconnected neck duplicate including its alpha fringe', () => {
  const { source, layer, art, image } = fixture()
  art.pixels.set([120, 110, 100, 12], (32 * 32 + 3) * 4)
  const original = art.pixels.slice()
    const target = image.pixels.slice()
  const patch = removeDuplicatedNeckComponents(
    source,
    art,
    [{ layer, image }],
    24,
  )
  assert.ok(patch)
  for (let i = 0; i < art.pixels.length; i++) {
    assert.equal(
      patch.pixels[i],
      i % 4 === 3 && i >= 32 * 32 * 4 ? 0 : original[i],
    )
  }
  assert.deepEqual(art.pixels, original)
  assert.deepEqual(image.pixels, target)
})

test('retains different detail, flat colours, insufficient coverage and distant matching ornaments', () => {
  for (const kind of [
    'detail',
    'flat',
    'coverage',
    'offset',
    'single',
    'above-neck',
    'animated',
  ]) {
    const { source, layer, art, image } = fixture()
    if (kind === 'detail') {
      for (let y = 32; y < 40; y++) {
        for (let x = 4; x < 12; x++) {
          const i = (y * 32 + x) * 4
          for (let c = 0; c < 3; c++)
            image.pixels[i + c] = 330 - art.pixels[i + c]
        }
}
}
    if (kind === 'flat') {
      for (let i = 0; i < art.pixels.length; i += 4) {
        art.pixels.set([200, 200, 200], i)
        image.pixels.set([200, 200, 200], i)
      }
}
    if (kind === 'coverage') image.pixels.fill(0, 36 * 32 * 4)
    if (kind === 'offset') layer.x += 8
    if (kind === 'single') art.pixels.fill(0, 0, 24 * 32 * 4)
    if (kind === 'animated') layer.fade = 'eyeClose'
    assert.equal(
      removeDuplicatedNeckComponents(
        source,
        art,
        [{ layer, image }],
        kind === 'above-neck' ? 40 : 24,
      ),
      null,
      kind,
    )
  }
})

test('one-texel segmentation displacement and small colour differences remain recognizable', () => {
  const { source, layer, art, image } = fixture()
  const shifted = {
    ...image,
    pixels: new Uint8ClampedArray(image.pixels.length),
  }
  for (let y = 32; y < 40; y++) {
    for (let x = 4; x < 12; x++) {
      const i = (y * 32 + x) * 4
        const j = i + 32 * 4
      shifted.pixels.set(
        [
          image.pixels[i] + 5,
          image.pixels[i + 1] + 5,
          image.pixels[i + 2] + 5,
          255,
        ],
        j,
      )
    }
}
  assert.ok(
    removeDuplicatedNeckComponents(
      source,
      art,
      [{ layer, image: shifted }],
      24,
    ),
  )
})
