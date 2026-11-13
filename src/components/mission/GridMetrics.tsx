import type { GridSelection } from '../../features/mission/gridSelection'
import type { TerrainGrid } from '../../features/terrain/gridTypes'
import { measureGridSeparation } from '../../features/terrain/terrainMetrics'
import { terrainHeightDifferenceBlocker } from '../../data/terrainScience'

export function GridMetrics({ grid, selection }: { grid: TerrainGrid; selection: GridSelection }) {
  const mismatchedSource = [selection.origin, selection.destination].some((cell) => cell && cell.sourceId !== grid.manifest.source.productId)
  const result = mismatchedSource ? { status: 'unavailable' as const, reason: 'Selected endpoints do not belong to the loaded terrain source.' } : selection.origin && selection.destination ? measureGridSeparation(grid, selection.origin, selection.destination) : null
  const heightBlocker = terrainHeightDifferenceBlocker(grid)
  return <div className="grid-metrics" aria-labelledby="grid-metrics-heading">
    <h4 id="grid-metrics-heading">Endpoint geometry</h4>
    <div role="status">
      {!result ? <p className="helper">Select both grid endpoints to calculate their geometric separation.</p> : result.status === 'unavailable' ? <p className="source-warning">Distance unavailable: {result.reason}</p> : <>
        <dl><dt>Reference-sphere separation</dt><dd>{result.value.distanceM.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m</dd></dl>
        <p className="helper">Geometric distance between G-O and G-D. This checks endpoint cells only; it does not inspect the terrain between them.</p>
      </>}
    </div>
    <p className="source-warning">{heightBlocker ? 'DEM slopes and terrain costs unavailable: elevation height reference unresolved.' : 'Terrain arithmetic is validated. Route comparison still requires pathfinding.'}</p>
    <details className="selection-guidance"><summary>Distance model & calculation limits</summary>
      <p className="helper">Shortest surface arc on the documented 3,396,190 m Mars reference sphere, using native planetocentric cell centers. Elevations are not included. This is not a route length or a terrain profile.</p>
      <p className="helper">Grade and cost arithmetic is tested with synthetic fixtures. Real DEM results stay blocked until the numerical band’s height reference supports those calculations. Cost weights are hypothetical planning preferences, not measures of astronaut safety.</p>
    </details>
  </div>
}
