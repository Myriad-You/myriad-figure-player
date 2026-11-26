import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveAnime25DRenderSurface,
  shouldApplyAnime25DResize,
} from './runtimePolicy'

test('zero-size boxes do not resize the WebGL canvas', () => {
  assert.equal(shouldApplyAnime25DResize(0, 160), false)
  assert.equal(shouldApplyAnime25DResize(120, 0), false)
  assert.equal(shouldApplyAnime25DResize(Number.NaN, 160), false)
  assert.equal(shouldApplyAnime25DResize(120, 160), true)
})

test('shrinks the backing store slower than the CSS box', () => {
  assert.deepEqual(
    resolveAnime25DRenderSurface({
      sourceWidth: 2048,
      sourceHeight: 1024,
      cssWidth: 512,
      cssHeight: 512,
      devicePixelRatio: 2,
    }),
    {
      bufferWidth: 1261,
      bufferHeight: 630,
      displayWidth: 512,
      displayHeight: 256,
    },
  )
})

test('keeps extra backing pixels on a small face without reaching source size', () => {
  const surface = resolveAnime25DRenderSurface({
    sourceWidth: 2048,
    sourceHeight: 2048,
    cssWidth: 201,
    cssHeight: 201,
    devicePixelRatio: 2,
  })
  assert.equal(surface.displayWidth, 201)
  assert.equal(surface.displayHeight, 201)
  assert.equal(surface.bufferWidth, 569)
  assert.equal(surface.bufferHeight, 569)
  assert.ok(surface.bufferWidth > 201 * 2)
  assert.ok(surface.bufferWidth < 2048 * 2)
})

test('keeps the source-resolution ceiling when enlarged', () => {
  assert.deepEqual(
    resolveAnime25DRenderSurface({
      sourceWidth: 2048,
      sourceHeight: 1024,
      cssWidth: 4096,
      cssHeight: 4096,
      devicePixelRatio: 4,
    }),
    {
      bufferWidth: 4096,
      bufferHeight: 2048,
      displayWidth: 4096,
      displayHeight: 2048,
    },
  )
})

test('keeps full-size rendering unchanged at the supported DPR', () => {
  assert.deepEqual(
    resolveAnime25DRenderSurface({
      sourceWidth: 1000,
      sourceHeight: 500,
      cssWidth: 1000,
      cssHeight: 500,
      devicePixelRatio: 2,
    }),
    {
      bufferWidth: 2000,
      bufferHeight: 1000,
      displayWidth: 1000,
      displayHeight: 500,
    },
  )
})
