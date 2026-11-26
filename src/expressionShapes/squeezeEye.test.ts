import assert from 'node:assert/strict'
import test from 'node:test'
import {
  squeezeEyeDisplayScale,
} from './squeezeEye'

test('display scale enlarges undersized marks and leaves fitted art alone', () => {
  const eye = { x0: 10, x1: 90 }
  assert.ok(squeezeEyeDisplayScale(28, eye) > 2)
  assert.equal(squeezeEyeDisplayScale(83.2, eye), 1)
})
