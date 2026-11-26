import type { PoseCorrection, PoseCorrectionV7 } from './poseCorrections'
import assert from 'node:assert/strict'
import test from 'node:test'
import { IDENTITY_DRIVER } from './driver'
import {
  applyPoseCorrections,
  bindPoseCorrections,
  isPoseCorrections,
  isPoseCorrectionsV7,
  poseCorrectionsFromV7,
  poseCorrectionsToV7,
  writePoseCorrectionWeights,
} from './poseCorrections'

const head = {
  centerX: 300,
  centerY: 250,
  radiusX: 160,
  radiusY: 200,
  radiusZ: 100,
}
const correction: PoseCorrection = {
  surface: 'head',
  at: { headYaw: 0.8, headPitch: -0.6 },
  patches: [{ x: 0, y: 0, radiusX: 0.6, radiusY: 0.4, dx: 0.05, dy: -0.04 }],
}
const rest = new Float32Array([300, 250, 320, 270, 650, 800])

function sample(yaw: number, pitch: number) {
  const bound = bindPoseCorrections([correction], 'head', rest, head)!
  writePoseCorrectionWeights(bound, { ...IDENTITY_DRIVER, headYaw: yaw, headPitch: pitch })
  const result = { x: 300, y: 250 }
  applyPoseCorrections(result, 0, bound)
  return result
}

test('combination residual preserves neutral, both single axes and opposite quadrants exactly', () => {
  for (const [x, y] of [
    [0, 0],
    [0.8, 0],
    [0, -0.6],
    [-0.8, -0.6],
    [0.8, 0.6],
  ]) {
    assert.deepEqual(sample(x, y), { x: 300, y: 250 })
  }
  assert.deepEqual(sample(0.8, -0.6), { x: 308, y: 242 })
  assert.deepEqual(
    sample(1, -1),
    sample(0.8, -0.6),
    'no extrapolation beyond the authored corner',
  )
})

test('local brushes leave distant vertices and other surfaces untouched', () => {
  const bound = bindPoseCorrections([correction], 'head', rest, head)!
  writePoseCorrectionWeights(bound, {
    ...IDENTITY_DRIVER,
    headYaw: 0.8,
    headPitch: -0.6,
  })
  const point = { x: rest[4], y: rest[5] }
  applyPoseCorrections(point, 2, bound)
  assert.deepEqual(point, { x: 650, y: 800 })
  assert.equal(bindPoseCorrections([correction], null, rest, head), undefined)
  assert.equal(
    bindPoseCorrections([correction], 'back-hair', rest, head),
    undefined,
  )
  assert.equal(bindPoseCorrections(undefined, 'head', rest, head), undefined)
})

test('closure combinations use continuous final eye aperture, not expression names', () => {
  const bound = bindPoseCorrections(
    [{ ...correction, at: { headYaw: 0.8, lidCloseL: 1 } }],
    'head',
    rest,
    head,
  )!
  const weights = []
  for (const lid of [1, 0.75, 0.5, 0.25, 0]) {
    writePoseCorrectionWeights(bound, {
      ...IDENTITY_DRIVER,
      headYaw: 0.8,
      lidL: lid,
    })
    weights.push(bound[0].weight)
  }
  assert.deepEqual(weights, [0, 0.15625, 0.5, 0.84375, 1])
})

test('weights and spatial influence have no boundary slope jump', () => {
  const h = 1e-5
  assert.ok(Math.abs((sample(h, -0.6).x - sample(0, -0.6).x) / h) < 0.001)
  assert.ok(
    Math.abs((sample(0.8, -0.6).x - sample(0.8 - h, -0.6).x) / h) < 0.001,
  )
  const border = head.centerX + correction.patches[0].radiusX * head.radiusX
  const bound = bindPoseCorrections(
    [correction],
    'head',
    new Float32Array([border - 0.01, 250, border, 250]),
    head,
  )!
  assert.ok(Math.abs(bound[0].offsets[0] / 0.01) < 1e-6)
  assert.equal(bound[0].offsets[2], 0)
})

test('30/60/120 fps and interrupted/repeated poses have no history or additional delay', () => {
  for (const fps of [30, 60, 120]) {
    const bound = bindPoseCorrections([correction], 'head', rest, head)!
    for (let frame = 0; frame <= fps; frame++) {
      const yaw = Math.sin((frame / fps) * 2)
      const pitch = -Math.cos(frame / fps)
      writePoseCorrectionWeights(bound, { ...IDENTITY_DRIVER, headYaw: yaw, headPitch: pitch })
      const point = { x: 300, y: 250 }
      applyPoseCorrections(point, 0, bound)
      assert.deepEqual(point, sample(yaw, pitch))
    }
    writePoseCorrectionWeights(bound, IDENTITY_DRIVER)
    assert.equal(bound[0].weight, 0)
  }
})

test('rejects malformed, unbounded, single-axis and duplicate-corner data', () => {
  assert.equal(isPoseCorrections([]), true)
  assert.equal(isPoseCorrections([correction]), true)
  for (const bad of [
    null,
    {},
    [null],
    Array.from({ length: 17 }).fill(correction),
    [{ ...correction, at: { headYaw: 0.8 } }],
    [{ ...correction, at: { headYaw: 0, headPitch: 0.6 } }],
    [{ ...correction, at: { headYaw: 0.6, lidCloseL: -1 } }],
    [{ ...correction, at: { lidCloseL: 1, jaw: 1 } }],
    [{ ...correction, at: { headYaw: 0.6, body: 1 } }],
    [{ ...correction, at: { headYaw: Infinity, headPitch: 0.6 } }],
    [{ ...correction, patches: [] }],
    [{ ...correction, patches: [null] }],
    [{ ...correction, patches: [{ ...correction.patches[0], radiusX: 0 }] }],
    [{ ...correction, patches: [{ ...correction.patches[0], dx: 0.3 }] }],
    [correction, { ...correction, at: { headPitch: -1, headYaw: 1 } }],
  ])
    assert.equal(isPoseCorrections(bad), false, JSON.stringify(bad))
})

const V7: PoseCorrectionV7[] = [
  { surface: 'head', at: { angleX: 0.8, angleY: -0.6 }, patches: correction.patches },
  { surface: 'front-hair', at: { angleY: 0.5, eyeCloseR: 1, mouthOpen: 0.4 }, patches: correction.patches },
  { surface: 'head', at: { eyeCloseL: 0.9, angleX: -0.7 }, patches: correction.patches },
]

test('version 7 keys are its own: each axis renamed in its place, and nothing else', () => {
  const read = poseCorrectionsFromV7(V7)
  assert.deepEqual(read, [
    { surface: 'head', at: { headYaw: 0.8, headPitch: -0.6 }, patches: correction.patches },
    { surface: 'front-hair', at: { headPitch: 0.5, lidCloseR: 1, jaw: 0.4 }, patches: correction.patches },
    { surface: 'head', at: { lidCloseL: 0.9, headYaw: -0.7 }, patches: correction.patches },
  ])
  assert.deepEqual(read.map(c => Object.keys(c.at)), V7.map(c => Object.keys(c.at).map(k => ({ angleX: 'headYaw', angleY: 'headPitch', eyeCloseL: 'lidCloseL', eyeCloseR: 'lidCloseR', mouthOpen: 'jaw' } as Record<string, string>)[k])))
  assert.deepEqual(poseCorrectionsToV7(read), V7)
  assert.equal(isPoseCorrectionsV7(V7), true)
  assert.equal(isPoseCorrections(read), true)
})

test('each vocabulary is checked as its own: neither reads the other\'s keys, nor a mix', () => {
  assert.equal(isPoseCorrections(V7), false)
  assert.equal(isPoseCorrectionsV7(poseCorrectionsFromV7(V7)), false)
  assert.equal(isPoseCorrectionsV7([{ ...correction, at: { angleX: 0.8, headPitch: -0.6 } }]), false)
  assert.equal(isPoseCorrections([{ ...correction, at: { angleX: 0.8, headPitch: -0.6 } }]), false)
  assert.equal(isPoseCorrectionsV7([{ ...correction, at: { angleX: 0.8 } }]), false)
  assert.equal(isPoseCorrectionsV7([V7[0], { ...V7[0], at: { angleY: -1, angleX: 1 } }]), false)
})

test('corrections read from version 7 move the mesh as the same written now', () => {
  const vertices = new Float32Array([300, 250, 320, 270, 280, 230, 650, 800])
  const weights = (corrections: PoseCorrection[]) => {
    const bound = bindPoseCorrections(corrections, 'head', vertices, head)!
    writePoseCorrectionWeights(bound, { ...IDENTITY_DRIVER, headYaw: 0.5, headPitch: -0.4, lidL: 0.2, jaw: 0.3 })
    return bound
  }
  assert.deepEqual(weights(poseCorrectionsFromV7(V7)), weights([
    { surface: 'head', at: { headYaw: 0.8, headPitch: -0.6 }, patches: correction.patches },
    { surface: 'front-hair', at: { headPitch: 0.5, lidCloseR: 1, jaw: 0.4 }, patches: correction.patches },
    { surface: 'head', at: { lidCloseL: 0.9, headYaw: -0.7 }, patches: correction.patches },
  ]))
})
