import { describe, expect, it } from 'vitest'
import { MARS_LAYERS } from '../../data/marsLayers'
import { coverageForView, tileForCoordinate } from './grid'

describe('Mars Trek angular tile grid (test positions, not observations)', () => {
  it('agrees with the documented two-column, one-row global grid', () => {
    expect(tileForCoordinate([-180, 90], 0)).toEqual([0, 0, 0])
    expect(tileForCoordinate([0, 0], 0)).toEqual([0, 1, 0])
  })
  it('locates the independently requested Jezero tile without Earth reprojection', () => {
    expect(tileForCoordinate([77.5, 18.5], 9)).toEqual([9, 732, 203])
    expect(tileForCoordinate([18.5, 77.5], 9)).not.toEqual([9, 732, 203])
  })
  it('supports controlled CTX matrix 13 and rejects unsupported higher levels', () => {
    expect(tileForCoordinate([77.69, 18.41], 13)).toEqual([13, 11727, 3258])
    expect(tileForCoordinate([77.69, 18.41], 14)).toBeNull()
  })
  it.each([[180, 0], [0, -90], [181, 0], [0, 91], [NaN, 0], [0, Infinity]])('rejects out-of-grid coordinates %s %s', (x, y) => {
    expect(tileForCoordinate([x, y], 9)).toBeNull()
  })
  it('distinguishes full, partial, and absent coverage', () => {
    const extent = MARS_LAYERS[1].extent
    expect(coverageForView([77, 18, 78, 19], extent)).toBe('inside')
    expect(coverageForView([74, 18, 78, 20], extent)).toBe('partial')
    expect(coverageForView([0, 0, 1, 1], extent)).toBe('outside')
    expect(coverageForView([70, 16, extent[0], 17], extent)).toBe('outside')
  })
})
