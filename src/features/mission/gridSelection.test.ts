/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import manifestText from '../../../public/data/jezero-terrain-grid.json?raw'
import { loadTerrainGrid } from '../terrain/loadTerrainGrid'
import type { TerrainGrid } from '../terrain/gridTypes'
import { assignGridEndpoint, initialGridSelection, swapGridEndpoints } from './gridSelection'
import type { GridSelection } from './gridSelection'
import type { EndpointRole } from './types'

let grid: TerrainGrid
let selected: GridSelection

beforeAll(async () => {
  const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url)))
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(manifestText, { headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response(binary, { headers: { 'Content-Type': 'application/octet-stream' } }))
  grid = await loadTerrainGrid(undefined, { fetcher })
  const origin = assignGridEndpoint(grid, initialGridSelection, 'origin', 650, 580)
  const destination = assignGridEndpoint(grid, origin.selection, 'destination', 800, 730)
  expect(origin.error).toBeNull()
  expect(destination.error).toBeNull()
  selected = Object.freeze(destination.selection)
})

describe('hypothetical native-grid endpoint selection', () => {
  it('starts with no endpoints', () => {
    expect(initialGridSelection).toEqual({ origin: null, destination: null })
  })

  it('chooses distinct real source-cell centers and retains their qualified data provenance', () => {
    expect(selected.origin).toMatchObject({ row: 650, column: 580, elevationM: -2401.48681640625, sourceId: grid.manifest.source.productId })
    expect(selected.destination).toMatchObject({ row: 800, column: 730, elevationM: -2542.51025390625, sourceId: grid.manifest.source.productId })
    expect(selected.origin?.lon).toBeCloseTo(77.3563331816264, 12)
    expect(selected.origin?.lat).toBeCloseTo(18.501707912668724, 12)
    expect(selected.destination?.lon).toBeCloseTo(77.40694499620072, 12)
    expect(selected.destination?.lat).toBeCloseTo(18.45109609809438, 12)
    expect(selected.origin?.row).not.toBe(selected.destination?.row)
    expect(selected.origin?.column).not.toBe(selected.destination?.column)
    expect(grid.manifest.source.heightReference).toBe('provider-declared-iau-sphere-unvalidated')
    expect(initialGridSelection).toEqual({ origin: null, destination: null })
  })

  it.each(['origin', 'destination'] as const)('replaces only a valid %s and leaves the previous selection intact', (role) => {
    const other: EndpointRole = role === 'origin' ? 'destination' : 'origin'
    const result = assignGridEndpoint(grid, selected, role, 714, 650)
    expect(result.error).toBeNull()
    expect(result.selection).not.toBe(selected)
    expect(result.selection[other]).toBe(selected[other])
    expect(result.selection[role]).toMatchObject({ row: 714, column: 650, elevationM: -2489.27978515625 })
    expect(result.selection[role]?.lon).toBeCloseTo(77.37995202842774, 12)
    expect(result.selection[role]?.lat).toBeCloseTo(18.48011353845034, 12)
    expect(selected.origin?.row).toBe(650)
    expect(selected.destination?.row).toBe(800)
  })

  it.each(['origin', 'destination'] as const)('rejects a %s duplicating the other cell and preserves both prior endpoints', (role) => {
    const other = selected[role === 'origin' ? 'destination' : 'origin']
    if (!other) throw new Error('The real fixture selection must have both endpoints')
    const result = assignGridEndpoint(grid, selected, role, other.row, other.column)
    expect(result.error).toMatch(/distinct grid cells/)
    expect(result.selection).toBe(selected)
    expect(result.selection.origin).toBe(selected.origin)
    expect(result.selection.destination).toBe(selected.destination)
  })

  it.each(['origin', 'destination'] as const)('preserves previous endpoints when the selected %s is outside the native crop', (role) => {
    for (const [row, column] of [[585, 522], [842, 777], [586, 521], [841, 778], [0, 0]]) {
      const result = assignGridEndpoint(grid, selected, role, row, column)
      expect(result.error).toMatch(/outside.*prototype terrain crop/)
      expect(result.selection).toBe(selected)
    }
  })

  it.each(['origin', 'destination'] as const)('preserves previous endpoints for invalid %s source indices', (role) => {
    for (const [row, column] of [[NaN, 650], [714, Infinity], [714.5, 650], [714, 650.5]]) {
      const result = assignGridEndpoint(grid, selected, role, row, column)
      expect(result.error).toMatch(/finite integer source rows and columns/)
      expect(result.selection).toBe(selected)
    }
  })

  it.each(['origin', 'destination'] as const)('preserves previous endpoints for synthetic test-only NoData at the proposed %s', (role) => {
    const synthetic = { manifest: grid.manifest, values: grid.values.slice() }
    synthetic.values[(700 - 586) * 256 + 700 - 522] = grid.manifest.sourceGrid.noData
    const result = assignGridEndpoint(synthetic, selected, role, 700, 700)
    expect(result.error).toMatch(/NoData; no interpolation or zero substitution/)
    expect(result.selection).toBe(selected)
    expect(result.selection[role]?.elevationM).not.toBe(0)
  })

  it.each(['origin', 'destination'] as const)('preserves previous endpoints for nonfinite synthetic test-only %s cells', (role) => {
    const synthetic = { manifest: grid.manifest, values: grid.values.slice() }
    for (const value of [NaN, Infinity, -Infinity]) {
      synthetic.values[(700 - 586) * 256 + 700 - 522] = value
      const result = assignGridEndpoint(synthetic, selected, role, 700, 700)
      expect(result.error).toMatch(/nonfinite/)
      expect(result.selection).toBe(selected)
    }
  })

  it('keeps an empty/partial selection unchanged after unsupported or missing candidates', () => {
    const partial = Object.freeze({ origin: selected.origin, destination: null })
    const outside = assignGridEndpoint(grid, partial, 'destination', 842, 650)
    expect(outside.selection).toBe(partial)
    const synthetic = { manifest: grid.manifest, values: new Float32Array(0) }
    const empty = assignGridEndpoint(synthetic, initialGridSelection, 'origin', 714, 650)
    expect(empty.error).toMatch(/storage.*dimensions/)
    expect(empty.selection).toBe(initialGridSelection)
  })

  it('swaps both endpoints without changing their exact native centers or source values', () => {
    const swapped = swapGridEndpoints(selected)
    expect(swapped.origin).toBe(selected.destination)
    expect(swapped.destination).toBe(selected.origin)
    expect(swapped).not.toBe(selected)
    expect(swapGridEndpoints(swapped)).toEqual(selected)
    expect(selected.origin?.row).toBe(650)
    expect(selected.destination?.row).toBe(800)
  })

  it('swaps partial and empty selections without inventing an endpoint', () => {
    const originOnly = Object.freeze({ origin: selected.origin, destination: null })
    expect(swapGridEndpoints(originOnly)).toEqual({ origin: null, destination: selected.origin })
    const destinationOnly = Object.freeze({ origin: null, destination: selected.destination })
    expect(swapGridEndpoints(destinationOnly)).toEqual({ origin: selected.destination, destination: null })
    expect(swapGridEndpoints(initialGridSelection)).toEqual(initialGridSelection)
    expect(originOnly.destination).toBeNull()
    expect(destinationOnly.origin).toBeNull()
  })
})
