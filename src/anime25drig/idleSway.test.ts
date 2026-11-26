import assert from 'node:assert/strict'
import test from 'node:test'
import { idleSwayOffset } from './idleSway'

test('idle sway phase depends only on time, not an authored switch', () => {
  const at = idleSwayOffset(3.7)
  assert.equal(
    at.headYaw,
    0.13 * Math.sin(3.7 * 0.42) + 0.05 * Math.sin(3.7 * 1.13),
  )
  assert.deepEqual(idleSwayOffset(3.7), at)
  const reusable = { headYaw: 0, headPitch: 0, headRoll: 0, bodyLean: 0 }
  assert.equal(idleSwayOffset(3.7, reusable), reusable)
  assert.deepEqual(reusable, at)
})
