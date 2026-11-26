import type { Anime25DDriver } from './driver'
import assert from 'node:assert/strict'
import test from 'node:test'
import { Anime25DBasicDriving, measureAnime25DBasicFigure } from './basicDriving'
import { IDENTITY_DRIVER } from './driver'
import { BLINK_SECONDS } from './driverComposition'
import { idleBreathOffset } from './idleBreath'

const DT = 1 / 60

/** A small seeded generator, so a run's blinks repeat. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Runs the driving as the stage does, one substep a frame; returns `current` after each. */
function run(driving: Anime25DBasicDriving, seconds: number, from = 0): Anime25DDriver[] {
  const frames: Anime25DDriver[] = []
  const count = Math.round(seconds / DT)
  for (let frame = 1; frame <= count; frame += 1) {
    driving.step(DT, from + frame * DT)
    frames.push({ ...driving.shared.current })
  }
  return frames
}

/** Each blink as the frames it starts closing, shuts and is open again at. */
function blinks(frames: readonly Anime25DDriver[]): { start: number, shut: number, open: number }[] {
  const found: { start: number, shut: number, open: number }[] = []
  let start = -1
  let shut = -1
  frames.forEach((frame, index) => {
    if (start < 0 && frame.lidL < 0.999) start = index
    if (start >= 0 && shut < 0 && frame.lidL === 0) shut = index
    if (start >= 0 && frame.lidL >= 0.999) {
      found.push({ start, shut, open: index })
      start = -1
      shut = -1
    }
  })
  return found
}

test('lids shut and open again in a quarter of a second, every 1.6 to 5.4 seconds or as a double blink', () => {
  const driving = new Anime25DBasicDriving(seeded(7))
  const frames = run(driving, 60)
  const found = blinks(frames)
  assert.ok(found.length >= 10, `${found.length} blinks in a minute`)
  // The first comes once 1.8 seconds have passed.
  assert.ok(Math.abs(found[0].start * DT - 1.8) <= 2 * DT, `first at ${found[0].start * DT}`)
  for (const blink of found) {
    assert.ok(blink.shut > blink.start, 'every blink shuts the lids')
    assert.ok((blink.shut - blink.start) * DT <= 0.07 + 2 * DT, `shut after ${(blink.shut - blink.start) * DT}`)
    assert.ok((blink.open - blink.start) * DT <= BLINK_SECONDS + 2 * DT, `open after ${(blink.open - blink.start) * DT}`)
  }
  for (let index = 1; index < found.length; index += 1) {
    const gap = (found[index].start - found[index - 1].start) * DT
    const double = Math.abs(gap - (BLINK_SECONDS + 0.12)) <= 2 * DT
    assert.ok(double || (gap >= 1.6 - 2 * DT && gap <= 5.4 + 2 * DT), `blinks ${gap}s apart`)
  }
  // Both eyes blink together.
  assert.ok(frames.every(frame => frame.lidL === frame.lidR))
})

test('the same seed blinks the same; another seed differently', () => {
  const a = run(new Anime25DBasicDriving(seeded(42)), 30)
  const b = run(new Anime25DBasicDriving(seeded(42)), 30)
  const c = run(new Anime25DBasicDriving(seeded(43)), 30)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a.map(frame => frame.lidL), c.map(frame => frame.lidL))
})

test('the head and body follow the idle breath, bounded, while `rand` is on', () => {
  const driving = new Anime25DBasicDriving(seeded(1))
  driving.set({ blink: false })
  const frames = run(driving, 120)
  let largest = 0
  frames.forEach((frame, index) => {
    const time = (index + 1) * DT
    const breath = idleBreathOffset(time)
    assert.ok(Math.abs(frame.headYaw) <= 0.18 + 1e-9 && Math.abs(frame.bodyLean) <= 0.16 + 1e-9, `at ${time}`)
    largest = Math.max(largest, Math.abs(frame.headYaw))
    if (time < 2) return
    for (const [key, channel] of [['headYaw', 'angleX'], ['headPitch', 'angleY'], ['headRoll', 'angleZ'], ['bodyLean', 'body']] as const)
      assert.ok(Math.abs(frame[key] - breath[channel]) < 0.005, `${key} ${frame[key]} vs ${breath[channel]} at ${time}`)
  })
  assert.ok(largest > 0.1, `breath reaches ${largest}`)
  // The same breath, a minute on, is where the breath function is: it depends on time alone.
  const later = run(driving, 1, 120).at(-1)!
  assert.ok(Math.abs(later.headRoll - idleBreathOffset(121).angleZ) < 0.005)
})

test('with breath and blinks off, current settles on target and stays', () => {
  const driving = new Anime25DBasicDriving(seeded(3))
  const ask: Partial<Anime25DDriver> = {
    rand: false,
    blink: false,
    idle: false,
    headYaw: 0.4,
    headPitch: -0.2,
    bodyLean: 0.3,
    gazeX: -0.5,
    lidL: 0.7,
    lidR: 0.6,
    jaw: 0.5,
    lipCurve: 0.3,
    browLift: 0.25,
    eyeSmile: 0.4,
  }
  driving.set(ask)
  const settled = run(driving, 5).at(-1)!
  const keys = Object.keys(IDENTITY_DRIVER) as (keyof Anime25DDriver)[]
  for (const key of keys) {
    const want = driving.target[key]
    const got = settled[key]
    if (typeof want === 'number') assert.ok(Math.abs((got as number) - want) < 1e-6, `${key}: ${got} vs ${want}`)
    else assert.equal(got, want, key)
  }
  const after = run(driving, 20, 5)
  for (const frame of after) {
    for (const key of keys) {
      const want = driving.target[key]
      if (typeof want === 'number') assert.ok(Math.abs((frame[key] as number) - want) < 1e-6, key)
    }
  }
})

test('blinks stop when `blink` is off, and a blink under way finishes', () => {
  const driving = new Anime25DBasicDriving(seeded(5))
  const before = run(driving, 1.8 + 3 * DT)
  assert.ok(before.at(-1)!.lidL < 1, 'blinking')
  driving.set({ blink: false })
  const after = run(driving, 20, 1.8 + 3 * DT)
  assert.ok(after.slice(0, 3).every(frame => frame.lidL < 1), 'does not spring open')
  const settled = after.slice(Math.ceil(BLINK_SECONDS / DT))
  assert.ok(settled.every(frame => frame.lidL === 1 && frame.lidR === 1))
})

test('a sticker face holds the blink back', () => {
  const driving = new Anime25DBasicDriving(seeded(9))
  driving.set({ maniac: 1 })
  assert.ok(run(driving, 20).every(frame => frame.lidL >= 0.999))
})

test('nothing performs: the neutral answers to the stage', () => {
  const driving = new Anime25DBasicDriving()
  for (const control of ['torsoTurn', 'torsoRise', 'torsoPitch', 'leftArmRaise', 'rightArmRaise', 'leftArmSwing', 'rightArmSwing'] as const)
    assert.equal(driving.directedBodyWeight(control), 0)
  assert.equal(driving.jawEmphasis, 0)
  assert.equal(driving.stylizedMotion, null)
  assert.equal(driving.stylizedHeadShare, 0.25)
  assert.equal(driving.sillyMouthShare, 1)
  run(driving, 3)
  assert.equal(driving.thinkingLevel(), 0)
  assert.deepEqual(driving.measureCapabilities(undefined, { torsoVolume: true, arms: ['L', 'R'] }), [])
  driving.bindCapabilities(['head-body'])
  driving.drawn()
  driving.frame({ dropped: true })
})

test('set() bounds what it is given and drops what is not a value', () => {
  const driving = new Anime25DBasicDriving()
  driving.set({ headYaw: 5, lidL: Number.NaN, jaw: -1, blink: 'no' as unknown as boolean })
  assert.equal(driving.target.headYaw, 1)
  assert.equal(driving.target.lidL, 1)
  assert.equal(driving.target.jaw, 0)
  assert.equal(driving.target.blink, true)
})

test('the pointer leads head and eyes only while `mouse` is on, and lets go gently', () => {
  const driving = new Anime25DBasicDriving(seeded(2))
  driving.set({ blink: false, rand: false })
  driving.setPointer(1, -1, true)
  assert.equal(run(driving, 2).at(-1)!.headYaw, 0)
  driving.set({ mouse: true })
  const led = run(driving, 2, 2).at(-1)!
  assert.ok(Math.abs(led.headYaw - 0.9) < 1e-3, `${led.headYaw}`)
  assert.ok(Math.abs(led.headPitch - 0.7) < 1e-3, `${led.headPitch}`)
  assert.ok(Math.abs(led.gazeX - 1) < 1e-3, `${led.gazeX}`)
  driving.setPointer(0, 0, false)
  const leaving = run(driving, 2, 4)
  assert.ok(leaving[0].headYaw > 0.85, 'does not drop')
  assert.ok(Math.abs(leaving.at(-1)!.headYaw) < 1e-3)
})

test('a standing figure is measured as one; a bust is not', () => {
  const anchors = (groundY?: number) => ({ groundY }) as unknown as Parameters<typeof measureAnime25DBasicFigure>[0]['anchors']
  assert.deepEqual(measureAnime25DBasicFigure({ anchors: anchors(900) }), { standing: true, headRidesBody: 0 })
  assert.deepEqual(measureAnime25DBasicFigure({ anchors: anchors() }), { standing: false, headRidesBody: 0 })
})

test('a bound standing figure breathes at its idle share and shifts its weight', () => {
  const bust = new Anime25DBasicDriving(seeded(4))
  const figure = new Anime25DBasicDriving(seeded(4))
  bust.set({ blink: false })
  figure.set({ blink: false })
  const open = { startsAt: 1, limit: 1 }
  figure.bind({ standing: true, headRidesBody: 0 }, { highCollar: false, armMotion: true, pitch: open, torso: open, rigidArm: open, headTurn: open, headTilt: open })
  const a = run(bust, 30)
  const b = run(figure, 30)
  assert.ok(a.some((frame, index) => Math.abs(frame.bodyLean - b[index].bodyLean) > 0.01))
  assert.ok(b.every(frame => Math.abs(frame.bodyLean) <= 1))
  assert.deepEqual(a.map(frame => frame.headYaw), b.map(frame => frame.headYaw))
})

test('nothing talks: talk starts off, so turning idle off stills the torso\'s breath', () => {
  const driving = new Anime25DBasicDriving(seeded(3))
  assert.equal(driving.target.talk, false)
  assert.equal(driving.shared.current.talk, false)
  driving.set({ idle: false })
  run(driving, 1)
  assert.equal(driving.shared.current.talk, false)
  assert.equal(driving.shared.current.idle, false)
})
