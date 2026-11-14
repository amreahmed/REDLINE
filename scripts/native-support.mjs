/** Build-time comparison model for north-up spherical Eqc rasters with lat_ts=lon_0=0.
 * Samples are modelled as constant over their native footprints. This does not
 * assert actual within-cell terrain, effective resolution or independent accuracy.
 * No production terrain module imports this tool.
 */

/** @typedef {{westM:number,eastM:number,southM:number,northM:number}} Footprint */
/** @typedef {{rows:number,columns:number,westM:number,northM:number,spacingM:number,radiusM:number,samples:ArrayLike<number>,validity:ArrayLike<number>,noData?:number}} NativeGrid */

function checkFootprint(footprint) {
  if (!['westM', 'eastM', 'southM', 'northM'].every(edge => Number.isFinite(footprint[edge])) ||
      footprint.eastM <= footprint.westM || footprint.northM <= footprint.southM) {
    throw new Error('Footprint must have finite, ordered edges and positive area')
  }
}

/** Same geographic edges in a different spherical Eqc projection; not a height conversion.
 * @param {Footprint} footprint @param {number} fromRadiusM @param {number} toRadiusM
 * @returns {Footprint}
 */
export function reprojectSphericalEqcFootprint(footprint, fromRadiusM, toRadiusM) {
  checkFootprint(footprint)
  if (![fromRadiusM, toRadiusM].every(radius => Number.isFinite(radius) && radius > 0)) throw new Error('Invalid sphere radius')
  const ratio = toRadiusM / fromRadiusM
  const mapped = Object.fromEntries(Object.entries(footprint).map(([key, value]) => [key, value * ratio]))
  checkFootprint(mapped)
  return mapped
}

/** Strictly reject incomplete support and any covered invalid/nonfinite sample.
 * Surface area is R Δx (sin φnorth − sin φsouth), evaluated using the stable
 * sine-difference identity. No projected-area assumption or gap interpolation.
 * @param {NativeGrid} grid @param {Footprint} footprint
 * @returns {{status:'accepted',meanM:number,coveredCells:number,surfaceAreaM2:number}|{status:'rejected',reason:'outside-grid'|'missing-support'}}
 */
export function aggregateNativeFootprint(grid, footprint) {
  if (![grid.rows, grid.columns].every(size => Number.isSafeInteger(size) && size > 0) ||
      ![grid.westM, grid.northM].every(Number.isFinite) ||
      ![grid.spacingM, grid.radiusM].every(value => Number.isFinite(value) && value > 0) ||
      grid.samples.length !== grid.rows * grid.columns || grid.validity.length !== grid.samples.length) {
    throw new Error('Invalid native grid contract')
  }
  checkFootprint(footprint)
  const eastM = grid.westM + grid.columns * grid.spacingM
  const southM = grid.northM - grid.rows * grid.spacingM
  if (!Number.isFinite(eastM) || !Number.isFinite(southM) || grid.northM > Math.PI * grid.radiusM / 2 || southM < -Math.PI * grid.radiusM / 2) {
    throw new Error('Grid outside supported spherical latitude bounds')
  }
  if (footprint.westM < grid.westM || footprint.eastM > eastM || footprint.northM > grid.northM || footprint.southM < southM) {
    return { status: 'rejected', reason: 'outside-grid' }
  }
  const firstColumn = Math.floor((footprint.westM - grid.westM) / grid.spacingM)
  const lastColumn = Math.min(grid.columns, Math.ceil((footprint.eastM - grid.westM) / grid.spacingM))
  const firstRow = Math.floor((grid.northM - footprint.northM) / grid.spacingM)
  const lastRow = Math.min(grid.rows, Math.ceil((grid.northM - footprint.southM) / grid.spacingM))
  let areaSum = 0
  let weightedSum = 0
  let coveredCells = 0
  for (let row = firstRow; row < lastRow; row++) {
    const north = Math.min(footprint.northM, grid.northM - row * grid.spacingM)
    const south = Math.max(footprint.southM, grid.northM - (row + 1) * grid.spacingM)
    if (north <= south) continue
    for (let column = firstColumn; column < lastColumn; column++) {
      const west = Math.max(footprint.westM, grid.westM + column * grid.spacingM)
      const east = Math.min(footprint.eastM, grid.westM + (column + 1) * grid.spacingM)
      if (east <= west) continue
      const index = row * grid.columns + column
      const value = grid.samples[index]
      if (grid.validity[index] !== 1 || !Number.isFinite(value) || value === grid.noData) return { status: 'rejected', reason: 'missing-support' }
      const area = grid.radiusM * (east - west) * 2 * Math.cos((north + south) / (2 * grid.radiusM)) * Math.sin((north - south) / (2 * grid.radiusM))
      if (!Number.isFinite(area) || area <= 0) throw new Error('Invalid overlap surface area')
      areaSum += area
      weightedSum += area * value
      coveredCells++
    }
  }
  if (coveredCells === 0 || !Number.isFinite(weightedSum) || !Number.isFinite(areaSum) || areaSum <= 0) throw new Error('Invalid aggregation')
  return { status: 'accepted', meanM: weightedSum / areaSum, coveredCells, surfaceAreaM2: areaSum }
}
