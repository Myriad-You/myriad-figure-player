import type { Anime25DPose } from './pose'
import type { PoseFigure } from './poseFrame'
import assert from 'node:assert/strict'
import test from 'node:test'
import { IDENTITY_DRIVER } from './driver'
import { POSE_VERSION } from './pose'
import { poseFits } from './poseFrame'

/** A figure with nothing to draw but its frame, and a pose of it. */
const figure = { layers: [], collarClip: null, mouth: null, armVariants: { modelledArms: () => [] } } as unknown as PoseFigure
function pose(version: number): Anime25DPose {
  return ({
  version,
  figure: '0-key',
  time: 0,
  driver: IDENTITY_DRIVER,
  frame: { viewWidth: 1, viewHeight: 1, bodyPivotX: 0, bodyPivotY: 0, bodyRotationCosine: 1, bodyRotationSine: 0, bodyBendHeight: 0, time: 0, eyeCry: 0 },
  order: new Uint16Array(),
  layers: [],
  collar: null,
  mouth: null,
  sticker: null,
  arms: [],
}) as unknown as Anime25DPose
}

test('a pose held as version 1 or as the current version fits its figure; any other version does not', () => {
  assert.equal(poseFits(figure, '0-key', pose(POSE_VERSION)), true)
  assert.equal(poseFits(figure, '0-key', pose(1)), true)
  for (const version of [0, 3]) assert.equal(poseFits(figure, '0-key', pose(version)), false)
  assert.equal(poseFits(figure, 'other', pose(POSE_VERSION)), false)
})
