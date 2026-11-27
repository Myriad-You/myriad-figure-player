import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FACE_PRESETS,
  faceLife,
  performanceContractIsComplete,
  performanceCuePriority,
  SCORE_TIMING,
} from './contract'
import { CUE_INTENTS } from './vocabulary'

test('defines one priority for every semantic performance cue', () => {
  assert.equal(performanceContractIsComplete(), true)
  assert.equal(
    new Set(CUE_INTENTS).size,
    CUE_INTENTS.length,
  )
  assert.equal(performanceCuePriority('respond'), 1)
  assert.equal(performanceCuePriority('speechless'), 2)
  assert.equal(performanceCuePriority('lovestruck'), 3)
})

test('every look the contract gives a life reads whole, beat by beat', () => {
  for (const [name, preset] of Object.entries(FACE_PRESETS)) {
    if (!preset.life) continue
    const life = faceLife(name)
    assert.ok(life, name)
    assert.equal(life.beats.length, preset.life.beats.length, name)
    assert.ok(life.periodMs >= 2000 && life.periodMs <= SCORE_TIMING.maxAtMs, name)
    for (const beat of life.beats) assert.ok(beat.atMs < life.periodMs, `${name} beat at ${beat.atMs}`)
  }
  assert.equal(faceLife(null), null)
  assert.equal(faceLife('cackling'), null)
})
