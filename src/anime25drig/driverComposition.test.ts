import type { Anime25DDriver } from './driver'
import assert from 'node:assert/strict'
import test from 'node:test'
import { IDENTITY_DRIVER } from './driver'
import {
  applyAnime25DStickerMouthShare,
  BLINK_SECONDS,
  prepareAnime25DWorkingTarget,
  resolveAnime25DStickerTargets,
  stepAnime25DBlink,
  stepAnime25DDriverResponse,
} from './driverComposition'
import {
  stepMouthForm,
  stepMouthOpen,
  stepMouthSeal,
  stepMouthShape,
} from './mouthResponse'
import { isContinuousPoseKey, PoseResponseController } from './poseResponse'

test('working target preparation reuses its output and preserves the pointer math', () => {
  const authored: Anime25DDriver = {
    ...IDENTITY_DRIVER,
    headYaw: 0.2,
    headPitch: -0.1,
    headRoll: 0.15,
    gazeX: 0.1,
    gazeY: -0.2,
    bodyLean: 0.25,
    followPointer: true,
    torsoBreath: true,
  }
  const output = { ...IDENTITY_DRIVER }
  const actual = prepareAnime25DWorkingTarget(
    output,
    authored,
    { x: 0.46, y: -0.33, inside: true },
    1,
  )

  assert.equal(actual, output)
  assert.equal(actual.headYaw, 0.46 * 0.9)
  assert.equal(actual.headPitch, 0.33 * 0.7)
  assert.equal(actual.headRoll, 0.15)
  assert.equal(actual.gazeX, 0.46 * 1.2)
  assert.equal(actual.gazeY, 0.33 * 0.8)
  assert.equal(actual.bodyLean, 0.25)
})

test('pointer gaze is a weight, so leaving eases off instead of dropping', () => {
  const authored: Anime25DDriver = {
    ...IDENTITY_DRIVER,
    headYaw: -0.2,
    headPitch: 0.1,
    gazeX: 0.05,
    gazeY: -0.05,
    followPointer: true,
  }
  const pointer = { x: 0.46, y: -0.33, inside: true }
  const at = (authority: number) =>
    prepareAnime25DWorkingTarget({ ...IDENTITY_DRIVER }, authored, pointer, authority)

  const held = at(1)
  const half = at(0.5)
  const released = at(0)
  assert.equal(released.headYaw, authored.headYaw)
  assert.equal(released.gazeY, authored.gazeY)
  assert.ok(
    Math.abs(half.headYaw - (authored.headYaw + held.headYaw) / 2) < 1e-12,
  )
  assert.ok(Math.abs(half.gazeX - (authored.gazeX + held.gazeX) / 2) < 1e-12)
  const ignored = prepareAnime25DWorkingTarget(
    { ...IDENTITY_DRIVER },
    { ...authored, followPointer: false },
    pointer,
    1,
  )
  assert.equal(ignored.headYaw, authored.headYaw)
})

test('a blink shuts fast, stays shut a moment and opens a little slower', () => {
  const state = { activeSeconds: -1, nextAtSeconds: 0 }
  const lids: number[] = []
  for (let frame = 0; frame < 60; frame += 1) {
    const target = { ...IDENTITY_DRIVER }
    stepAnime25DBlink(target, state, (frame + 1) / 120, 1 / 120, true, false, () => 0.5)
    lids.push(target.lidL)
  }
  const shutFrom = lids.findIndex((open) => open === 0)
  const shutUntil = lids.findLastIndex((open) => open === 0)
  const openedAt = lids.findIndex((open, index) => index > shutUntil && open === 1)
  // Closing and holding take a little over a tenth of a second; the whole blink about a quarter.
  assert.ok(shutFrom >= 7 && shutFrom <= 9, `shut at ${shutFrom}`)
  assert.ok(shutUntil - shutFrom >= 3 && shutUntil - shutFrom <= 6, `held ${shutUntil - shutFrom}`)
  assert.ok(Math.abs(openedAt / 120 - BLINK_SECONDS) < 0.02, `opened at ${openedAt / 120}`)
  // The lid drops gathering speed and lifts quick at first.
  assert.ok(1 - lids[1] < lids[3] - lids[5], `${lids.slice(0, 8)}`)
  const lift = lids.slice(shutUntil + 1, openedAt)
  assert.ok(lift[1] - lift[0] > lift.at(-1)! - lift.at(-2)!, `${lift}`)
})

test('a double blink leaves the eye open a moment between the two', () => {
  const state = { activeSeconds: -1, nextAtSeconds: 0 }
  // The second draw chooses the double blink.
  const draws = [0.5, 0.1, 0.5, 0.9]
  let draw = 0
  const random = () => draws[draw++ % draws.length]
  const lids: number[] = []
  for (let frame = 0; frame < 120; frame += 1) {
    const target = { ...IDENTITY_DRIVER }
    stepAnime25DBlink(target, state, (frame + 1) / 120, 1 / 120, true, false, random)
    lids.push(target.lidL)
  }
  let closures = 0
  let openRun = 0
  let longestGap = 0
  for (let index = 1; index < lids.length; index += 1) {
    if (lids[index] === 0 && lids[index - 1] > 0) closures += 1
    if (closures === 1 && lids[index] === 1) openRun += 1
    if (closures === 1 && lids[index] < 1) {
      longestGap = Math.max(longestGap, openRun)
      openRun = 0
    }
  }
  assert.equal(closures, 2)
  assert.ok(longestGap / 120 >= 0.08, `open between blinks ${longestGap / 120}`)
})

test('new pose response leaves mouth, expression, blink and physics flags unchanged', () => {
  const actual = { ...IDENTITY_DRIVER }
  const expected = { ...IDENTITY_DRIVER }
  const authored = { ...IDENTITY_DRIVER }
  const target = { ...IDENTITY_DRIVER }
  const expectedSecondary = { headYaw: 0, headPitch: 0, headRoll: 0, bodyLean: 0 }
  const secondaryTarget = { ...expectedSecondary }
  const response = new PoseResponseController()
  const keys = Object.keys(IDENTITY_DRIVER) as Array<keyof Anime25DDriver>

  for (let frame = 0; frame < 180; frame += 1) {
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      if (typeof target[key] === 'boolean') {
        continue
      }
      ;(target as unknown as Record<string, number>)[key] =
        Math.sin(frame * 0.073 + index * 0.41) * 0.72
    }
    target.lidL = (Math.sin(frame * 0.09) + 1) * 0.5
    target.lidR = (Math.cos(frame * 0.11) + 1) * 0.5
    target.irisScale = 0.9 + Math.sin(frame * 0.03) * 0.2
    target.mouthScale = 1 + Math.cos(frame * 0.05) * 0.25
    authored.torsoBreath = frame % 2 === 0
    authored.autoBlink = frame % 3 !== 0
    authored.idleSway = frame % 5 !== 0
    authored.thinking = frame % 7 === 0
    authored.singing = frame % 11 === 0
    authored.talking = frame % 13 !== 0
    authored.followPointer = frame % 17 === 0
    authored.physics = frame % 19 !== 0
    authored.breathing = frame % 29 !== 0
    authored.hairWind = frame % 31 === 0
    secondaryTarget.headYaw = Math.sin(frame * 0.04)
    secondaryTarget.headPitch = Math.cos(frame * 0.05)
    secondaryTarget.headRoll = Math.sin(frame * 0.06 + 0.4)
    secondaryTarget.bodyLean = Math.cos(frame * 0.03 + 0.7)
    const dt = frame % 23 === 0 ? 1 / 30 : 1 / 60

    stepAnime25DDriverResponse(actual, authored, target, response, dt)
    referenceStepDriverResponse(
      expected,
      authored,
      target,
      expectedSecondary,
      secondaryTarget,
      dt,
    )
    for (const key of keys) {
      if (!isContinuousPoseKey(key))
        assert.equal(actual[key], expected[key], `${key} at frame ${frame}`)
    }
  }
})

function referenceStepDriverResponse(
  current: Anime25DDriver,
  authored: Readonly<Anime25DDriver>,
  target: Readonly<Anime25DDriver>,
  secondaryCurrent: {
    headYaw: number
    headPitch: number
    headRoll: number
    bodyLean: number
  },
  secondaryTarget: Readonly<{
    headYaw: number
    headPitch: number
    headRoll: number
    bodyLean: number
  }>,
  dt: number,
): void {
  const rate = Math.min(1, dt * 14)
  const flags = [
    'breathing',
    'torsoBreath',
    'hairWind',
    'physics',
    'idleSway',
    'autoBlink',
    'followPointer',
    'thinking',
    'singing',
    'talking',
  ] as const
  for (const key of Object.keys(IDENTITY_DRIVER) as Array<
    keyof Anime25DDriver
  >) {
    if (flags.includes(key as (typeof flags)[number])) {
      current[key] = authored[key] as never
      continue
    }
    const from = current[key] as number
    const to = target[key] as number
    if (key === 'jaw') {
      current.jaw = stepMouthOpen(from, to, dt)
    } else if (key === 'lipCurve') {
      current.lipCurve = stepMouthForm(from, to, dt)
    } else if (key === 'mouthSeal') {
      current.mouthSeal = stepMouthSeal(from, to, dt)
    } else if (
      key === 'mouthWide' ||
      key === 'mouthRound' ||
      key === 'mouthNarrow'
    ) {
      current[key] = stepMouthShape(from, to, dt)
    } else if (key === 'eyeCry') {
      const response = to > from ? 6 : 4.5
      current.eyeCry = from + (to - from) * (1 - Math.exp(-response * dt))
    } else if (key === 'maniac') {
      const response = to > from ? 7.2 : 4.4
      current.maniac = from + (to - from) * (1 - Math.exp(-response * dt))
    } else if (key === 'silly') {
      const response = to > from ? 7 : 4.2
      current.silly = from + (to - from) * (1 - Math.exp(-response * dt))
    } else if (key === 'lovestruck') {
      const response = to > from ? 6.6 : 3.8
      current.lovestruck = from + (to - from) * (1 - Math.exp(-response * dt))
    } else {
      ;(current[key] as number) = from + (to - from) * rate
    }
  }
  secondaryCurrent.headYaw +=
    (secondaryTarget.headYaw - secondaryCurrent.headYaw) * rate
  secondaryCurrent.headPitch +=
    (secondaryTarget.headPitch - secondaryCurrent.headPitch) * rate
  secondaryCurrent.headRoll +=
    (secondaryTarget.headRoll - secondaryCurrent.headRoll) * rate
  secondaryCurrent.bodyLean += (secondaryTarget.bodyLean - secondaryCurrent.bodyLean) * rate
}

test('an interrupted blink finishes instead of springing open', () => {
  for (const interruption of ['suppressed', 'disabled'] as const) {
    const state = { activeSeconds: -1, nextAtSeconds: 0 }
    const random = () => 0.5
    const lid = (time: number, enabled: boolean, suppressed: boolean) => {
      const target = { ...IDENTITY_DRIVER, lidL: 1, lidR: 1 }
      stepAnime25DBlink(target, state, time, 1 / 60, enabled, suppressed, random)
      return target.lidL
    }
    let time = 1 / 60
    lid(time, true, false)
    for (let frame = 0; frame < 4; frame += 1) {
      time += 1 / 60
      lid(time, true, false)
    }
    const shut = lid(time, true, false)
    assert.ok(shut < 0.2, `${interruption}: expected shut lids, got ${shut}`)

    time += 1 / 60
    const interrupted = lid(
      time,
      interruption !== 'disabled',
      interruption === 'suppressed',
    )
    assert.ok(
      interrupted < 0.2,
      `${interruption}: lids sprang to ${interrupted} mid-blink`,
    )

    for (let frame = 0; frame < 60; frame += 1) {
      time += 1 / 60
      lid(time, interruption !== 'disabled', interruption === 'suppressed')
    }
    assert.equal(state.activeSeconds, -1)
    assert.equal(
      lid(time, interruption !== 'disabled', interruption === 'suppressed'),
      1,
    )
  }
})

test('special eyes hold the sticker faces back', () => {
  const output = { anger: 0, speechless: 0, maniac: 0, silly: 0, lovestruck: 0 }
  const resolved = resolveAnime25DStickerTargets(output, { ...IDENTITY_DRIVER, maniac: 1, silly: 2 })
  assert.equal(resolved, output)
  assert.deepEqual(resolved, { anger: 0, speechless: 0, maniac: 1, silly: 1, lovestruck: 0 })
  resolveAnime25DStickerTargets(output, { ...IDENTITY_DRIVER, maniac: 1, eyeCry: 0.75 })
  assert.equal(output.maniac, 0.25)
  resolveAnime25DStickerTargets(output, { ...IDENTITY_DRIVER, maniac: 1, eyeDizzy: 1 })
  assert.equal(output.maniac, 0)
})

test('silly mouth ownership only attenuates owned speech channels', () => {
  const target: Anime25DDriver = {
    ...IDENTITY_DRIVER,
    jaw: 0.8,
    mouthWide: 0.6,
    mouthRound: 0.4,
    mouthNarrow: 0.2,
    mouthSeal: 0.1,
    lipCurve: -0.3,
    mouthCY: 0.25,
  }
  applyAnime25DStickerMouthShare(target, 0.75)
  assert.deepEqual(
    {
      jaw: target.jaw,
      mouthWide: target.mouthWide,
      mouthRound: target.mouthRound,
      mouthNarrow: target.mouthNarrow,
      mouthSeal: target.mouthSeal,
      lipCurve: target.lipCurve,
      mouthCY: target.mouthCY,
    },
    {
      jaw: 0.2,
      mouthWide: 0.15,
      mouthRound: 0.1,
      mouthNarrow: 0.05,
      mouthSeal: 0.025,
      lipCurve: -0.3,
      mouthCY: 0.25,
    },
  )
})
