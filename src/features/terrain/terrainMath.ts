import { toDisplayCoordinate } from '../mission/coordinates'
import type { MarsCoordinate } from '../mission/types'

export type MetricResult<T> = { readonly status: 'available'; readonly value: T } | { readonly status: 'unavailable'; readonly reason: string }

/** The source's reference sphere, not an Earth radius or a terrain-following radius. */
export const MARS_REFERENCE_RADIUS_M = 3396190

export type TerrainGrade = {
  readonly signedDegrees: number
  readonly absoluteDegrees: number
  readonly percent: number
  readonly ratio: number
}

export type TerrainCost = {
  readonly distanceCostM: number
  readonly slopePenaltyM: number
  readonly totalCostM: number
  readonly unit: 'cost-equivalent-m'
}

/** Shortest arc on the fixed source sphere; no terrain profile or route is inferred. */
export function marsSurfaceDistance(from: MarsCoordinate, to: MarsCoordinate): MetricResult<number> {
  const first = toDisplayCoordinate(from)
  const second = toDisplayCoordinate(to)
  if (!first || !second) return { status: 'unavailable', reason: 'Distance requires finite planetocentric, east-positive Mars coordinates in their declared longitude domain.' }
  let longitudeDelta = second[0] - first[0]
  if (longitudeDelta > 180) longitudeDelta -= 360
  if (longitudeDelta < -180) longitudeDelta += 360
  // Longitude has no meaning at either exact pole; preserve exact equivalent positions.
  if (first[1] === second[1] && (longitudeDelta === 0 || Math.abs(first[1]) === 90)) return { status: 'available', value: 0 }
  const toRadians = Math.PI / 180
  function unitVector(position: readonly [number, number]): readonly [number, number, number] {
    const lon = position[0] * toRadians
    const lat = position[1] * toRadians
    const latitudeCosine = Math.cos(lat)
    return [latitudeCosine * Math.cos(lon), latitudeCosine * Math.sin(lon), Math.sin(lat)]
  }
  const a = unitVector(first)
  const b = unitVector(second)
  const crossMagnitude = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  // atan2 of cross/dot remains stable when a haversine rounds to one near antipodes.
  const centralAngle = Math.atan2(crossMagnitude, dot)
  const distanceM = MARS_REFERENCE_RADIUS_M * centralAngle
  return Number.isFinite(distanceM) ? { status: 'available', value: distanceM } : { status: 'unavailable', reason: 'Reference-sphere distance arithmetic is nonfinite.' }
}

/** Directional rise/run grade. This is not a maximum terrain slope or a hazard threshold. */
export function calculateGrade(riseM: number, runM: number): MetricResult<TerrainGrade> {
  if (!Number.isFinite(riseM) || !Number.isFinite(runM) || runM <= 0) return { status: 'unavailable', reason: 'Grade requires a finite height difference and a positive finite horizontal run in metres.' }
  const ratio = riseM === 0 ? 0 : riseM / runM
  if (riseM !== 0 && ratio === 0) return { status: 'unavailable', reason: 'Grade ratio underflowed; a nonzero rise cannot be represented as flat terrain.' }
  const percent = ratio * 100
  const signedDegrees = riseM === 0 ? 0 : Math.atan2(riseM, runM) * 180 / Math.PI
  if (![ratio, percent, signedDegrees].every(Number.isFinite)) return { status: 'unavailable', reason: 'Grade arithmetic overflowed; no slope estimate is available.' }
  return { status: 'available', value: { ratio, percent, signedDegrees, absoluteDegrees: Math.abs(signedDegrees) } }
}

/** Balance positive factors around one to avoid preventable intermediate overflow/underflow. */
function balancedProduct(factors: readonly number[]): number {
  const remaining = [...factors].sort((a, b) => a - b)
  let smallest = 0
  let largest = remaining.length - 1
  let product = 1
  while (smallest <= largest) {
    product *= product <= 1 ? remaining[largest--] : remaining[smallest++]
  }
  return product
}

/**
 * Hypothetical planning preference: d × (1 + w × (rise/run)²).
 * The dimensionless nonnegative weight is not calibrated energy, risk or safety.
 */
export function calculateTerrainCost(distanceM: number, gradeRatio: number, slopeWeight: number): MetricResult<TerrainCost> {
  if (!Number.isFinite(distanceM) || distanceM <= 0 || !Number.isFinite(gradeRatio)) return { status: 'unavailable', reason: 'Terrain cost requires positive finite distance and finite grade ratio.' }
  if (!Number.isFinite(slopeWeight) || slopeWeight < 0) return { status: 'unavailable', reason: 'The hypothetical slope weight must be finite and nonnegative.' }
  const zeroPenalty = slopeWeight === 0 || gradeRatio === 0
  const absoluteRatio = Math.abs(gradeRatio)
  const slopePenaltyM = zeroPenalty ? 0 : balancedProduct([distanceM, slopeWeight, absoluteRatio, absoluteRatio])
  if (!zeroPenalty && slopePenaltyM === 0) return { status: 'unavailable', reason: 'Terrain-cost penalty underflowed; a nonzero slope penalty cannot be represented.' }
  const totalCostM = distanceM + slopePenaltyM
  if (!Number.isFinite(slopePenaltyM) || !Number.isFinite(totalCostM)) return { status: 'unavailable', reason: 'Terrain-cost arithmetic overflowed; no cost estimate is available.' }
  return { status: 'available', value: { distanceCostM: distanceM, slopePenaltyM, totalCostM, unit: 'cost-equivalent-m' } }
}
