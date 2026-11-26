import type { MouthExpressionPalette, Rgb } from './mouthShared'
import { mixColor } from './mouthShared'

export { mouthExpressionOuterPath } from './mouthPaths'
export { type MouthExpressionPalette } from './mouthShared'

const FALLBACK_LINE = { red: 104, green: 57, blue: 75 }
const FALLBACK_CAVITY = { red: 91, green: 45, blue: 65 }
const FALLBACK_FILL = { red: 232, green: 139, blue: 151 }

/** Samples only color identity */
export function sampleMouthExpressionPalette(
  source: Uint8ClampedArray | undefined,
): MouthExpressionPalette {
  if (!source || source.length < 4) {
    return {
      line: FALLBACK_LINE,
      cavity: FALLBACK_CAVITY,
      fill: FALLBACK_FILL,
    }
  }
  const visible: Array<Rgb & { luminance: number }> = []
  for (let index = 0; index < source.length; index += 4) {
    if (source[index + 3] < 40) continue
    const red = source[index]
    const green = source[index + 1]
    const blue = source[index + 2]
    visible.push({
      red,
      green,
      blue,
      luminance: red * 0.299 + green * 0.587 + blue * 0.114,
    })
  }
  if (visible.length === 0) {
    return {
      line: FALLBACK_LINE,
      cavity: FALLBACK_CAVITY,
      fill: FALLBACK_FILL,
    }
  }
  const ranked = visible.toSorted(
    (left, right) => left.luminance - right.luminance,
  )
  const darkCount = Math.max(1, Math.ceil(ranked.length * 0.08))
  const sampledLine = average(ranked.slice(0, darkCount))
  const lineLuminance = luminance(sampledLine)
  const line =
    lineLuminance <= 145
      ? mixColor(sampledLine, FALLBACK_LINE, 0.18)
      : FALLBACK_LINE
  const warmPixels = ranked.filter(
    (color) => color.red > color.green * 1.04 && color.red > color.blue * 0.96,
  )
  const sampledFill = average(warmPixels.length > 0 ? warmPixels : ranked)
  const fill = mixColor(sampledFill, FALLBACK_FILL, 0.72)
  return {
    line,
    cavity: mixColor(line, FALLBACK_CAVITY, 0.58),
    fill,
  }
}

function average(colors: readonly Rgb[]): Rgb {
  if (colors.length === 0) return FALLBACK_FILL
  let red = 0
  let green = 0
  let blue = 0
  for (const color of colors) {
    red += color.red
    green += color.green
    blue += color.blue
  }
  return {
    red: Math.round(red / colors.length),
    green: Math.round(green / colors.length),
    blue: Math.round(blue / colors.length),
  }
}

function luminance(color: Readonly<Rgb>): number {
  return color.red * 0.299 + color.green * 0.587 + color.blue * 0.114
}
