import assert from 'node:assert/strict'
import test from 'node:test'
import { detectPaintedLips } from './lipMouth'

function mouth(width: number, height: number, paint: (x: number, y: number) => readonly [number, number, number] | null) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = paint(x, y)
      if (color) data.set([...color, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

// A made-up smile: red lips around a band of teeth.
const lipstick = mouth(60, 30, (x, y) => {
  const u = (x - 30) / 30
  const v = (y - 15) / 15
  if (u * u + v * v > 1) return null
  return Math.abs(v) < 0.3 ? [238, 232, 230] : [170, 60, 80]
})
// A cel mouth: one thin pale stroke.
const line = mouth(60, 12, (_x, y) => (y >= 5 && y <= 6 ? [220, 170, 170] : null))

test('a painted mouth with lips is told apart from a cel line', () => {
  const lips = detectPaintedLips(lipstick)
  assert.ok(lips)
  assert.ok(lips.lips.red > 150 && lips.lips.green < 90)
  assert.ok(lips.teeth.red > 220 && lips.teeth.green > 220)
  assert.equal(detectPaintedLips(line), null)
})
