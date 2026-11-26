import type {
  Anime25DEyeAnchor,
} from './types'

export interface Anime25DRiggerAnchors {
  face: {
    cx: number
    cy: number
    x0: number
    x1: number
    y0: number
    y1: number
  }
  eyeL?: Anime25DEyeAnchor
  eyeR?: Anime25DEyeAnchor
  mouth: {
    x0: number
    x1: number
    y0: number
    y1: number
    cx: number
    cy: number
  }
  neckPivot: { cx: number; cy: number }
  neckTop: number
  neckBottom: number
  bodyPivot: { cx: number; cy: number }
  faceScale: number
}
