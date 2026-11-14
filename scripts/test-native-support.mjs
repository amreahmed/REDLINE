import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aggregateNativeFootprint, reprojectSphericalEqcFootprint } from './native-support.mjs'

// Synthetic mathematical fixtures only; none of these values are Mars observations.
const grid = overrides => ({
  rows: 2, columns: 2, westM: 0, northM: 20, spacingM: 10,
  radiusM: 1000, samples: [2, 6, 10, 14], validity: [1, 1, 1, 1],
  ...overrides,
})
const whole = { westM: 0, eastM: 20, southM: 0, northM: 20 }

test('constant samples stay constant across fractional native support', () => {
  const result = aggregateNativeFootprint(grid({ samples: [7, 7, 7, 7] }), { westM: 3, eastM: 16, southM: 2, northM: 18 })
  assert.equal(result.status, 'accepted')
  assert.equal(result.coveredCells, 4)
  assert.ok(Math.abs(result.meanM - 7) < 1e-12)
  assert.ok(result.surfaceAreaM2 > 0)
})

test('fractional column overlaps use their actual widths', () => {
  const result = aggregateNativeFootprint(grid(), { westM: 5, eastM: 20, southM: 10, northM: 20 })
  assert.equal(result.status, 'accepted')
  assert.equal(result.coveredCells, 2)
  assert.ok(Math.abs(result.meanM - (2 * 5 + 6 * 10) / 15) < 1e-12)
})

test('latitude bands use spherical surface area rather than projected area', () => {
  const result = aggregateNativeFootprint(grid({ radiusM: 20 }), whole)
  const northWeight = Math.sin(1) - Math.sin(0.5)
  const southWeight = Math.sin(0.5)
  const expected = (4 * northWeight + 12 * southWeight) / (northWeight + southWeight)
  assert.equal(result.status, 'accepted')
  assert.ok(Math.abs(result.meanM - expected) < 1e-12)
  assert.ok(Math.abs(result.meanM - 8) > 0.5)
  assert.ok(Math.abs(result.surfaceAreaM2 - 400 * Math.sin(1)) < 1e-10)
})

test('exact edge contact includes no adjacent zero-area cells', () => {
  const result = aggregateNativeFootprint(grid({ validity: [1, 0, 0, 0] }), { westM: 0, eastM: 10, southM: 10, northM: 20 })
  assert.equal(result.status, 'accepted')
  assert.equal(result.meanM, 2)
  assert.equal(result.coveredCells, 1)
})

test('partial boundaries are rejected, including tiny outside slivers', () => {
  for (const footprint of [
    { ...whole, westM: -0.000000001 }, { ...whole, eastM: 21 },
    { ...whole, southM: -1 }, { ...whole, northM: 21 },
  ]) assert.deepEqual(aggregateNativeFootprint(grid(), footprint), { status: 'rejected', reason: 'outside-grid' })
})

test('missing masks, sentinels and nonfinite covered cells cannot be averaged away', () => {
  for (const overrides of [
    { validity: [1, 0, 1, 1] }, { samples: [2, NaN, 10, 14] },
    { samples: [2, Infinity, 10, 14] }, { samples: [2, -32768, 10, 14], noData: -32768 },
  ]) assert.deepEqual(aggregateNativeFootprint(grid(overrides), whole), { status: 'rejected', reason: 'missing-support' })
})

test('contract errors and nonpositive or nonfinite footprints fail explicitly', () => {
  for (const overrides of [
    { rows: 0 }, { columns: 1.5 }, { samples: [1] }, { validity: [1] },
    { spacingM: 0 }, { radiusM: -1 }, { northM: Infinity }, { radiusM: 1 },
  ]) assert.throws(() => aggregateNativeFootprint(grid(overrides), whole))
  for (const footprint of [{ ...whole, eastM: 0 }, { ...whole, southM: 20 }, { ...whole, westM: NaN }]) {
    assert.throws(() => aggregateNativeFootprint(grid(), footprint))
  }
})

test('sphere-radius changes preserve geographic footprint edges', () => {
  const footprint = { westM: 4_583_825, eastM: 4_583_875, southM: 1_097_875, northM: 1_097_925 }
  const mapped = reprojectSphericalEqcFootprint(footprint, 3_396_000, 3_396_190)
  for (const edge of Object.keys(footprint)) assert.ok(Math.abs(mapped[edge] / 3_396_190 - footprint[edge] / 3_396_000) < 1e-15)
  assert.ok(mapped.westM - footprint.westM > 250)
  assert.ok(mapped.eastM - mapped.westM > 50)
  assert.throws(() => reprojectSphericalEqcFootprint(footprint, 0, 3_396_190))
})
