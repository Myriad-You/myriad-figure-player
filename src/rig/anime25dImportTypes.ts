import type { Anime25DArmVariant } from '../anime25drig/types'
import type { Anime25DLayerRole } from './anime25d'

export type EyeSide = 'left' | 'right'

export interface HairStrand {
  x: number
  rootY: number
  tipY: number
}

export interface RasterLayer {
  id: string
  role: Anime25DLayerRole | 'unknown'
  sourceName: string
  order: number
  side: EyeSide | null
  group: 'head' | 'body'
  left: number
  top: number
  width: number
  height: number
  data: Uint8ClampedArray
  synthetic?: boolean
  slot?: 'eye-left' | 'eye-right' | 'mouth'
  variant?:
    | 'open'
    | 'closed'
    | 'wide'
    | 'round'
    | 'narrow'
    | 'dizzy'
    | 'squeeze'
    | 'cry'
    | 'maniac'
    | 'silly'
  documentStrands?: HairStrand[]
  /** A gesture arm (armVariantPresenter), hidden until raised. */
  armVariant?: Anime25DArmVariant
}
