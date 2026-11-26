import type { Anime25DBodyDriving } from './driving'
import type { Anime25DMotionEnvelopeProfile } from './motionEnvelope'
import type { Anime25DRenderFrame } from './renderer'
import type { Anime25DPlayback } from './types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { Anime25DBodyFrames } from './bodyFrames'
import { IDENTITY_DRIVER } from './driver'
import { createHairChain } from './hairChain'
import { HAIR_CHAIN_LINKS } from './hairPhysics'

// A bust with no layers: face 100–220, neck's foot 270, body pivot 600.
const BUST = {
  layers: [],
  pixelCanvas: { width: 1000, height: 1000 },
  anchors: {
    face: { x0: 450, y0: 100, x1: 550, y1: 220, cx: 500, cy: 160 },
    neckPivot: { x: 500, y: 240 },
    neckTop: 220,
    neckBottom: 270,
    bodyPivot: { x: 500, y: 600 },
    mouth: { x0: 480, y0: 190, x1: 520, y1: 205, cx: 500, cy: 198 },
    faceScale: 1,
  },
  chestProfile: { enabled: false, centerX: 500, centerY: 360, radiusX: 80, radiusY: 60, supportScale: 0.5, garmentMotionScale: 0.5 },
  shellProfile: { enabled: false, blend: 0, torso: { enabled: false, blend: 0, centerX: 500, radiusX: 120, radiusZ: 90, neckDepth: 0.25 } },
  mouthProfile: { version: 1, source: 'bounds-fallback', silhouettes: [], bridges: [] },
} as unknown as Anime25DPlayback
const OPEN = { startsAt: 1, limit: 1 }
const ENVELOPE: Anime25DMotionEnvelopeProfile = { highCollar: false, armMotion: true, pitch: OPEN, torso: OPEN, rigidArm: OPEN, headTurn: OPEN, headTilt: OPEN }
const DRIVING: Anime25DBodyDriving = { directedBodyWeight: () => 0, jawBoost: 0, stickerFaceMotion: null, stickerFaceHeadShare: 0 }
const DT = 1 / 60

/** The body's breath-driven frame values each substep for `seconds`, the driver's `breathing` switched as `breathing(time)` says. */
function breaths(seconds: number, breathing: (time: number) => boolean) {
  const current = { ...IDENTITY_DRIVER, physics: false }
  const renderFrame = { viewWidth: 1000, viewHeight: 1000 } as Anime25DRenderFrame
  const body = new Anime25DBodyFrames(current, renderFrame, DRIVING)
  body.bind(body.measure(BUST, ENVELOPE))
  const out: { time: number, head: number, body: number, breath: number, lift: number }[] = []
  for (let step = 1; step <= Math.round(seconds / DT); step += 1) {
    const time = step * DT
    current.breathing = breathing(time)
    body.stepPosture(DT, time)
    body.updateSprings(DT, [], time)
    body.prepareHeadFrame(time)
    const frame = body.secondaryDeformationFrame
    out.push({ time, head: frame.headBreathOffset, body: frame.bodyBreathOffset, breath: frame.breath, lift: renderFrame.bodyLift!.amount })
  }
  return out
}

const spread = (values: readonly number[]) => Math.max(...values) - Math.min(...values)

test('the stage breathes every 3.4 seconds while `breathing` is on', () => {
  const frames = breaths(6.8, () => true)
  assert.ok(spread(frames.map(f => f.body)) > 1.5, 'the body rises and falls')
  assert.ok(spread(frames.map(f => f.head)) > 1.2, 'the head rises and falls')
  assert.ok(spread(frames.map(f => f.lift)) > 0, 'the torso lifts with it')
  const at = (time: number) => frames.find(f => Math.abs(f.time - time) < DT / 2)!
  assert.ok(Math.abs(at(1).body - at(4.4).body) < 1e-9, 'one breath later it is where it was')
})

test('with `breathing` off the breath eases to mid-breath and holds there', () => {
  const frames = breaths(12, time => time < 2)
  const held = frames.filter(f => f.time > 6)
  for (const key of ['head', 'body', 'breath'] as const)
    assert.equal(spread(held.map(f => f[key])), 0, `${key} holds still`)
  // The torso's lift is a spring: it settles toward still rather than stopping on a frame.
  assert.ok(spread(held.map(f => f.lift)) < 1e-6, `lift ${spread(held.map(f => f.lift))}`)
  assert.equal(held[0]!.body, 1)
  assert.equal(held[0]!.head, 0.8)
  // No jump where it is switched off: it eases there.
  const around = frames.filter(f => f.time > 1.9 && f.time < 2.6).map(f => f.body)
  for (let i = 1; i < around.length; i += 1)
    assert.ok(Math.abs(around[i]! - around[i - 1]!) < 0.05, `step ${i}: ${around[i - 1]} to ${around[i]}`)
})

test('switched back on, the breath eases in again', () => {
  const frames = breaths(14, time => time < 2 || time > 8)
  assert.ok(spread(frames.filter(f => f.time > 10).map(f => f.body)) > 1.5)
})

/** A front lock hanging 300 px from its root, as hair physics binds one. */
function lock() {
  return {
    lengthRatio: 1, supportX: 0, supportY: 0, rootX: 100, rootY: 50,
    chain: createHairChain(100, 50, 100, 350, HAIR_CHAIN_LINKS),
    phase: 0.3, amplitudeScale: 1, stiffnessScale: 1, dampingScale: 1,
  }
}

/** How far the torso's lift and a hanging lock's tip travel over seconds 4 to 10, with `patch` on the driver. */
function liftAndWind(patch: Partial<typeof IDENTITY_DRIVER>) {
  const current = { ...IDENTITY_DRIVER, talking: false, singing: false, ...patch }
  const renderFrame = { viewWidth: 1000, viewHeight: 1000 } as Anime25DRenderFrame
  const body = new Anime25DBodyFrames(current, renderFrame, DRIVING)
  body.bind(body.measure(BUST, ENVELOPE))
  const spring = lock()
  const layers = [{ frontHair: true, springs: [spring], secondaryDeformation: {} }] as never
  const lifts: number[] = []
  const tips: number[] = []
  for (let step = 1; step <= 600; step += 1) {
    const time = step * DT
    body.stepPosture(DT, time)
    body.updateSprings(DT, layers, time)
    body.prepareHeadFrame(time)
    if (time < 4) continue
    lifts.push(renderFrame.bodyLift!.amount)
    tips.push(spring.chain.offsetX[spring.chain.links]!)
  }
  return { lift: spread(lifts), wind: spread(tips) }
}

test('`torsoBreath` gates the torso\'s lift and `hairWind` the hair\'s wind, each alone', () => {
  const both = liftAndWind({})
  assert.ok(both.lift > 0.01 && both.wind > 0.5, JSON.stringify(both))
  const noLift = liftAndWind({ torsoBreath: false })
  assert.ok(noLift.lift < 1e-6, `lift ${noLift.lift}`)
  assert.ok(noLift.wind > 0.5, `wind ${noLift.wind}`)
  const noWind = liftAndWind({ hairWind: false })
  assert.equal(noWind.wind, 0)
  assert.ok(noWind.lift > 0.01, `lift ${noWind.lift}`)
  // Talking or singing lifts the torso with the breath whatever `torsoBreath` says.
  assert.ok(liftAndWind({ torsoBreath: false, talking: true }).lift > 0.01)
  assert.ok(liftAndWind({ torsoBreath: false, singing: true }).lift > 0.01)
})
