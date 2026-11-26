import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dizzyEyeDisplayScale,
  sampleDizzyEyeTint,
} from './dizzyEye'

test('samples the dark eyelash color instead of transparent or bright pixels', () => {
  const pixels = new Uint8ClampedArray([
    255, 255, 255, 0, 230, 220, 210, 255, 36, 24, 52, 255, 40, 28, 56, 255,
  ])
  const tint = sampleDizzyEyeTint(pixels)
  assert.ok(tint.red < 60)
  assert.ok(tint.green < 50)
  assert.ok(tint.blue < 75)
})

test('display scale enlarges undersized spirals and leaves fitted artwork alone', () => {
  const eye = { x0: 10, x1: 90, y0: 20, y1: 52 }
  const generated = dizzyEyeDisplayScale(28, 28, eye)
  assert.ok(generated > 1.5)
  assert.ok(generated <= 2.2)
  assert.equal(dizzyEyeDisplayScale(74, 74, eye), 1)
})
