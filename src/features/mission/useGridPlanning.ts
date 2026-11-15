import { useCallback, useEffect, useRef, useState } from 'react'
import { loadTerrainGrid } from '../terrain/loadTerrainGrid'
import { gridCellForCoordinate } from '../terrain/terrainGrid'
import type { TerrainGrid } from '../terrain/gridTypes'
import type { EndpointRole } from './types'
import { assignGridEndpoint, initialGridSelection, swapGridEndpoints } from './gridSelection'

export type PlanningTerrainState = { phase: 'idle' | 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; grid: TerrainGrid }

/** Planning selections remain independent of approximate Gazetteer references. */
export function useGridPlanning() {
  const [terrain, setTerrain] = useState<PlanningTerrainState>({ phase: 'idle' })
  const [selection, setSelection] = useState(initialGridSelection)
  const [pickRole, setPickRole] = useState<EndpointRole | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const load = async (): Promise<TerrainGrid | null> => {
    if (terrain.phase === 'ready') return terrain.grid
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setTerrain({ phase: 'loading' })
    try {
      const grid = await loadTerrainGrid(controller.signal)
      if (controller.signal.aborted) return null
      setTerrain({ phase: 'ready', grid })
      return grid
    } catch (error) {
      if (!controller.signal.aborted) setTerrain({ phase: 'error', message: error instanceof Error ? error.message : 'Planning terrain could not load.' })
      return null
    }
  }

  // Auto-load planning grid on mount so presets and coordinates work immediately
  useEffect(() => {
    if (terrain.phase === 'idle') {
      void load()
    }
  }, [terrain.phase])

  const assign = useCallback(async (role: EndpointRole, row: number, column: number) => {
    let activeGrid = terrain.phase === 'ready' ? terrain.grid : null
    if (!activeGrid) {
      activeGrid = await load()
    }
    if (!activeGrid) return
    setSelection(prevSelection => {
      const result = assignGridEndpoint(activeGrid, prevSelection, role, row, column)
      setNotice(result.error ?? `Hypothetical ${role} selected at native row ${row}, column ${column}.`)
      return result.selection
    })
    setPickRole(null)
  }, [terrain])

  const pickCoordinate = useCallback((coordinate: readonly [number, number]) => {
    if (terrain.phase !== 'ready' || !pickRole) return
    const result = gridCellForCoordinate(terrain.grid, coordinate)
    if (result.status !== 'valid') { setNotice(result.reason); return }
    assign(pickRole, result.cell.row, result.cell.column)
  }, [terrain, pickRole, assign])

  const beginPick = (role: EndpointRole) => {
    setPickRole(role)
    setNotice(`Choose ${role}: click inside the terrain boundary, or pan the map and use its center. The containing native cell center is selected.`)
  }
  const cancelPick = useCallback(() => { setPickRole(null); setNotice(null) }, [])
  const swap = () => { setSelection(swapGridEndpoints(selection)); setPickRole(null); setNotice(null) }
  const clear = () => { setSelection(initialGridSelection); setPickRole(null); setNotice(null) }
  return { terrain, selection, pickRole, notice, load, assign, pickCoordinate, beginPick, cancelPick, swap, clear }
}
