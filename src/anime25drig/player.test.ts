import type { Anime25DDriver } from './driver'
import type { SpeechMouthMaterial } from './mouthTransition'
import type { Anime25DPlaybackLayer } from './types'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_FRONT_HAIR_SWAY,
  DEFAULT_REAR_HAIR_SWAY,
  IDENTITY_DRIVER,
  sanitizeDriverPatch,
  WORKBENCH_DRIVER,
} from './driver'
import {
  compileAnime25DMouthMorphSources,
  createAnime25DOpacityFrame,
  fadeOpacityFromFrame,
  resolveMouthMorph,
  shouldDeformLayer,
  writeAnime25DOpacityFrame,
} from './mouthRuntime'

test('uses restrained front and rear hair sway defaults', () => {
  assert.equal(DEFAULT_FRONT_HAIR_SWAY, 1)
  assert.equal(DEFAULT_REAR_HAIR_SWAY, 0.5)
  assert.equal(IDENTITY_DRIVER.fhAmp, 1)
  assert.equal(IDENTITY_DRIVER.rearHairSway, 0.5)
})

test('skips invisible expression uploads while preserving authored eye-white state', () => {
  assert.equal(shouldDeformLayer({ name: 'eye-dizzy-left' }, 0), false)
  assert.equal(shouldDeformLayer({ name: 'mouth-maniac' }, 0.003), false)
  assert.equal(shouldDeformLayer({ name: 'eye-dizzy-left' }, 0.004), true)
  assert.equal(shouldDeformLayer({ name: 'eyewhite-left' }, 0), true)
})

test('a portrait comes around with its head fully until told otherwise', () => {
  assert.equal(IDENTITY_DRIVER.torsoFollow, 1)
  assert.equal(WORKBENCH_DRIVER.torsoFollow, 1)
  assert.equal(sanitizeDriverPatch({ torsoFollow: 4 }).torsoFollow, 1)
  assert.equal(sanitizeDriverPatch({ torsoFollow: -1 }).torsoFollow, 0)
  assert.equal(sanitizeDriverPatch({ torsoFollow: 0.4 }).torsoFollow, 0.4)
})

test('clamps all external driver writes at the runtime boundary', () => {
  const patch = sanitizeDriverPatch({
    headYaw: 99,
    jaw: -2,
    armPos: 8,
    bust: Number.NaN,
    talking: true,
  })
  assert.equal(patch.headYaw, 1)
  assert.equal(patch.jaw, 0)
  assert.equal(patch.armPos, 1)
  assert.equal(patch.bust, undefined)
  assert.equal(patch.talking, true)
})

test('precompiled mouth sources retain the first authored variant', () => {
  const closed = {
    fade: 'mouthClose',
    name: 'closed-first',
  } as Anime25DPlaybackLayer
  const duplicate = {
    fade: 'mouthClose',
    name: 'closed-second',
  } as Anime25DPlaybackLayer
  const ordinary = {
    fade: 'mouthOpen',
    name: 'ordinary',
  } as Anime25DPlaybackLayer
  const sources = compileAnime25DMouthMorphSources([
    closed,
    duplicate,
    ordinary,
  ])

  assert.equal(sources.closed, closed)
  assert.equal(sources.ordinary, ordinary)
  assert.equal(sources.wide, undefined)
})

test('a speaking mouth opens from a parted slit instead of popping to full height', () => {
  // A smiling closed line whose drawn curve is 26px tall, and a 34px open mouth.
  const closed = { fade: 'mouthClose', x: 500, y: 564, w: 74, h: 26 } as Anime25DPlaybackLayer
  const open = { fade: 'mouthOpen', x: 515, y: 561, w: 44, h: 34 } as Anime25DPlaybackLayer
  const sources = compileAnime25DMouthMorphSources([closed, open])
  const mouth = { x0: 502, y0: 566, x1: 571, y1: 587, cx: 537, cy: 578 }
  const face = { x0: 347, y0: 225, x1: 688, y1: 646, cx: 521, cy: 416 }
  const morph = {
    centerX: 0, centerY: 0, width: 1, height: 1, openMix: 0, wide: 0, round: 0, narrow: 0,
    openCenterY: 0, openHeight: 1,
  }
  const sample = (jaw: number) => {
    resolveMouthMorph(sources, { ...IDENTITY_DRIVER, jaw }, mouth, face, morph)
    return { ...morph }
  }
  const rest = sample(0)
  assert.equal(rest.height, closed.h, 'the closed line keeps its drawn size')
  assert.equal(rest.centerY, closed.y + closed.h / 2)
  // Where speech first swaps the closed line for open art.
  const parted = sample(0.12)
  assert.ok(parted.openHeight < open.h * 0.3, `${parted.openHeight}`)
  assert.ok(parted.height > closed.h * 0.9, 'the drawn closed line is not squashed')
  const closedCenterY = closed.y + closed.h / 2
  let previous = parted.openHeight
  for (let step = 13; step <= 100; step++) {
    const next = sample(step / 100)
    assert.ok(next.openHeight >= previous - 1e-9, 'opening never shrinks as the mouth opens')
    assert.ok(next.openHeight - previous < 1.2, 'no single step pops the opening')
    // The upper lip stays by the closed line; the jaw carries the opening down.
    const upperLip = next.openCenterY - next.openHeight / 2
    assert.ok(upperLip >= closed.y - 2 && upperLip <= closedCenterY, `${upperLip}`)
    previous = next.openHeight
  }
  // Fully open, the speaking art is exactly where it is drawn.
  const full = sample(1)
  assert.ok(Math.abs(full.openHeight - full.height) < 1e-9)
  assert.ok(Math.abs(full.openCenterY - full.centerY) < 1e-9)
})

test('the closed line hands over to the parting slit instead of cutting to it', () => {
  const closed = { fade: 'mouthClose' } as Anime25DPlaybackLayer
  const open = { fade: 'mouthOpen' } as Anime25DPlaybackLayer
  const frame = createAnime25DOpacityFrame()
  const at = (jaw: number) => {
    const driver = { ...IDENTITY_DRIVER, jaw }
    writeAnime25DOpacityFrame(frame, driver, 'mouthOpen')
    return { closed: fadeOpacityFromFrame(closed, frame), open: fadeOpacityFromFrame(open, frame) }
  }
  let previous = at(0.1)
  // Just parted: the line is still there and the slit is only coming in.
  assert.ok(previous.closed > 0.9 && previous.open < 0.5, JSON.stringify(previous))
  for (let step = 11; step <= 100; step++) {
    const next = at(step / 100)
    assert.ok(next.closed <= previous.closed + 1e-12 && next.open >= previous.open - 1e-12)
    assert.ok(Math.abs(next.closed - previous.closed) < 0.12 && Math.abs(next.open - previous.open) < 0.25)
    previous = next
  }
  assert.deepEqual(at(1), { closed: 0, open: 1 })
  // Closed art is unaffected when the mouth is closed.
  writeAnime25DOpacityFrame(frame, IDENTITY_DRIVER, 'mouthClose')
  assert.equal(fadeOpacityFromFrame(closed, frame), 1)
  assert.equal(fadeOpacityFromFrame(open, frame), 0)
})

/** A layer's opacity for `driver`, as the stage's opacity frame gives it. */
function fadeOpacity(
  layer: Pick<Anime25DPlaybackLayer, 'fade' | 'side'>,
  driver: Anime25DDriver,
  material: SpeechMouthMaterial = 'mouthClose',
  share = 1,
): number {
  const frame = createAnime25DOpacityFrame()
  writeAnime25DOpacityFrame(frame, driver, material, share)
  return fadeOpacityFromFrame(layer, frame)
}

test('symbol artwork replaces both open and closed eyes without stacking', () => {
  const layer = (
    fade: 'eyeOpen' | 'eyeClose' | 'eyeDizzy' | 'eyeSqueeze' | 'eyeCry',
  ) => ({ fade, side: 'L' }) as never
  const half = { ...IDENTITY_DRIVER, eyeDizzy: 0.5 }
  assert.ok(Math.abs(fadeOpacity(layer('eyeDizzy'), half) - 0.5) < 1e-12)
  assert.ok(Math.abs(fadeOpacity(layer('eyeOpen'), half) - 0.5) < 1e-12)
  assert.equal(fadeOpacity(layer('eyeClose'), half), 0)

  const dizzy = { ...IDENTITY_DRIVER, eyeDizzy: 1 }
  assert.equal(fadeOpacity(layer('eyeDizzy'), dizzy), 1)
  assert.equal(fadeOpacity(layer('eyeOpen'), dizzy), 0)
  assert.equal(fadeOpacity(layer('eyeClose'), dizzy), 0)

  const squeeze = { ...IDENTITY_DRIVER, eyeSqueeze: 1 }
  assert.equal(fadeOpacity(layer('eyeSqueeze'), squeeze), 1)
  assert.equal(fadeOpacity(layer('eyeOpen'), squeeze), 0)
  assert.equal(fadeOpacity(layer('eyeClose'), squeeze), 0)

  const cry = { ...IDENTITY_DRIVER, eyeCry: 1 }
  assert.equal(fadeOpacity(layer('eyeCry'), cry), 1)
  assert.equal(fadeOpacity(layer('eyeSqueeze'), cry), 0)
  assert.equal(fadeOpacity(layer('eyeOpen'), cry), 0)
  assert.equal(fadeOpacity(layer('eyeClose'), cry), 0)

  const cryAndSqueeze = {
    ...IDENTITY_DRIVER,
    eyeCry: 1,
    eyeSqueeze: 1,
  }
  assert.equal(fadeOpacity(layer('eyeCry'), cryAndSqueeze), 1)
  assert.equal(fadeOpacity(layer('eyeSqueeze'), cryAndSqueeze), 0)

  const both = { ...IDENTITY_DRIVER, eyeDizzy: 1, eyeSqueeze: 1 }
  assert.equal(fadeOpacity(layer('eyeDizzy'), both), 1)
  assert.equal(fadeOpacity(layer('eyeSqueeze'), both), 0)
  assert.equal(fadeOpacity(layer('eyeCry'), { ...both, eyeCry: 1 }), 0)
})

test('lovestruck accents preserve authored eyes and yield to replacement eyes', () => {
  const layer = (
    fade: 'eyeOpen' | 'lovestruckHeart' | 'lovestruckFace' | 'lovestruckDrool',
  ) => ({ fade, side: 'L' }) as never
  const lovestruck = { ...IDENTITY_DRIVER, lovestruck: 1 }
  assert.equal(fadeOpacity(layer('eyeOpen'), lovestruck), 1)
  assert.equal(fadeOpacity(layer('lovestruckHeart'), lovestruck), 1)
  assert.equal(fadeOpacity(layer('lovestruckFace'), lovestruck), 1)
  assert.equal(fadeOpacity(layer('lovestruckDrool'), lovestruck), 1)

  const blinking = { ...lovestruck, lidL: 0 }
  assert.equal(fadeOpacity(layer('lovestruckHeart'), blinking), 0)
  assert.equal(fadeOpacity(layer('lovestruckFace'), blinking), 1)

  const crying = { ...lovestruck, eyeCry: 1 }
  assert.equal(fadeOpacity(layer('lovestruckHeart'), crying), 0)
  assert.equal(fadeOpacity(layer('lovestruckFace'), crying), 0)
})

test('shows semantic accents only when replacement-eye expressions are clear', () => {
  const layer = (fade: 'angerMark' | 'speechlessSweat') =>
    ({ fade, side: null }) as never
  assert.equal(
    fadeOpacity(layer('angerMark'), { ...IDENTITY_DRIVER, anger: 1 }),
    1,
  )
  assert.equal(
    fadeOpacity(layer('speechlessSweat'), {
      ...IDENTITY_DRIVER,
      speechless: 1,
    }),
    1,
  )
  assert.equal(
    fadeOpacity(layer('speechlessSweat'), {
      ...IDENTITY_DRIVER,
      anger: 1,
      speechless: 1,
    }),
    0,
  )
  assert.equal(
    fadeOpacity(layer('angerMark'), {
      ...IDENTITY_DRIVER,
      anger: 1,
      eyeCry: 1,
    }),
    0,
  )
  assert.equal(
    fadeOpacity(layer('angerMark'), {
      ...IDENTITY_DRIVER,
      anger: 1,
      maniac: 1,
    }),
    0,
  )
})
