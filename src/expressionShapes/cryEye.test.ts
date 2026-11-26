import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cryEyeDisplayScale,
} from './cryEye'

test('display scale only enlarges undersized authored crying art', () => {
  const eye = { x0: 10, x1: 90 }
  assert.ok(cryEyeDisplayScale(36, eye) > 2)
  assert.equal(cryEyeDisplayScale(88, eye), 1)
})
