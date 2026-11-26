import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_RIG_BONES,
  RIG_MATRIX_CAPACITY,
} from './contract'

test('GPU capacity covers every manifest bone accepted by the contract', () => {
  assert.equal(MAX_RIG_BONES, 48)
  assert.ok(RIG_MATRIX_CAPACITY >= MAX_RIG_BONES)
})
