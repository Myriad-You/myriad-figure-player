export type MouthExpressionKind =
  'open' | 'wide' | 'round' | 'narrow' | 'cry' | 'maniac' | 'silly'

export interface MouthExpressionPalette {
  line: Rgb
  cavity: Rgb
  fill: Rgb
}

export interface Rgb {
  red: number
  green: number
  blue: number
}

export type Point = readonly [x: number, y: number]

export function mixColor(
  left: Readonly<Rgb>,
  right: Readonly<Rgb>,
  amount: number,
): Rgb {
  return {
    red: Math.round(left.red + (right.red - left.red) * amount),
    green: Math.round(left.green + (right.green - left.green) * amount),
    blue: Math.round(left.blue + (right.blue - left.blue) * amount),
  }
}
