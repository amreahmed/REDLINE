import { useEffect, useMemo, useRef, useState } from 'react'
import type { GridSelection } from '../mission/gridSelection'
import type { RoutePoint } from './types'
import { loadHrscModel } from '../terrain/loadHrscModel'
import type { TerrainModelGrid, TerrainProfile } from '../terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE, modelNodeForCoordinate, modelPoint, validateTerrainProfile } from '../terrain/terrainModel'
import { createTerrainRouteTask } from './terrainRouteTask'
import type { TerrainComparison } from './terrainRoutes'
import type { TerrainOverlayMode, TerrainMapDisplay } from '../map/terrainModelOverlay'

type DataState = { phase: 'idle' | 'loading' } | { phase: 'error'; reason: string } | { phase: 'ready'; grid: TerrainModelGrid }
type RouteState = { phase: 'idle' | 'loading' } | { phase: 'error'; reason: string } | { phase: 'ready'; comparison: TerrainComparison }
const IDLE: RouteState = { phase: 'idle' }

export function useTerrainRouting(selection: GridSelection, waypoint: RoutePoint | null) {
  const [data, setData] = useState<DataState>({ phase: 'idle' })
  const [profile, setProfile] = useState<TerrainProfile>(DEFAULT_TERRAIN_PROFILE)
  const [selected, setSelected] = useState<'distance' | 'terrain'>('terrain')
  const [overlay, setOverlay] = useState<TerrainOverlayMode>('traversability')
  const [visible, setVisible] = useState(true)
  const [stored, setStored] = useState<{ key: object | null; signature: string | null; state: RouteState }>({ key: null, signature: null, state: IDLE })
  const loadRef = useRef<AbortController | null>(null)
  const taskRef = useRef<ReturnType<typeof createTerrainRouteTask> | null>(null)
  const grid = data.phase === 'ready' ? data.grid : null
  const analysis = useMemo(() => grid ? analyzeTerrainModel(grid, profile) : null, [grid, profile])
  const origin = grid && selection.origin ? modelNodeForCoordinate(grid, selection.origin.lon, selection.origin.lat) : null
  const destination = grid && selection.destination ? modelNodeForCoordinate(grid, selection.destination.lon, selection.destination.lat) : null
  const via = grid && waypoint ? modelNodeForCoordinate(grid, waypoint.lon, waypoint.lat) : null
  const key = useMemo(() => ({ grid, profile, origin, destination, via, originLon: selection.origin?.lon, originLat: selection.origin?.lat, destinationLon: selection.destination?.lon, destinationLat: selection.destination?.lat, waypointLon: waypoint?.lon, waypointLat: waypoint?.lat }), [grid, profile, origin, destination, via, selection.origin?.lon, selection.origin?.lat, selection.destination?.lon, selection.destination?.lat, waypoint?.lon, waypoint?.lat])
  
  const currentSignature = useMemo(() => `${grid ? grid.source.gridHash : 'pending'}|${profile.maxUphillDeg},${profile.maxDownhillDeg},${profile.maxRoughnessM},${profile.unknownPolicy}|${selection.origin?.lon},${selection.origin?.lat}|${selection.destination?.lon},${selection.destination?.lat}|${waypoint?.lon},${waypoint?.lat}`, [grid, profile, selection, waypoint])

  useEffect(() => () => { taskRef.current?.cancel(); taskRef.current = null }, [key])
  useEffect(() => () => { loadRef.current?.abort(); taskRef.current?.cancel() }, [])

  // Auto-load HRSC DEM model on mount so it is immediately ready
  useEffect(() => {
    if (data.phase === 'idle') {
      void load()
    }
  }, [data.phase])

  const state = (stored.key === key || stored.signature === currentSignature) ? stored.state : IDLE
  let blocker: string | null = !grid ? 'Load the separately documented HRSC DEM first.' : !selection.origin || !selection.destination ? 'Choose grid origin and destination above.' : origin === null || destination === null ? 'One endpoint is outside HRSC native coverage.' : origin === destination ? 'Both endpoints fall in the same 50 m HRSC cell. Choose more widely separated endpoints.' : waypoint && via === null ? 'The waypoint is outside HRSC coverage.' : null
  if (!blocker && via !== null && (via === origin || via === destination)) blocker = 'The waypoint falls in an endpoint’s 50 m HRSC cell. Clear it or choose a more widely separated waypoint.'
  if (!blocker && analysis) for (const [node, label] of [[origin, 'Origin'], [destination, 'Destination'], [via, 'Waypoint']] as const) {
    if (node === null) continue
    if (!grid!.valid[node] || analysis.states[node] === 3 || (analysis.states[node] === 0 && profile.unknownPolicy === 'block')) { blocker = `${label} is blocked or has incomplete metric support under this profile. Change the endpoint or review the assumptions.`; break }
  }
  const load = async (): Promise<TerrainModelGrid | null> => {
    loadRef.current?.abort()
    const abort = new AbortController()
    loadRef.current = abort
    setData({ phase: 'loading' })
    try {
      const loaded = await loadHrscModel({ signal: abort.signal })
      if (loadRef.current !== abort || abort.signal.aborted) return null
      setData({ phase: 'ready', grid: loaded }); setVisible(true)
      return loaded
    } catch (error) {
      if (loadRef.current === abort && !abort.signal.aborted) setData({ phase: 'error', reason: error instanceof Error ? error.message : 'HRSC DEM unavailable.' })
      return null
    } finally { if (loadRef.current === abort) loadRef.current = null }
  }
  const applyProfile = (next: TerrainProfile) => { validateTerrainProfile(next); setProfile({ ...next }) }
  const calculate = async () => {
    let activeGrid = grid
    if (!activeGrid) {
      activeGrid = await load()
    }
    if (!activeGrid) return
    const activeOrigin = selection.origin ? modelNodeForCoordinate(activeGrid, selection.origin.lon, selection.origin.lat) : null
    const activeDestination = selection.destination ? modelNodeForCoordinate(activeGrid, selection.destination.lon, selection.destination.lat) : null
    const activeVia = waypoint ? modelNodeForCoordinate(activeGrid, waypoint.lon, waypoint.lat) : null
    if (activeOrigin === null || activeDestination === null || activeOrigin === activeDestination) return

    taskRef.current?.cancel()
    const task = createTerrainRouteTask({ grid: activeGrid, profile, origin: activeOrigin, destination: activeDestination, waypoint: activeVia }, () => new Worker(new URL('./terrainRouteWorker.ts', import.meta.url), { type: 'module' }))
    taskRef.current = task
    const sig = `${activeGrid.source.gridHash}|${profile.maxUphillDeg},${profile.maxDownhillDeg},${profile.maxRoughnessM},${profile.unknownPolicy}|${selection.origin?.lon},${selection.origin?.lat}|${selection.destination?.lon},${selection.destination?.lat}|${waypoint?.lon},${waypoint?.lat}`
    setStored({ key, signature: sig, state: { phase: 'loading' } })
    const result = await task.result
    if (taskRef.current !== task) return
    taskRef.current = null
    setStored({ key, signature: sig, state: result.status === 'available' ? { phase: 'ready', comparison: result.comparison } : { phase: 'error', reason: result.reason } })
    setSelected('terrain'); setVisible(true)
  }
  const cancel = () => { taskRef.current?.cancel(); taskRef.current = null; setStored({ key, signature: null, state: IDLE }) }
  const comparison = state.phase === 'ready' ? state.comparison : null
  const display: TerrainMapDisplay | null = useMemo(() => visible && analysis ? { analysis, comparison, selected, overlay } : null, [visible, analysis, comparison, selected, overlay])
  return { data, profile, analysis, state, blocker, load, applyProfile, calculate, cancel, selected, selectRoute: setSelected, overlay, setOverlay, visible, setVisible, display,
    originPoint: grid && origin !== null ? modelPoint(grid, origin) : null, destinationPoint: grid && destination !== null ? modelPoint(grid, destination) : null }
}
