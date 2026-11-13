import { describe, expect, it } from 'vitest'
import type { MarsCoordinate } from '../mission/types'
import independentDistances from '../../../docs/evidence/scientific-validation/distance-fixtures.json'
import { calculateGrade, calculateTerrainCost, marsSurfaceDistance } from './terrainMath'

function coordinate(lon: number, lat: number): MarsCoordinate {
  return { lon, lat, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: '-180-180' }
}

describe('reference-sphere Mars distances', () => {
  it.each(independentDistances.analyticFixtures)('matches saved independent PROJ fixture $name', ({ start, end, distanceM }) => {
    const result = marsSurfaceDistance(coordinate(start[0], start[1]), coordinate(end[0], end[1]))
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error(result.reason)
    expect(result.value).toBeCloseTo(distanceM, 6)
  })

  // Analytic geometric fixtures, not observed Mars traverse measurements.
  it.each([
    [coordinate(0, 0), coordinate(0, 1), 59274.69752330622],
    [coordinate(0, 0), coordinate(90, 0), 5334722.7770975595],
    [coordinate(0, 0), coordinate(180, 0), 10669445.554195119],
    [coordinate(0, 60), coordinate(90, 60), 2454542.8250814443],
    [coordinate(179, 0), coordinate(-179, 0), 118549.39504661244],
    [coordinate(40, -90), coordinate(-130, 90), 10669445.554195119],
  ])('matches independent analytic geometry for %o → %o', (from, to, expectedM) => {
    const result = marsSurfaceDistance(from, to)
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error(result.reason)
    expect(result.value).toBeCloseTo(expectedM, 6)
    expect(marsSurfaceDistance(to, from)).toEqual(result)
  })

  it('has zero separation for equal positions, equivalent domains and polar longitude', () => {
    const equivalent: MarsCoordinate = { ...coordinate(350, 18), longitudeDomain: '0-360' }
    expect(marsSurfaceDistance(coordinate(77, 18), coordinate(77, 18))).toEqual({ status: 'available', value: 0 })
    expect(marsSurfaceDistance(equivalent, coordinate(-10, 18))).toEqual({ status: 'available', value: 0 })
    expect(marsSurfaceDistance(coordinate(-180, 18), coordinate(180, 18))).toEqual({ status: 'available', value: 0 })
    expect(marsSurfaceDistance(coordinate(40, 90), coordinate(-130, 90))).toEqual({ status: 'available', value: 0 })
    expect(marsSurfaceDistance(coordinate(40, -90), coordinate(-130, -90))).toEqual({ status: 'available', value: 0 })
  })

  it('retains finite nonzero separation for a sub-cell interval and near-antipodal inputs', () => {
    const small = marsSurfaceDistance(coordinate(0, 0), coordinate(0, 0.000001))
    expect(small.status).toBe('available')
    if (small.status !== 'available') throw new Error(small.reason)
    expect(small.value).toBeCloseTo(0.05927469752330622, 12)
    const nearAntipode = marsSurfaceDistance(coordinate(0, 0), coordinate(179.999, 0))
    expect(nearAntipode.status).toBe('available')
    if (nearAntipode.status !== 'available') throw new Error(nearAntipode.reason)
    expect(nearAntipode.value).toBeCloseTo(10669386.279497594, 2)
    const veryNearAntipode = marsSurfaceDistance(coordinate(0, 0), coordinate(179.9999999, 0))
    expect(veryNearAntipode.status).toBe('available')
    if (veryNearAntipode.status !== 'available') throw new Error(veryNearAntipode.reason)
    // Analytic equatorial arc: pi*R minus the remaining 0.0000001 degrees.
    expect(veryNearAntipode.value).toBeCloseTo(10669445.548267648, 6)
    const tiny = marsSurfaceDistance(coordinate(0, 0), coordinate(0.0000000001, 0))
    expect(tiny.status).toBe('available')
    if (tiny.status !== 'available') throw new Error(tiny.reason)
    expect(tiny.value).toBeCloseTo(0.000005927469752330622, 12)
  })

  it.each([
    coordinate(NaN, 18), coordinate(77, Infinity), coordinate(181, 18), coordinate(77, -91),
    { ...coordinate(77, 18), latitudeConvention: 'planetographic' as const },
    { ...coordinate(77, 18), longitudeDirection: 'west-positive' as const },
    { ...coordinate(361, 18), longitudeDomain: '0-360' as const },
    coordinate('77' as unknown as number, 18),
    coordinate(77, '18' as unknown as number),
  ])('rejects unsupported coordinates %o on either side', (invalid) => {
    expect(marsSurfaceDistance(invalid, coordinate(0, 0))).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/coordinate/) })
    expect(marsSurfaceDistance(coordinate(0, 0), invalid)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/coordinate/) })
  })
})

describe('signed directional grade from test-only synthetic rise/run fixtures', () => {
  it.each([
    [0, 20, 0, 0, 0],
    [20, 20, 45, 100, 1],
    [-20, 20, -45, -100, -1],
    [3, 4, 36.86989764584402, 75, 0.75],
    [10, 18.968674590506335, 27.797523978544827, 52.71849623592002, 0.5271849623592002],
  ])('calculates %s m rise over %s m run', (riseM, runM, degrees, percent, ratio) => {
    const result = calculateGrade(riseM, runM)
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error(result.reason)
    expect(result.value.signedDegrees).toBeCloseTo(degrees, 12)
    expect(result.value.absoluteDegrees).toBeCloseTo(Math.abs(degrees), 12)
    expect(result.value.percent).toBeCloseTo(percent, 12)
    expect(result.value.ratio).toBeCloseTo(ratio, 12)
  })

  it.each([[NaN, 20], [Infinity, 20], [0, NaN], [10, 0], [10, -20], [10, Infinity], [Number.MAX_VALUE, Number.MIN_VALUE]])('rejects invalid or overflowing rise/run %s,%s', (rise, run) => {
    expect(calculateGrade(rise, run)).toMatchObject({ status: 'unavailable', reason: expect.any(String) })
  })

  it('does not report a flat grade when a nonzero rise/run underflows', () => {
    expect(calculateGrade(1e-300, 1e100)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/underflow/) })
  })
})

describe('hypothetical squared-grade terrain costs', () => {
  it('has an explicit equivalent-metre unit and independently checkable breakdown', () => {
    expect(calculateTerrainCost(20, 0.5, 4)).toEqual({ status: 'available', value: { distanceCostM: 20, slopePenaltyM: 20, totalCostM: 40, unit: 'cost-equivalent-m' } })
    expect(calculateTerrainCost(20, -0.5, 4)).toEqual(calculateTerrainCost(20, 0.5, 4))
    expect(calculateTerrainCost(20, 1, 0)).toMatchObject({ status: 'available', value: { distanceCostM: 20, slopePenaltyM: 0, totalCostM: 20 } })
    expect(calculateTerrainCost(20, 0, 4)).toMatchObject({ status: 'available', value: { slopePenaltyM: 0, totalCostM: 20 } })
  })

  it('is nonnegative, bounded by distance and monotonic in absolute grade and weight', () => {
    let previous = 20
    for (const ratio of [0, 0.25, 0.5, 1, 2]) {
      const result = calculateTerrainCost(20, ratio, 4)
      expect(result.status).toBe('available')
      if (result.status !== 'available') throw new Error(result.reason)
      expect(result.value.totalCostM).toBeGreaterThanOrEqual(previous)
      expect(result.value.slopePenaltyM).toBeGreaterThanOrEqual(0)
      previous = result.value.totalCostM
    }
    expect(calculateTerrainCost(20, 0.5, 8)).toMatchObject({ status: 'available', value: { totalCostM: 60 } })
  })

  it.each([
    [1e-200, 1e150, 1e-200, 1e-100],
    [1e-300, 1e200, 1e200, 1e300],
  ])('preserves a representable penalty despite extreme intermediate factors %s,%s,%s', (distance, ratio, weight, expectedPenalty) => {
    const result = calculateTerrainCost(distance, ratio, weight)
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error(result.reason)
    // A relative assertion detects zero substitution for a tiny nonzero penalty.
    expect(result.value.slopePenaltyM / expectedPenalty).toBeCloseTo(1, 14)
    expect(result.value.totalCostM).toBeGreaterThanOrEqual(result.value.slopePenaltyM)
  })

  it('returns unavailable for a true nonzero penalty underflow rather than flat-cost substitution', () => {
    expect(calculateTerrainCost(1e-200, 1e-150, 1e-200)).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/underflow/) })
  })

  it('retains exact zero penalty for zero weight or grade even with extreme other factors', () => {
    expect(calculateTerrainCost(1e-200, Number.MAX_VALUE, 0)).toMatchObject({ status: 'available', value: { slopePenaltyM: 0, totalCostM: 1e-200 } })
    expect(calculateTerrainCost(Number.MAX_VALUE, 0, Number.MAX_VALUE)).toMatchObject({ status: 'available', value: { slopePenaltyM: 0, totalCostM: Number.MAX_VALUE } })
  })

  it.each([[0, 0.1, 4], [-1, 0.1, 4], [NaN, 0.1, 4], [20, NaN, 4], [20, Infinity, 4], [20, 0.1, -1], [20, 0.1, NaN], [20, 0.1, Infinity], [20, Number.MAX_VALUE, 4], [Number.MAX_VALUE, 1, 4]])('rejects invalid or overflowing cost inputs %s,%s,%s', (distance, ratio, weight) => {
    expect(calculateTerrainCost(distance, ratio, weight)).toMatchObject({ status: 'unavailable', reason: expect.any(String) })
  })
})
