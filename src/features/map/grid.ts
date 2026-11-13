import type { Bounds, Coverage } from './types'

export const WORLD_EXTENT: Bounds = [-180, -90, 180, 90]
export const MAX_LEVEL = 13

// Pure angular indexing; no Earth transform, physical distance, or DEM inference.
export function tileForCoordinate([longitude, latitude]: [number, number], level: number): [number, number, number] | null {
  if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL || !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude >= 180 || latitude <= -90 || latitude > 90) return null
  const span = 180 / 2 ** level
  return [level, Math.floor((longitude + 180) / span), Math.floor((90 - latitude) / span)]
}

export function coverageForView(view: Bounds, coverage: Bounds): Coverage {
  if (view[2] <= coverage[0] || view[0] >= coverage[2] || view[3] <= coverage[1] || view[1] >= coverage[3]) return 'outside'
  return view[0] >= coverage[0] && view[1] >= coverage[1] && view[2] <= coverage[2] && view[3] <= coverage[3] ? 'inside' : 'partial'
}
