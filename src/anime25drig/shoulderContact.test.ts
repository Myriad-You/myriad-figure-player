import assert from 'node:assert/strict'
import test from 'node:test'
import { shoulderContactWeights } from './shoulderContact'

test('pins adjoining skin but leaves detached or fabric sleeves unchanged', () => {
  const arm = { x: 0, y: 0, w: 100, h: 200, side: 'L' as const }
  const torso = { x: 98, y: 0, w: 200, h: 200, side: null }
  const raster = (r: number, g: number, b: number) => ({ width: 200, height: 200,
    pixels: new Uint8ClampedArray(Array.from({ length: 40000 }, () => [r, g, b, 255]).flat()) })
  const skin = raster(245, 200, 185)
  const rest = new Float32Array([99, 50, 0, 190])
  const weights = shoulderContactWeights(arm, skin, torso, skin, rest)
  assert.ok(weights)
  assert.equal(weights[0], 1)
  assert.equal(weights[1], 0)
  assert.equal(shoulderContactWeights(arm, skin, { ...torso, x: 150 }, skin, rest), null)
  assert.equal(shoulderContactWeights(arm, raster(70, 70, 110), torso, skin, rest), null)
  assert.equal(shoulderContactWeights(arm, null, torso, skin, rest), null)
})

test('the visible torso edge inside an overlapping arm is pinned, not only the arm cut edge', () => {
  const arm = { x: 0, y: 0, w: 100, h: 200, side: 'L' as const }
  const torso = { x: 40, y: 0, w: 200, h: 200, side: null }
  const skin = { width: 100, height: 200, pixels: new Uint8ClampedArray(100 * 200 * 4) }
  for (let i = 0; i < skin.pixels.length; i += 4) skin.pixels.set([245, 200, 185, 255], i)
  const rest = new Float32Array([40, 50, 60, 50, 99, 50, 0, 200])
  const weights = shoulderContactWeights(arm, skin, torso, skin, rest)!
  assert.ok(weights)
  assert.deepEqual(Iterator.from(weights).toArray(), [1, 1, 1, 0])
  // Mirroring preserves the same overlap constraint on the other shoulder.
  const mirrored = shoulderContactWeights(
    { ...arm, x: 140, side: 'R' }, skin,
    { ...torso, x: 0 }, skin,
    new Float32Array([200, 50, 180, 50, 141, 50, 240, 200]),
  )!
  assert.deepEqual(mirrored, weights)
})

test('overlap expansion stops at material changes and transparent gaps', () => {
  const arm = { x: 0, y: 0, w: 100, h: 200, side: 'L' as const }
  const torso = { ...arm, x: 20, w: 200, side: null }
  const skin = { width: 100, height: 200, pixels: new Uint8ClampedArray(100 * 200 * 4) }
  for (let i = 0; i < skin.pixels.length; i += 4) skin.pixels.set([245, 200, 185, 255], i)
  for (const color of [[245, 200, 185, 0], [60, 60, 100, 255]]) {
    const pixels = { ...skin, pixels: skin.pixels.slice() }
    for (let y = 0; y < 200; y++) { for (let x = 65; x <= 70; x++) pixels.pixels.set(color, (y * 100 + x) * 4)
}
    const weights = shoulderContactWeights(arm, pixels, torso, skin, new Float32Array([30, 50, 95, 50]))!
    assert.ok(weights)
    assert.ok(weights[0] < 0.7, 'must not jump a gap to pin another skin island')
    assert.equal(weights[1], 1)
  }
})
