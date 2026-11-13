import { getGridCell } from '../terrain/terrainGrid'
import type { GridCell, TerrainGrid } from '../terrain/gridTypes'
import type { EndpointRole } from './types'

export type GridSelection = { readonly origin: GridCell | null; readonly destination: GridCell | null }
export const initialGridSelection: GridSelection = { origin: null, destination: null }

/** Only a validated native cell can become a hypothetical planning endpoint. */
export function assignGridEndpoint(grid: TerrainGrid, selection: GridSelection, role: EndpointRole, row: number, column: number): { selection: GridSelection; error: string | null } {
  const result = getGridCell(grid, row, column)
  if (result.status !== 'valid') return { selection, error: result.reason }
  const other = selection[role === 'origin' ? 'destination' : 'origin']
  if (other?.row === row && other.column === column && other.sourceId === result.cell.sourceId) return { selection, error: 'Choose distinct grid cells for origin and destination. The previous endpoints are retained.' }
  return { selection: { ...selection, [role]: result.cell }, error: null }
}

export function swapGridEndpoints(selection: GridSelection): GridSelection {
  return { origin: selection.destination, destination: selection.origin }
}
