import { terrainHeightDifferenceBlocker } from '../../data/terrainScience'
import type { MarsCoordinate } from '../mission/types'
import type { GridCell, TerrainGrid } from './gridTypes'
import { getGridCell, parseTerrainGridManifest } from './terrainGrid'
import { calculateGrade, calculateTerrainCost, MARS_REFERENCE_RADIUS_M, marsSurfaceDistance } from './terrainMath'
import type { MetricResult, TerrainCost, TerrainGrade } from './terrainMath'

export type GridIndices = { readonly row: number; readonly column: number }

export type GridSeparation = {
  readonly from: GridCell
  readonly to: GridCell
  readonly distanceM: number
  readonly referenceRadiusM: 3396190
  readonly model: 'reference-sphere-shortest-arc'
}

export type TerrainEdge = GridSeparation & {
  readonly riseM: number
  readonly grade: TerrainGrade
  readonly cost: TerrainCost
}

function gridContractBlocker(grid: TerrainGrid): string | null {
  try {
    parseTerrainGridManifest(grid?.manifest)
    if (!(grid.values instanceof Float32Array)) return 'Terrain cell storage must be native decoded float32 values.'
  } catch (error) {
    return error instanceof Error ? error.message : 'Terrain grid contract is unavailable.'
  }
  return null
}

function cellCoordinate(cell: GridCell): MarsCoordinate {
  return { lon: cell.lon, lat: cell.lat, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: '-180-180' }
}

/**
 * Re-reads valid native source cells; caller-supplied endpoint heights are never inputs.
 * Geometric separation ignores intervening terrain and is not a traversable route.
 */
export function measureGridSeparation(grid: TerrainGrid, from: GridIndices, to: GridIndices): MetricResult<GridSeparation> {
  const blocker = gridContractBlocker(grid)
  if (blocker) return { status: 'unavailable', reason: blocker }
  const first = getGridCell(grid, from?.row, from?.column)
  if (first.status !== 'valid') return { status: 'unavailable', reason: `Origin: ${first.reason}` }
  const second = getGridCell(grid, to?.row, to?.column)
  if (second.status !== 'valid') return { status: 'unavailable', reason: `Destination: ${second.reason}` }
  const distance = marsSurfaceDistance(cellCoordinate(first.cell), cellCoordinate(second.cell))
  if (distance.status !== 'available') return distance
  return { status: 'available', value: { from: first.cell, to: second.cell, distanceM: distance.value, referenceRadiusM: MARS_REFERENCE_RADIUS_M, model: 'reference-sphere-shortest-arc' } }
}

/**
 * One directional native edge only. Missing diagonal flanks block corner cutting.
 * Scientific authorization of the exact band's height differences is mandatory.
 */
export function inspectTerrainEdge(grid: TerrainGrid, from: GridIndices, to: GridIndices, slopeWeight: number): MetricResult<TerrainEdge> {
  const separation = measureGridSeparation(grid, from, to)
  if (separation.status !== 'available') return separation
  const rowStep = Math.abs(to.row - from.row)
  const columnStep = Math.abs(to.column - from.column)
  if (rowStep > 1 || columnStep > 1 || rowStep + columnStep === 0) return { status: 'unavailable', reason: 'Terrain edges require distinct adjacent native source cells; endpoint-wide average grade is not a terrain profile.' }
  if (!Number.isFinite(slopeWeight) || slopeWeight < 0) return { status: 'unavailable', reason: 'The hypothetical slope weight must be finite and nonnegative.' }
  if (rowStep === 1 && columnStep === 1) {
    for (const [row, column] of [[from.row, to.column], [to.row, from.column]]) {
      const flank = getGridCell(grid, row, column)
      if (flank.status !== 'valid') return { status: 'unavailable', reason: `A diagonal flank is unavailable: ${flank.reason}` }
    }
  }
  const heightBlocker = terrainHeightDifferenceBlocker(grid)
  if (heightBlocker) return { status: 'unavailable', reason: heightBlocker }
  const riseM = separation.value.to.elevationM - separation.value.from.elevationM
  const grade = calculateGrade(riseM, separation.value.distanceM)
  if (grade.status !== 'available') return grade
  const cost = calculateTerrainCost(separation.value.distanceM, grade.value.ratio, slopeWeight)
  if (cost.status !== 'available') return cost
  return { status: 'available', value: { ...separation.value, riseM, grade: grade.value, cost: cost.value } }
}
