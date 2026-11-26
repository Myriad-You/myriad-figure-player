import assert from 'node:assert/strict'
import test from 'node:test'
import { stepMouthForm, stepMouthOpen } from './mouthResponse'

test('opens promptly and returns to rest more softly', () => {
  const opened = stepMouthOpen(0, 1, 1 / 60)
  const released = stepMouthOpen(1, 0, 1 / 60)
  assert.ok(opened > 1 - released)
  assert.ok(opened > 0.25 && opened < 0.3)
  assert.ok(released > 0.8 && released < 0.85)
})

test('keeps mouth form steadier than jaw opening', () => {
  const jawTravel = stepMouthOpen(0, 1, 1 / 60)
  const formTravel = stepMouthForm(0, 1, 1 / 60)
  assert.ok(formTravel < jawTravel)
})

test('produces the same constant-target response at 30 and 60 fps', () => {
  let at30 = 0
  let at60 = 0
  for (let frame = 0; frame < 30; frame += 1) {
    at30 = stepMouthOpen(at30, 0.75, 1 / 30)
  }
  for (let frame = 0; frame < 60; frame += 1) {
    at60 = stepMouthOpen(at60, 0.75, 1 / 60)
  }
  assert.ok(Math.abs(at30 - at60) < 1e-12)
})

test('settles exactly and ignores unusable frame deltas', () => {
  assert.equal(stepMouthOpen(0.5, 0.5 + 1e-6, 1 / 60), 0.5 + 1e-6)
  assert.equal(stepMouthOpen(0.25, 1, Number.NaN), 0.25)
  assert.equal(stepMouthForm(0.25, 1, -1), 0.25)
})
