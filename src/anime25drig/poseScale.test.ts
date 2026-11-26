import assert from 'node:assert/strict'
import test from 'node:test'
import { bodyLeanShare, HEAD_ROLL_RADIANS, HEAD_TILT_RADIANS, headRollForRadians, headRollRadians } from './poseScale'

test('the canvas cut takes none of the lean and the shoulders take all of it', () => {
  assert.equal(bodyLeanShare(100, 100, 60), 0)
  assert.equal(bodyLeanShare(130, 100, 60), 0)
  assert.equal(bodyLeanShare(40, 100, 60), 1)
  assert.equal(bodyLeanShare(0, 100, 60), 1)
  let previous = 0
  for (let y = 100; y >= 40; y -= 1) {
    const share = bodyLeanShare(y, 100, 60)
    assert.ok(share >= previous)
    previous = share
  }
})

test('no bend height is a rigid lean', () => {
  assert.equal(bodyLeanShare(100, 100, 0), 1)
})

test('everyday head roll stays linear and only a directed tilt reaches the full range', () => {
  for (const headRoll of [0, 0.1, 0.25, 0.45]) {
    assert.ok(Math.abs(headRollRadians(headRoll) - headRoll * HEAD_ROLL_RADIANS) < 1e-12)
  }
  assert.ok(Math.abs(headRollRadians(1) - HEAD_TILT_RADIANS) < 1e-12)
  assert.equal(headRollRadians(-0.8), -headRollRadians(0.8))
  let previous = 0
  for (let headRoll = 0; headRoll <= 1; headRoll += 0.01) {
    const roll = headRollRadians(headRoll)
    assert.ok(roll >= previous)
    assert.ok(roll - previous < 0.02, 'no jump at the knee')
    previous = roll
  }
})

test('the headRoll for a roll in radians undoes headRollRadians over the whole range', () => {
  for (let headRoll = -1; headRoll <= 1; headRoll += 0.05) {
    assert.ok(Math.abs(headRollForRadians(headRollRadians(headRoll)) - headRoll) < 1e-9, `${headRoll}`)
  }
  assert.equal(headRollForRadians(HEAD_TILT_RADIANS * 2), 1, 'no further than the full tilt')
})
