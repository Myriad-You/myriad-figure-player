/** A colour sampled from or painted into the artwork, each channel 0 to 255. */
export interface Anime25DRgb {
  red: number
  green: number
  blue: number
}

/** `amount` of the way from `left` to `right`, each channel rounded. */
export function mixRgb(
  left: Readonly<Anime25DRgb>,
  right: Readonly<Anime25DRgb>,
  amount: number,
): Anime25DRgb {
  return {
    red: Math.round(left.red + (right.red - left.red) * amount),
    green: Math.round(left.green + (right.green - left.green) * amount),
    blue: Math.round(left.blue + (right.blue - left.blue) * amount),
  }
}
