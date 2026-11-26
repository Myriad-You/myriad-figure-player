import type { Anime25DPose } from './pose'
import assert from 'node:assert/strict'
import test from 'node:test'
import { IDENTITY_DRIVER } from './driver'
import { blendPoses, poseFromJSON, poseToJSON } from './pose'

function poseOf(at: number, gesture = 'wave'): Anime25DPose {
  return {
    version: 1,
    figure: '2-abc',
    time: at,
    driver: { ...IDENTITY_DRIVER, headYaw: at, talking: at > 0.5 },
    frame: { viewWidth: 10, viewHeight: 20, bodyPivotX: at, bodyPivotY: 0, bodyRotationCosine: 1, bodyRotationSine: 0, bodyBendHeight: 0, time: at, eyeCry: 0 },
    order: Uint16Array.of(at > 0.5 ? 1 : 0, at > 0.5 ? 0 : 1),
    layers: [
      { transform: Float32Array.of(1, 0, 0, 0, 1, 0, at, 0, 1), opacity: at, multiply: null, behindFace: 0, vertices: Float32Array.of(0.1 + at, 1 / 3) },
      { transform: Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1), opacity: 1, multiply: Float32Array.of(1, 1, at), behindFace: 1, vertices: null },
    ],
    collar: null,
    mouth: { wide: at, round: 0, narrow: 0 },
    sticker: at > 0.5 ? { time: at, amount: 1, x: 0, y: 0, size: 1 } : null,
    arms: [{
      side: 'L',
      now: {
        gesture, twist: at, cuff: 1, radius: [1, 2 + at], restEnd: 1, ink: null,
        joints: { s: [0, 0, 0], e: [1, at, 0], w: [2, 0, at], hand: [[at, 0, 0]] },
        presence: 1, handRest: 0, hanging: 0, restNear: 0, unlined: 0, foot: [[at, 0]], sides: [-Infinity, 5 + at],
        held: null, rest: null, also: [{ gesture: 'wave', weight: at }, { gesture: 'point', weight: 0 }],
      },
      leaving: null,
      cloths: [{ nodes: Float32Array.of(at, 0), under: Uint16Array.of(0, 1, 2), front: Uint16Array.of() }, null],
    }],
  }
}

test('a pose is itself again from JSON, to the bit', () => {
  const pose = poseOf(0.7)
  pose.frame.bodyPivotY = -0
  assert.deepEqual(poseFromJSON(poseToJSON(pose)), pose)
  // The driver keeps the keys poses are written with.
  const { driver } = JSON.parse(poseToJSON(pose)) as { driver: Record<string, unknown> }
  assert.deepEqual(Object.keys(driver), Object.keys(pose.driver).map(key => ({ headYaw: 'angleX', headPitch: 'angleY', headRoll: 'angleZ', lidL: 'eyeOpenL', lidR: 'eyeOpenR', gazeX: 'eyeX', gazeY: 'eyeY', jaw: 'mouthOpen', lipCurve: 'mouthForm', browLift: 'brow', browTiltL: 'browAngL', browTiltR: 'browAngR', browTilt: 'browAngSym', bodyLean: 'body', torsoFollow: 'bodyYaw', rearHairSway: 'physAmp', torsoBreath: 'idle', physics: 'phys', idleSway: 'rand', autoBlink: 'blink', followPointer: 'mouse', talking: 'talk' } as Record<string, string>)[key] ?? key))
  assert.equal(driver.angleX, 0.7)
})

test('vertices that are a view of a longer buffer are written as their own', () => {
  const pose = poseOf(0.2)
  pose.arms[0]!.cloths[0]!.under = Uint16Array.of(9, 9, 0, 1, 2, 9).subarray(2, 5)
  assert.deepEqual(poseFromJSON(poseToJSON(pose)).arms[0]!.cloths[0]!.under, Uint16Array.of(0, 1, 2))
})

test('between two poses, numbers are between and what cannot be is the nearer one\'s', () => {
  const [a, b] = [poseOf(0), poseOf(1)]
  a.layers[0]!.opacity = 0.5
  const near = blendPoses(a, b, 0.25)
  assert.equal(near.time, 0.25)
  assert.equal(near.layers[0]!.transform[6], 0.25)
  assert.equal(near.layers[0]!.opacity, 0.625)
  assert.equal(near.layers[0]!.vertices![0], Math.fround(Math.fround(0.1) + (Math.fround(1.1) - Math.fround(0.1)) * 0.25))
  assert.deepEqual(near.order, a.order)
  assert.equal(near.sticker, null)
  assert.equal(near.driver.talking, false)
  const now = near.arms[0]!.now!
  assert.deepEqual(now.joints.w, [2, 0, 0.25])
  assert.deepEqual(now.sides, [-Infinity, 5.25])
  assert.equal(now.also![0]!.weight, 0.25)
  assert.deepEqual(near.arms[0]!.cloths[0]!.under, Uint16Array.of(0, 1, 2))
  const far = blendPoses(a, b, 0.75)
  assert.deepEqual(far.order, b.order)
  assert.deepEqual(far.sticker, b.sticker)
})

test('an arm between two gestures is in one picture or the other, and never between figures', () => {
  const [a, b] = [poseOf(0), poseOf(1, 'point')]
  assert.deepEqual(blendPoses(a, b, 0.25).arms[0]!.now, a.arms[0]!.now)
  assert.deepEqual(blendPoses(a, b, 0.75).arms[0]!.now, b.arms[0]!.now)
  const other = { ...b, figure: '2-def' }
  assert.equal(blendPoses(a, other, 0.25), a)
  assert.equal(blendPoses(a, other, 0.75), other)
})

test('a layer hidden in one of the two is the nearer one\'s, not halfway from where it was last seen', () => {
  const [a, b] = [poseOf(0), poseOf(1)]
  assert.equal(a.layers[0]!.opacity, 0)
  assert.deepEqual(blendPoses(a, b, 0.4).layers[0], a.layers[0])
  assert.deepEqual(blendPoses(a, b, 0.6).layers[0], b.layers[0])
})

test('at either end it is the pose itself, and neither is changed', () => {
  const [a, b] = [poseOf(0), poseOf(1)]
  blendPoses(a, b, 0.5)
  assert.deepEqual([a, b], [poseOf(0), poseOf(1)])
  assert.equal(blendPoses(a, b, 0), a)
  assert.equal(blendPoses(a, b, 1), b)
})

test('a pose written before the breath and the wind had switches of their own reads back whole', () => {
  // Written by the release before `breathing` and `hairWind`: `idle` held the wind as well.
  const text = '{"version":1,"figure":"2-abc","time":0.25,"driver":{"angleX":0.25,"angleY":0,"angleZ":0,"eyeOpenL":1,"eyeOpenR":1,"eyeDizzy":0,"eyeSqueeze":0,"eyeCry":0,"anger":0,"speechless":0,"accentNotes":0,"accentQuestion":0,"accentSleep":0,"accentSparkle":0,"accentBlush":0,"handWaveL":0,"handPointL":0,"handChestL":0,"handChinL":0,"handWaveR":0,"handPointR":0,"handChestR":0,"handChinR":0,"maniac":0,"silly":0,"lovestruck":0,"eyeX":0,"eyeY":0,"brow":0,"mouthOpen":0,"mouthWide":0,"mouthRound":0,"mouthNarrow":0,"mouthSeal":0,"mouthForm":0,"mouthCY":0,"body":0,"bodyYaw":1,"torsoTurn":0,"bodyLift":0,"bodyPitch":0,"physAmp":0.5,"soft":2,"browAngL":0,"browAngR":0,"browAngSym":0,"bangL":0,"bangC":0,"bangR":0,"armY":0,"armPos":0,"armRaiseL":0,"armRaiseR":0,"armSwingL":0,"armSwingR":0,"bust":2.5,"bustY":1,"irisScale":1,"eyeSmile":0,"eyeWide":0,"mouthEase":0.45,"eyeEase":0.3,"fhAmp":1,"fhSoft":0.4,"eyeCY":0,"eyeCAng":0,"mouthCAng":0,"eyeScaleL":1,"eyeScaleR":1,"mouthScale":1,"idle":false,"blink":true,"rand":false,"thinking":false,"singing":false,"talk":false,"mouse":true,"phys":false},"frame":{"viewWidth":10,"viewHeight":20,"bodyPivotX":0.25,"bodyPivotY":0,"bodyRotationCosine":1,"bodyRotationSine":0,"bodyBendHeight":0,"time":0.25,"eyeCry":0},"order":{"u16":"AAABAA=="},"layers":[{"transform":{"f32":"AACAPwAAAAAAAAAAAAAAAAAAgD8AAAAAAACAPgAAAAAAAIA/"},"opacity":1,"multiply":null,"behindFace":0,"vertices":{"f32":"AAAAP6uqqj4="}}],"collar":null,"mouth":null,"sticker":null,"arms":[]}'
  const pose = poseFromJSON(text)
  assert.deepEqual(pose.driver, {
    ...IDENTITY_DRIVER,
    headYaw: 0.25,
    torsoBreath: false,
    hairWind: false,
    breathing: true,
    idleSway: false,
    physics: false,
    talking: false,
    followPointer: true,
  })
  assert.deepEqual(Object.keys(pose.driver).sort(), Object.keys(IDENTITY_DRIVER).sort())
  assert.deepEqual(pose.layers[0]!.vertices, Float32Array.of(0.5, 1 / 3))
})
