import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlanningTerrainState } from '../mission/useGridPlanning'
import type { GridSelection } from '../mission/gridSelection'
import { getGridCell } from '../terrain/terrainGrid'
import type { GridIndices } from '../terrain/terrainMetrics'
import type { HypotheticalRoute, RouteComparison, RoutePoint } from './types'
import { createRouteTask } from './routeTask'

type State = { phase: 'idle' } | { phase: 'loading' } | { phase: 'error'; reason: string } | { phase: 'ready'; comparison: RouteComparison }
const IDLE_STATE: State = { phase: 'idle' }
const EMPTY_ROUTES: readonly HypotheticalRoute[] = []

export function useDistanceRouting(terrain: PlanningTerrainState, selection: GridSelection) {
  const [waypoint, setWaypoint] = useState<GridIndices | null>(null)
  const [waypointNotice, setWaypointNotice] = useState<string | null>(null)
  const [stored, setStored] = useState<{ key: object | null; state: State }>({ key: null, state: { phase: 'idle' } })
  const [selectedId, setSelectedId] = useState<'shortest' | 'via'>('shortest')
  const taskRef = useRef<ReturnType<typeof createRouteTask> | null>(null)
  const grid = terrain.phase === 'ready' ? terrain.grid : null
  // Bind results to this loaded grid instance as well as native control indices.
  // A replacement grid must cancel its worker even when its checksum is equal.
  const key = useMemo(() => ({ grid, phase: terrain.phase, originRow: selection.origin?.row, originColumn: selection.origin?.column, destinationRow: selection.destination?.row, destinationColumn: selection.destination?.column, waypointRow: waypoint?.row, waypointColumn: waypoint?.column }), [grid, terrain.phase, selection.origin?.row, selection.origin?.column, selection.destination?.row, selection.destination?.column, waypoint?.row, waypoint?.column])
  useEffect(() => () => { taskRef.current?.cancel(); taskRef.current = null }, [key])
  const state: State = stored.key === key ? stored.state : IDLE_STATE
  let blocker: string | null = null
  let waypointPoint: RoutePoint | null = null
  if (terrain.phase !== 'ready') blocker = 'Load the planning terrain first.'
  else if (!selection.origin || !selection.destination) blocker = 'Choose distinct grid origin and destination cells first.'
  else if (waypoint) {
    const cell = getGridCell(terrain.grid, waypoint.row, waypoint.column)
    if (cell.status !== 'valid') blocker = `Waypoint: ${cell.reason}`
    else {
      waypointPoint = { row: cell.cell.row, column: cell.cell.column, lon: cell.cell.lon, lat: cell.cell.lat }
      if ([selection.origin, selection.destination].some(endpoint => endpoint.row === waypoint.row && endpoint.column === waypoint.column)) blocker = 'The optional waypoint must differ from both endpoints. Clear or change it.'
    }
  }
  const assignWaypoint = (row: number, column: number) => {
    if (terrain.phase !== 'ready') { setWaypointNotice('Load the planning terrain before selecting a waypoint.'); return }
    const cell = getGridCell(terrain.grid, row, column)
    if (cell.status !== 'valid') { setWaypointNotice(cell.reason); return }
    if ([selection.origin, selection.destination].some(endpoint => endpoint?.row === row && endpoint.column === column)) { setWaypointNotice('Choose a waypoint distinct from both endpoints. The previous waypoint is retained.'); return }
    setWaypoint({ row, column })
    setWaypointNotice(`User-selected waypoint at native row ${row}, column ${column}. Recalculate to compare.`)
  }
  const clearWaypoint = () => { setWaypoint(null); setWaypointNotice(null) }
  const calculate = async () => {
    if (blocker || terrain.phase !== 'ready' || !selection.origin || !selection.destination) return
    taskRef.current?.cancel()
    const task = createRouteTask({ grid: terrain.grid, origin: selection.origin, destination: selection.destination, waypoint }, () => new Worker(new URL('./routeWorker.ts', import.meta.url), { type: 'module' }))
    taskRef.current = task
    setStored({ key, state: { phase: 'loading' } })
    const result = await task.result
    if (taskRef.current !== task) return
    taskRef.current = null
    setSelectedId('shortest')
    setStored({ key, state: result.status === 'available' ? { phase: 'ready', comparison: result.value } : { phase: 'error', reason: result.reason } })
  }
  const cancel = () => { taskRef.current?.cancel(); taskRef.current = null; setStored({ key, state: { phase: 'idle' } }) }
  const routes = useMemo(() => state.phase === 'ready' ? [state.comparison.shortest, ...(state.comparison.via ? [state.comparison.via] : [])] : EMPTY_ROUTES, [state])
  return { state, blocker, waypoint, waypointPoint, waypointNotice, assignWaypoint, clearWaypoint, calculate, cancel, routes, selectedId, selectRoute: setSelectedId }
}
