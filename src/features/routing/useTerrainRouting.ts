import { useEffect, useMemo, useRef, useState } from 'react'
import type { GridSelection } from '../mission/gridSelection'
import type { RoutePoint } from './types'
import { loadHrscModel } from '../terrain/loadHrscModel'
import type { TerrainModelGrid, TerrainProfile } from '../terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE, modelNodeForCoordinateClamped, modelPoint, validateTerrainProfile } from '../terrain/terrainModel'
import { createTerrainRouteTask } from './terrainRouteTask'
import { findNearestTraversable } from './terrainRoutes'
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
  
  const rawOrigin = grid && selection.origin ? modelNodeForCoordinateClamped(grid, selection.origin.lon, selection.origin.lat) : null
  const rawDestination = grid && selection.destination ? modelNodeForCoordinateClamped(grid, selection.destination.lon, selection.destination.lat) : null
  const rawVia = grid && waypoint ? modelNodeForCoordinateClamped(grid, waypoint.lon, waypoint.lat) : null

  const origin = rawOrigin !== null && analysis ? findNearestTraversable(analysis, rawOrigin) : rawOrigin
  let destination = rawDestination !== null && analysis ? findNearestTraversable(analysis, rawDestination, origin ?? undefined) : rawDestination
  if (origin !== null && destination !== null && origin === destination && grid && analysis) {
    destination = findNearestTraversable(analysis, (origin + 1) % (grid.rows * grid.columns), origin)
  }
  const via = rawVia !== null && analysis && origin !== null && destination !== null ? findNearestTraversable(analysis, rawVia, origin) : rawVia

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
  const blocker: string | null = !grid ? 'Load the separately documented HRSC DEM first.' : !selection.origin || !selection.destination ? 'Choose grid origin and destination above.' : origin === destination ? 'Both endpoints fall in the same 50 m HRSC cell. Choose more widely separated endpoints.' : null
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
    const activeAnalysis = analyzeTerrainModel(activeGrid, profile)
    const rawActiveOrigin = selection.origin ? modelNodeForCoordinateClamped(activeGrid, selection.origin.lon, selection.origin.lat) : null
    const rawActiveDestination = selection.destination ? modelNodeForCoordinateClamped(activeGrid, selection.destination.lon, selection.destination.lat) : null
    if (rawActiveOrigin === null || rawActiveDestination === null) return

    const activeOrigin = findNearestTraversable(activeAnalysis, rawActiveOrigin)
    let activeDestination = findNearestTraversable(activeAnalysis, rawActiveDestination, activeOrigin)
    if (activeOrigin === activeDestination) {
      activeDestination = findNearestTraversable(activeAnalysis, (activeOrigin + 1) % (activeGrid.rows * activeGrid.columns), activeOrigin)
    }
    const rawActiveVia = waypoint ? modelNodeForCoordinateClamped(activeGrid, waypoint.lon, waypoint.lat) : null
    const activeVia = rawActiveVia !== null ? findNearestTraversable(activeAnalysis, rawActiveVia, activeOrigin) : null

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
