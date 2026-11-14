/// <reference types="node" />
import { readFileSync } from 'node:fs'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import { describe, expect, it } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import { TERRAIN_SOURCE_HASH, TERRAIN_SOURCE_ID } from '../terrain/sampling'
import { decodeTerrainGrid, getGridCell, parseTerrainGridManifest, terrainGridBounds, TERRAIN_GRID_BINARY_SHA256 } from '../terrain/terrainGrid'
import type { HypotheticalRoute, RoutePoint } from '../routing/types'
import { createHypotheticalRouteFeatures, hypotheticalRouteStyle } from './routeOverlay'
import type { Bounds } from './types'

// Geometric test fixtures. No distance below is a claimed Mars observation.
const bounds: Bounds = [77, 18, 77.1, 18.1]
const point = (row: number, column: number): RoutePoint => ({ row, column, lon: bounds[0] + (column - 522 + 0.5) * (bounds[2] - bounds[0]) / 256, lat: bounds[3] - (row - 586 + 0.5) * (bounds[3] - bounds[1]) / 256 })
const route = (id: 'shortest' | 'via'): HypotheticalRoute => ({ id, name: id === 'shortest' ? 'Shortest path' : 'Via waypoint', points: [point(714, 650), point(714, 651), point(715, 652)], distanceM: 50, visitedCells: 4, sourceId: TERRAIN_SOURCE_ID, sourceHash: TERRAIN_SOURCE_HASH, gridHash: TERRAIN_GRID_BINARY_SHA256, model: 'hypothetical-distance-only', referenceRadiusM: 3396190 })

describe('hypothetical route overlay', () => {
  it('renders longitude-first computed path points and a separately identified user waypoint', () => {
    const routes = [route('shortest'), route('via')]
    const waypoint = point(714, 651)
    const features = createHypotheticalRouteFeatures(bounds, routes, 'via', waypoint)
    expect(features).toHaveLength(3)
    expect(features[0].getGeometry()).toBeInstanceOf(LineString)
    expect((features[0].getGeometry() as LineString).getCoordinates()).toEqual(routes[0].points.map(p => [p.lon, p.lat]))
    expect(features.map(feature => feature.get('routeRole'))).toEqual(['shortest', 'via', 'waypoint'])
    expect((features[2].getGeometry() as Point).getCoordinates()).toEqual([waypoint.lon, waypoint.lat])
    expect(features[1].get('selected')).toBe(true)
    expect(features[0].get('selected')).toBe(false)
  })

  it('rejects mismatched sources, nonfinite lengths, truncated paths, jumps and non-native points', () => {
    const original = route('shortest')
    const invalid = [
      { ...original, sourceId: 'unsupported' }, { ...original, sourceHash: 'unsupported' },
      { ...original, gridHash: 'unsupported' }, { ...original, distanceM: NaN },
      { ...original, distanceM: -1 }, { ...original, distanceM: 0 },
      { ...original, visitedCells: NaN }, { ...original, visitedCells: 0 },
      { ...original, points: [point(714, 650)] },
      { ...original, points: [point(714, 650), point(716, 653)] },
      { ...original, points: [point(714, 650), { ...point(714, 651), lon: 77.9 }] },
      { ...original, points: [point(714, 650), { ...point(714, 651), lat: Infinity }] },
      { ...original, points: [point(714, 650), point(714, 650)] },
      { ...original, points: [point(714, 650), point(714, 650.5)] },
    ]
    for (const candidate of invalid) expect(createHypotheticalRouteFeatures(bounds, [candidate], 'shortest', null)).toEqual([])
    expect(createHypotheticalRouteFeatures(null, [original], 'shortest', null)).toEqual([])
    expect(createHypotheticalRouteFeatures([77.1, 18, 77, 18.1], [original], 'shortest', null)).toEqual([])
  })

  it('copies path/waypoint geometry and excludes invalid or duplicate waypoint/route inputs', () => {
    const original = route('shortest')
    const waypoint = point(714, 651)
    const features = createHypotheticalRouteFeatures(bounds, [original, original], null, waypoint)
    expect(features).toHaveLength(2)
    ;(features[0].getGeometry() as LineString).setCoordinates([[0, 0], [1, 1]])
    ;(features[1].getGeometry() as Point).setCoordinates([0, 0])
    expect(original.points[0]).toEqual(point(714, 650))
    expect(waypoint).toEqual(point(714, 651))
    expect(createHypotheticalRouteFeatures(bounds, [], null, point(585, 650))).toEqual([])
  })

  it('accepts exact existing native centers at crop edges without changing their coordinates or values', () => {
    const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
    const grid = decodeTerrainGrid(parseTerrainGridManifest(sourceManifest), binary)
    const originalValues = grid.values.slice()
    for (const [row, column, nextRow, nextColumn] of [[586, 522, 586, 523], [841, 776, 841, 777], [714, 650, 715, 651]]) {
      const first = getGridCell(grid, row, column)
      const second = getGridCell(grid, nextRow, nextColumn)
      if (first.status !== 'valid' || second.status !== 'valid') throw new Error('Native fixture has no cell support')
      const computed = { ...route('shortest'), points: [first.cell, second.cell] }
      const features = createHypotheticalRouteFeatures(terrainGridBounds(grid), [computed], 'shortest', second.cell)
      expect(features).toHaveLength(2)
      expect((features[0].getGeometry() as LineString).getCoordinates()).toEqual([[first.cell.lon, first.cell.lat], [second.cell.lon, second.cell.lat]])
    }
    expect(grid.values).toHaveLength(65536)
    expect(grid.values).toEqual(originalValues)
  })

  it('allows a via path to revisit a cell when two waypoint legs share a stem', () => {
    const via = { ...route('via'), points: [point(714, 650), point(714, 651), point(713, 651), point(714, 651), point(715, 652)] }
    expect(createHypotheticalRouteFeatures(bounds, [via], 'via', point(713, 651))).toHaveLength(2)
  })

  it('distinguishes paths with solid/dashed strokes, selection weight and plain-text labels', () => {
    const features = createHypotheticalRouteFeatures(bounds, [route('shortest'), route('via')], 'shortest', point(714, 651))
    const shortest = hypotheticalRouteStyle(features[0])
    const via = hypotheticalRouteStyle(features[1])
    const waypoint = hypotheticalRouteStyle(features[2])
    expect(shortest[1].getStroke()?.getLineDash()).toBeNull()
    expect(via[1].getStroke()?.getLineDash()).toEqual([8, 6])
    expect(shortest[1].getStroke()?.getWidth()).toBeGreaterThan(via[1].getStroke()!.getWidth()!)
    expect(shortest[1].getText()?.getText()).toContain('hypothetical')
    expect(waypoint[0].getText()?.getText()).toBe('W · Hypothetical waypoint')
  })
})
