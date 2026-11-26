import type { Anime25DDriver } from './driver'
import type { SpeechMouthMaterial } from './mouthTransition'
import type { Anime25DPlaybackLayer } from './types'
import assert from 'node:assert/strict'
import test from 'node:test'
import { IDENTITY_DRIVER } from './driver'
import { createAnime25DOpacityFrame, fadeOpacityFromFrame, writeAnime25DOpacityFrame } from './mouthRuntime'

/** A layer's opacity for a driver, through the opacity frame the stage writes each frame. */
function fadeOpacity(
  layer: Pick<Anime25DPlaybackLayer, 'fade' | 'side'>,
  driver: Readonly<Anime25DDriver>,
  activeMouthMaterial?: SpeechMouthMaterial,
  stickerMouthShare = 1,
): number {
  const frame = createAnime25DOpacityFrame()
  writeAnime25DOpacityFrame(frame, driver, activeMouthMaterial as SpeechMouthMaterial, stickerMouthShare)
  return fadeOpacityFromFrame(layer, frame)
}

test('special mouths replace normal speaking and closed artwork without stacking', () => {
  const layer = (
    fade: 'mouthOpen' | 'mouthClose' | 'mouthCry' | 'mouthManiac',
  ) => ({ fade, side: null }) as never
  const crying = { ...IDENTITY_DRIVER, eyeCry: 1, jaw: 0.5 }
  assert.equal(fadeOpacity(layer('mouthCry'), crying), 1)
  assert.equal(fadeOpacity(layer('mouthOpen'), crying), 0)
  assert.equal(fadeOpacity(layer('mouthClose'), crying), 0)

  const talking = { ...IDENTITY_DRIVER, jaw: 1 }
  assert.equal(fadeOpacity(layer('mouthCry'), talking), 0)
  assert.equal(fadeOpacity(layer('mouthOpen'), talking), 1)
  assert.equal(fadeOpacity(layer('mouthClose'), talking), 0)

  const maniac = { ...IDENTITY_DRIVER, maniac: 1 }
  assert.equal(fadeOpacity(layer('mouthManiac'), maniac), 1)
  assert.equal(fadeOpacity(layer('mouthOpen'), maniac), 0)
  assert.equal(fadeOpacity(layer('mouthClose'), maniac), 0)

  // Handing over, the special mouth comes in over the speaking one before it
  // goes: one of them always covers the mouth fully.
  for (const [special, fade] of [['maniac', 'mouthManiac'], ['eyeCry', 'mouthCry']] as const) {
    for (let step = 0; step <= 20; step += 1) {
      const driver = { ...IDENTITY_DRIVER, [special]: step / 20, jaw: 1 }
      const incoming = fadeOpacity(layer(fade), driver)
      const outgoing = fadeOpacity(layer('mouthOpen'), driver)
      assert.ok(Math.max(incoming, outgoing) > 0.999, `${special} ${step}: ${incoming} ${outgoing}`)
    }
  }
})

test('vacant-stare artwork owns both eyes and the mouth while it is up', () => {
  const eye = (fade: 'eyeOpen' | 'eyeClose' | 'eyeSilly') =>
    ({ fade, side: 'L' }) as never
  const mouth = (
    fade: 'mouthOpen' | 'mouthClose' | 'mouthSilly' | 'mouthManiac',
  ) => ({ fade, side: null }) as never

  const silly = { ...IDENTITY_DRIVER, silly: 1, jaw: 1 }
  assert.equal(fadeOpacity(eye('eyeSilly'), silly), 1)
  assert.equal(fadeOpacity(eye('eyeOpen'), silly), 0)
  assert.equal(fadeOpacity(eye('eyeClose'), silly), 0)
  assert.equal(fadeOpacity(mouth('mouthSilly'), silly), 1)
  assert.equal(fadeOpacity(mouth('mouthOpen'), silly), 0)
  assert.equal(fadeOpacity(mouth('mouthClose'), silly), 0)

  const half = { ...IDENTITY_DRIVER, silly: 0.5 }
  assert.ok(Math.abs(fadeOpacity(eye('eyeSilly'), half) - 0.5) < 1e-12)
  assert.ok(Math.abs(fadeOpacity(eye('eyeOpen'), half) - 0.5) < 1e-12)

  assert.equal(fadeOpacity(mouth('mouthSilly'), silly, undefined, 0), 0)
  assert.equal(fadeOpacity(mouth('mouthOpen'), silly, undefined, 0), 1)
  assert.equal(fadeOpacity(eye('eyeSilly'), silly, undefined, 0), 1)

  const crying = { ...IDENTITY_DRIVER, silly: 1, eyeCry: 1 }
  assert.equal(fadeOpacity(eye('eyeSilly'), crying), 0)

  const laughing = { ...IDENTITY_DRIVER, silly: 1, maniac: 1 }
  assert.equal(fadeOpacity(eye('eyeSilly'), laughing), 0)
  assert.equal(fadeOpacity(mouth('mouthSilly'), laughing), 0)
  assert.equal(fadeOpacity(mouth('mouthManiac'), laughing), 1)
})
