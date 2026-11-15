import type { RoutePoint } from '../routing/types'
import type { TerrainAnalysis, TerrainClassification, TerrainModelGrid, TerrainMovement, TerrainProfile } from './modelTypes'

export const DEFAULT_TERRAIN_PROFILE: TerrainProfile = {
  maxUphillDeg: 12, maxDownhillDeg: 18, maxRoughnessM: 12,
  roughnessRadiusM: 100, highCostFraction: 0.7,
  uphillWeight: 4, downhillWeight: 2, slopeWeight: 2, roughnessWeight: 3,
  unknownPolicy: 'block', unknownCostMultiplier: 10,
}

const DEG = Math.PI / 180
const HRSC_GRID_HASH = 'e385f36da8ea9137bdd7cece3ac858a64de1bbf5e036ecc01e942d7e9a5439f2'
// Preserved evidence-manifest digest, not a claim to have hashed the full TIFF.
const HRSC_EVIDENCE_HASH = '5d7c16b7589df237b3dbb45365cff2b94fc28ffd46764b336783f58bb60c4fdc'

export function validateTerrainProfile(profile: TerrainProfile): void {
  if (!profile || typeof profile !== 'object') throw new Error('A hypothetical terrain profile is required.')
  const bounded = (value: number, minimum: number, maximum: number, label: string) => {
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} is outside the supported hypothetical profile range.`)
  }
  bounded(profile.maxUphillDeg, 0.01, 89, 'Uphill grade limit')
  bounded(profile.maxDownhillDeg, 0.01, 89, 'Downhill grade limit')
  bounded(profile.maxRoughnessM, 0.01, 1000, 'Roughness limit')
  bounded(profile.roughnessRadiusM, 1, 250, 'Roughness neighborhood radius')
  bounded(profile.highCostFraction, 0.01, 1, 'High-cost threshold fraction')
  for (const name of ['uphillWeight', 'downhillWeight', 'slopeWeight', 'roughnessWeight'] as const) bounded(profile[name], 0, 100, name)
  bounded(profile.unknownCostMultiplier, 1, 1000, 'Unknown-support cost multiplier')
  if (profile.unknownPolicy !== 'block' && profile.unknownPolicy !== 'penalize') throw new Error('Unknown terrain policy must be block or penalize.')
}

/** Accepts only the separately reviewed HRSC native contract or explicit test fixtures. */
export function validateTerrainModelGrid(grid: TerrainModelGrid): void {
  if (!grid || typeof grid !== 'object') throw new Error('A numerical terrain model is required.')
  const integers = [grid.rows, grid.columns, grid.startRow, grid.startColumn]
  if (!integers.every(value => Number.isSafeInteger(value) && value >= 0) || grid.rows < 1 || grid.columns < 1 || grid.rows * grid.columns > 65536) throw new Error('Terrain model dimensions are outside supported native-grid bounds.')
  if (!(grid.values instanceof Float32Array) || !(grid.valid instanceof Uint8Array) || grid.values.length !== grid.rows * grid.columns || grid.valid.length !== grid.values.length) throw new Error('Terrain model samples and validity mask must match the native grid.')
  if (![grid.originXM, grid.originYM, grid.pixelWidthM, grid.pixelHeightM, grid.referenceRadiusM].every(Number.isFinite) || grid.pixelWidthM <= 0 || grid.pixelHeightM >= 0 || grid.referenceRadiusM <= 0) throw new Error('Terrain model requires a north-up equirectangular metre transform and positive reference radius.')
  const west = grid.originXM / grid.referenceRadiusM / DEG
  const east = (grid.originXM + grid.columns * grid.pixelWidthM) / grid.referenceRadiusM / DEG
  const north = grid.originYM / grid.referenceRadiusM / DEG
  const south = (grid.originYM + grid.rows * grid.pixelHeightM) / grid.referenceRadiusM / DEG
  if (west < -180 || east > 180 || south <= -90 || north >= 90) throw new Error('Terrain model extent must stay in its signed east-positive longitude and nonpolar latitude domain.')
  for (let node = 0; node < grid.values.length; node++) {
    if (grid.valid[node] !== 0 && grid.valid[node] !== 1) throw new Error('Terrain model validity mask must contain only zero or one.')
    if (grid.valid[node] === 1 && !Number.isFinite(grid.values[node])) throw new Error('A valid native terrain sample cannot be nonfinite.')
  }
  const source = grid.source
  if (!source || !['productId', 'gridHash', 'sourceHash', 'verticalReference', 'attribution', 'qualification'].every(key => typeof source[key as keyof typeof source] === 'string' && source[key as keyof typeof source].length > 0)) throw new Error('Terrain model provenance and persistent qualification are required.')
  if (source.authorization === 'synthetic-test') {
    if (!/^synthetic-/i.test(source.productId) || !/synthetic/i.test(source.qualification) || !/synthetic/i.test(source.attribution)) throw new Error('Test terrain must retain an explicit synthetic product identity, qualification and attribution.')
    return
  }
  if (source.authorization !== 'provider-dem-model' || source.productId !== 'HMC_13E10_DT5' || source.gridHash !== HRSC_GRID_HASH || source.sourceHash !== HRSC_EVIDENCE_HASH || source.verticalReference !== 'Positive-up height above the 3,396,000 m sphere (HRSC DT5)' || source.attribution !== 'Terrain data: ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO' || source.qualification !== 'Sphere-relative provider DEM model. Physical slope accuracy, local uncertainty, precise feature registration, hazards, and rover/human safety remain unverified.' || grid.referenceRadiusM !== 3396000 || grid.rows !== 103 || grid.columns !== 103 || grid.startRow !== 13605 || grid.startColumn !== 11661 || grid.originXM !== 4583825 || Math.abs(grid.originYM - 1097925.0000000002) > 1e-7 || grid.pixelWidthM !== 50 || grid.pixelHeightM !== -50) throw new Error('This source does not match the separately reviewed HRSC DEM-model contract. CTX physical-terrain gates remain unresolved.')
}

function validNode(grid: TerrainModelGrid, node: number): boolean {
  return Number.isSafeInteger(node) && node >= 0 && node < grid.rows * grid.columns
}

function location(grid: TerrainModelGrid, row: number, column: number): { lon: number; lat: number } {
  return { lon: (grid.originXM + (column + 0.5) * grid.pixelWidthM) / grid.referenceRadiusM / DEG, lat: (grid.originYM + (row + 0.5) * grid.pixelHeightM) / grid.referenceRadiusM / DEG }
}

export function modelPoint(grid: TerrainModelGrid, node: number): RoutePoint {
  if (!validNode(grid, node)) throw new Error('Terrain cell is outside native model coverage.')
  const row = Math.floor(node / grid.columns)
  const column = node % grid.columns
  return { row: row + grid.startRow, column: column + grid.startColumn, ...location(grid, row, column) }
}

export function modelNodeForCoordinate(grid: TerrainModelGrid, lon: number, lat: number): number | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
  const column = Math.floor((lon * DEG * grid.referenceRadiusM - grid.originXM) / grid.pixelWidthM)
  const row = Math.floor((lat * DEG * grid.referenceRadiusM - grid.originYM) / grid.pixelHeightM)
  return row >= 0 && row < grid.rows && column >= 0 && column < grid.columns ? row * grid.columns + column : null
}

export function modelNodeForCoordinateClamped(grid: TerrainModelGrid, lon: number, lat: number): number {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return Math.floor(grid.rows / 2) * grid.columns + Math.floor(grid.columns / 2)
  const rawCol = Math.floor((lon * DEG * grid.referenceRadiusM - grid.originXM) / grid.pixelWidthM)
  const rawRow = Math.floor((lat * DEG * grid.referenceRadiusM - grid.originYM) / grid.pixelHeightM)
  // Clamp to traversable interior (inset by 2 cells so we stay within verified derivative support)
  const minInset = 2
  const col = Math.max(minInset, Math.min(grid.columns - 1 - minInset, Number.isFinite(rawCol) ? rawCol : Math.floor(grid.columns / 2)))
  const row = Math.max(minInset, Math.min(grid.rows - 1 - minInset, Number.isFinite(rawRow) ? rawRow : Math.floor(grid.rows / 2)))
  return row * grid.columns + col
}

function sphereDistance(radius: number, a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const vector = (point: { lon: number; lat: number }) => {
    const cosine = Math.cos(point.lat * DEG)
    return [cosine * Math.cos(point.lon * DEG), cosine * Math.sin(point.lon * DEG), Math.sin(point.lat * DEG)]
  }
  const u = vector(a)
  const v = vector(b)
  const cross = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
  return radius * Math.atan2(cross, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])
}

/** Source-sphere arc, using this grid's radius rather than CTX's different radius. */
export function modelDistance(grid: TerrainModelGrid, from: number, to: number): number {
  return sphereDistance(grid.referenceRadiusM, modelPoint(grid, from), modelPoint(grid, to))
}

function hasHeight(grid: TerrainModelGrid, node: number): boolean {
  return validNode(grid, node) && grid.valid[node] === 1 && Number.isFinite(grid.values[node])
}

/** Validity requires the complete circular sample neighborhood, including native borders. */
function neighborhood(grid: TerrainModelGrid, node: number, radiusM: number): readonly number[] | null {
  const row = Math.floor(node / grid.columns)
  const column = node % grid.columns
  const center = location(grid, row, column)
  const north = Math.abs(grid.originYM / grid.referenceRadiusM)
  const south = Math.abs((grid.originYM + grid.rows * grid.pixelHeightM) / grid.referenceRadiusM)
  const rowReach = Math.min(grid.rows, Math.ceil(radiusM / Math.abs(grid.pixelHeightM)) + 1)
  const columnReach = Math.min(grid.columns, Math.ceil(radiusM / (grid.pixelWidthM * Math.cos(Math.max(north, south)))) + 1)
  const values: number[] = []
  for (let dy = -rowReach; dy <= rowReach; dy++) for (let dx = -columnReach; dx <= columnReach; dx++) {
    const sampleRow = row + dy
    const sampleColumn = column + dx
    if (sphereDistance(grid.referenceRadiusM, center, location(grid, sampleRow, sampleColumn)) > radiusM + 1e-7) continue
    if (sampleRow < 0 || sampleRow >= grid.rows || sampleColumn < 0 || sampleColumn >= grid.columns) return null
    const sample = sampleRow * grid.columns + sampleColumn
    if (!hasHeight(grid, sample)) return null
    values.push(grid.values[sample])
  }
  // A radius smaller than native spacing cannot measure neighborhood roughness.
  return values.length >= 3 ? values : null
}

/** Incomplete support cannot erase a hard restriction in another known metric. */
function exceedsKnownTerrainLimit(slopeDeg: number, roughnessM: number, profile: TerrainProfile): boolean {
  return (Number.isFinite(slopeDeg) && slopeDeg > Math.max(profile.maxUphillDeg, profile.maxDownhillDeg)) || (Number.isFinite(roughnessM) && roughnessM > profile.maxRoughnessM)
}

export function analyzeTerrainModel(grid: TerrainModelGrid, profile: TerrainProfile): TerrainAnalysis {
  validateTerrainModelGrid(grid)
  validateTerrainProfile(profile)
  const count = grid.values.length
  const slopeDeg = new Float32Array(count).fill(NaN)
  const roughnessM = new Float32Array(count).fill(NaN)
  const reliefM = new Float32Array(count).fill(NaN)
  const shapeM = new Float32Array(count).fill(NaN)
  const states = new Uint8Array(count)
  for (let node = 0; node < count; node++) {
    if (!hasHeight(grid, node)) continue
    const row = Math.floor(node / grid.columns)
    const column = node % grid.columns
    if (row > 0 && row < grid.rows - 1 && column > 0 && column < grid.columns - 1) {
      const west = node - 1
      const east = node + 1
      const north = node - grid.columns
      const south = node + grid.columns
      if ([west, east, north, south].every(neighbor => hasHeight(grid, neighbor))) {
        const eastRun = modelDistance(grid, west, east)
        const northRun = modelDistance(grid, north, south)
        if (eastRun > 0 && northRun > 0) {
          const eastGradient = (grid.values[east] - grid.values[west]) / eastRun
          const northGradient = (grid.values[north] - grid.values[south]) / northRun
          slopeDeg[node] = Math.atan(Math.hypot(eastGradient, northGradient)) / DEG
        }
      }
    }
    const samples = neighborhood(grid, node, profile.roughnessRadiusM)
    if (samples) {
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
      roughnessM[node] = Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length)
      let minimum = Infinity
      let maximum = -Infinity
      for (const sample of samples) { minimum = Math.min(minimum, sample); maximum = Math.max(maximum, sample) }
      reliefM[node] = maximum - minimum
      shapeM[node] = grid.values[node] - mean
    }
    if (exceedsKnownTerrainLimit(slopeDeg[node], roughnessM[node], profile)) { states[node] = 3; continue }
    if (!Number.isFinite(slopeDeg[node]) || !Number.isFinite(roughnessM[node])) continue
    const slopeFraction = slopeDeg[node] / Math.max(profile.maxUphillDeg, profile.maxDownhillDeg)
    const roughnessFraction = roughnessM[node] / profile.maxRoughnessM
    states[node] = Math.max(slopeFraction, roughnessFraction) >= profile.highCostFraction ? 2 : 1
  }
  return { grid, profile, slopeDeg, roughnessM, reliefM, shapeM, states }
}

const CLASSIFICATIONS: readonly TerrainClassification[] = ['UNKNOWN', 'TRAVERSABLE', 'HIGH_COST', 'BLOCKED']

function directMovement(analysis: TerrainAnalysis, from: number, to: number): TerrainMovement {
  const { grid, profile } = analysis
  const distanceM = modelDistance(grid, from, to)
  const restricted = (classification: 'BLOCKED' | 'UNKNOWN', reason: string): TerrainMovement => ({ classification, distanceM, riseM: null, gradeDeg: null, costM: null, reason })
  if (!hasHeight(grid, from) || !hasHeight(grid, to)) return restricted('UNKNOWN', 'Native height is missing; NoData is never traversed.')
  if (analysis.states[from] === 3 || analysis.states[to] === 3 || exceedsKnownTerrainLimit(analysis.slopeDeg[from], analysis.roughnessM[from], profile) || exceedsKnownTerrainLimit(analysis.slopeDeg[to], analysis.roughnessM[to], profile)) return restricted('BLOCKED', 'A cell exceeds the selected hypothetical terrain limits.')
  const riseM = grid.values[to] - grid.values[from]
  const gradeDeg = Math.atan2(riseM, distanceM) / DEG
  if (gradeDeg > profile.maxUphillDeg || -gradeDeg > profile.maxDownhillDeg) return restricted('BLOCKED', 'Directional DEM grade exceeds the selected uphill or downhill limit.')
  if (analysis.states[from] === 0 || analysis.states[to] === 0) {
    if (profile.unknownPolicy === 'block') return restricted('UNKNOWN', 'Derivative or neighborhood support is incomplete; unknown terrain is blocked.')
    return { classification: 'UNKNOWN', distanceM, riseM: null, gradeDeg: null, costM: distanceM * profile.unknownCostMultiplier, reason: 'Incomplete derivative support is explicitly penalized; terrain statistics remain incomplete.' }
  }
  const uphill = Math.max(0, gradeDeg) / profile.maxUphillDeg
  const downhill = Math.max(0, -gradeDeg) / profile.maxDownhillDeg
  const slope = Math.max(analysis.slopeDeg[from], analysis.slopeDeg[to]) / Math.max(profile.maxUphillDeg, profile.maxDownhillDeg)
  const roughness = Math.max(analysis.roughnessM[from], analysis.roughnessM[to]) / profile.maxRoughnessM
  const costM = distanceM * (1 + profile.uphillWeight * uphill + profile.downhillWeight * downhill + profile.slopeWeight * slope + profile.roughnessWeight * roughness)
  if (!Number.isFinite(costM) || costM < distanceM) return restricted('UNKNOWN', 'Terrain movement arithmetic is not a finite nonnegative cost.')
  const classification = Math.max(analysis.states[from], analysis.states[to]) === 2 || Math.max(uphill, downhill, slope, roughness) >= profile.highCostFraction ? 'HIGH_COST' : 'TRAVERSABLE'
  return { classification, distanceM, riseM, gradeDeg, costM }
}

/** Eight-neighbor directed edge, with both orthogonal ways around a corner checked. */
export function terrainMovement(analysis: TerrainAnalysis, from: number, to: number): TerrainMovement {
  const { grid } = analysis
  if (!validNode(grid, from) || !validNode(grid, to)) return { classification: 'UNKNOWN', distanceM: 0, riseM: null, gradeDeg: null, costM: null, reason: 'Movement is outside native coverage.' }
  const fromRow = Math.floor(from / grid.columns)
  const toRow = Math.floor(to / grid.columns)
  const fromColumn = from % grid.columns
  const toColumn = to % grid.columns
  const dy = Math.abs(fromRow - toRow)
  const dx = Math.abs(fromColumn - toColumn)
  if (dy > 1 || dx > 1 || (!dy && !dx)) return { classification: 'BLOCKED', distanceM: 0, riseM: null, gradeDeg: null, costM: null, reason: 'Only distinct adjacent native cells can be traversed.' }
  const result = directMovement(analysis, from, to)
  if (result.costM === null || !dx || !dy) return result
  const flanks = [fromRow * grid.columns + toColumn, toRow * grid.columns + fromColumn]
  for (const flank of flanks) {
    if (!hasHeight(grid, flank) || CLASSIFICATIONS[analysis.states[flank]] === 'BLOCKED' || directMovement(analysis, from, flank).costM === null || directMovement(analysis, flank, to).costM === null) return { classification: 'BLOCKED', distanceM: result.distanceM, riseM: null, gradeDeg: null, costM: null, reason: 'Diagonal movement cannot cut a blocked or unsupported corner.' }
  }
  return result
}
