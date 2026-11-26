import assert from 'node:assert/strict'
import test from 'node:test'
import {
  sampleMouthExpressionPalette,
} from './mouthExpression'

test('uses the source dark line while preventing a pale invisible outline', () => {
  const dark = sampleMouthExpressionPalette(
    new Uint8ClampedArray([44, 30, 58, 255, 244, 210, 215, 255]),
  )
  assert.ok(dark.line.red < 100)
  const pale = sampleMouthExpressionPalette(
    new Uint8ClampedArray([245, 220, 224, 255, 250, 228, 232, 255]),
  )
  assert.ok(pale.line.red < 150)
})
