import { readFileSync } from 'node:fs'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import { describe, expect, it } from 'vitest'
import type { TerrainAnalysis, TerrainModelGrid } from '../terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE, modelPoint, terrainMovement } from '../terrain/terrainModel'
import { decodeHrscModel, parseHrscModelManifest } from '../terrain/hrscModel'
import { calculateTerrainComparison } from '../routing/terrainRoutes'
import type { TerrainComparison } from '../routing/terrainRoutes'
import { terrainModelExtent, terrainModelRouteFeatures, terrainModelRouteStyle, terrainOverlayPixels } from './terrainModelOverlay'
import type { TerrainMapDisplay } from './terrainModelOverlay'

/** Deterministic geometry/obstacle tests only; never supplied as real Mars terrain. */
function fixture(): TerrainAnalysis {
  const grid: TerrainModelGrid = {
    rows: 9, columns: 9, startRow: 100, startColumn: 200,
    originXM: -45, originYM: 45, pixelWidthM: 10, pixelHeightM: -10, referenceRadiusM: 3396000,
    values: new Float32Array(81), valid: new Uint8Array(81).fill(1),
    source: { productId: 'synthetic-overlay-test', gridHash: 'test-grid', sourceHash: 'test-source', verticalReference: 'Synthetic sphere-relative metres', attribution: 'Synthetic test fixture', qualification: 'Synthetic geometry tests, not Mars data', authorization: 'synthetic-test' },
  }
  return analyzeTerrainModel(grid, { ...DEFAULT_TERRAIN_PROFILE, roughnessRadiusM: 11 })
}

function routes(analysis: TerrainAnalysis): TerrainComparison {
  const result = calculateTerrainComparison(analysis, 20, 60)
  if (result.status !== 'available') throw new Error(result.reason)
  return result.value
}

function display(analysis = fixture(), comparison: TerrainComparison | null = null): TerrainMapDisplay {
  return { analysis, comparison, selected: 'terrain', overlay: 'traversability' }
}

const pixel = (pixels: Uint8ClampedArray, node: number) => Array.from(pixels.slice(node * 4, node * 4 + 4))

describe('native terrain raster and exact route rendering', () => {
  it('matches the independently recorded HRSC native outer-edge extent', () => {
    const bytes = Uint8Array.from(readFileSync('public/data/hrsc-terrain-model.i16'))
    const mask = Uint8Array.from(readFileSync('public/data/hrsc-terrain-model.u8'))
    const manifest = parseHrscModelManifest(JSON.parse(readFileSync('public/data/hrsc-terrain-model.json', 'utf8')))
    const grid = decodeHrscModel(manifest, bytes.buffer, mask.buffer)
    const analysis = analyzeTerrainModel(grid, DEFAULT_TERRAIN_PROFILE)
    const extent = terrainModelExtent(analysis)
    const expected = [77.33622689238946, 18.43680667179286, 77.4231153683884, 18.52369514779179]
    extent.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 11))
    const northWest = modelPoint(grid, 0)
    expect(northWest.lon).toBeCloseTo(extent[0] + (extent[2] - extent[0]) / 206, 11)
    expect(northWest.lat).toBeCloseTo(extent[3] - (extent[3] - extent[1]) / 206, 11)
    expect(terrainOverlayPixels(display(analysis))).toHaveLength(10609 * 4)
  })

  it('uses exactly one row-major pixel per native cell and distinguishes every classification', () => {
    const analysis = fixture()
    analysis.states.set([0, 1, 2, 3], 36)
    const pixels = terrainOverlayPixels(display(analysis))
    expect(pixels).toHaveLength(81 * 4)
    expect(pixel(pixels, 36)).toEqual([117, 130, 138, 145])
    expect(pixel(pixels, 37)).toEqual([71, 173, 168, 145])
    expect(pixel(pixels, 38)).toEqual([229, 176, 87, 145])
    expect(pixel(pixels, 39)).toEqual([215, 98, 83, 145])
    expect(pixel(pixels, 0)).toEqual([117, 130, 138, 145])
  })

  it.each(['elevation', 'slope', 'roughness', 'shape'] as const)('retains missing cells in the exact pixel position for %s', overlay => {
    const analysis = fixture()
    analysis.grid.valid[30] = 0
    analysis.grid.values[30] = NaN
    analysis.slopeDeg[30] = NaN
    analysis.roughnessM[30] = NaN
    analysis.shapeM[30] = NaN
    const pixels = terrainOverlayPixels({ ...display(analysis), overlay })
    expect(pixel(pixels, 30)).toEqual([117, 130, 138, 145])
    expect(pixel(pixels, 40)).not.toEqual(pixel(pixels, 30))
    expect(pixels).toHaveLength(81 * 4)
  })

  it('renders constant finite heights without a divide-by-zero color or changing native values', () => {
    const analysis = fixture()
    const before = analysis.grid.values.slice()
    const pixels = terrainOverlayPixels({ ...display(analysis), overlay: 'elevation' })
    expect(pixel(pixels, 40)).toEqual([145, 155, 122, 145])
    expect(analysis.grid.values).toEqual(before)
    expect(terrainOverlayPixels({ ...display(analysis), overlay: 'none' }).every(value => value === 0)).toBe(true)
  })

  it('shows only cells actually expanded by the selected objective', () => {
    const analysis = fixture()
    const comparison = routes(analysis)
    const pixels = terrainOverlayPixels({ ...display(analysis, comparison), overlay: 'explored' })
    const expanded = new Set(comparison.terrain.exploredNodes)
    for (let node = 0; node < analysis.grid.values.length; node++) expect(pixel(pixels, node)).toEqual(expanded.has(node) ? [160, 183, 213, 100] : [0, 0, 0, 0])
    expect(terrainOverlayPixels({ ...display(analysis), overlay: 'explored' }).every(value => value === 0)).toBe(true)
  })

  it('renders every returned cell, preserving intermediate points around a blocked test region', () => {
    const analysis = fixture()
    analysis.states[40] = 3
    const comparison = routes(analysis)
    const features = terrainModelRouteFeatures(display(analysis, comparison))
    expect(features).toHaveLength(4)
    for (const role of ['distance', 'terrain'] as const) {
      const route = comparison[role]
      const feature = features.find(item => item.get('terrainRole') === role)!
      expect(feature.getGeometry()).toBeInstanceOf(LineString)
      const coordinates = (feature.getGeometry() as LineString).getCoordinates()
      expect(coordinates).toEqual(route.points.map(point => [point.lon, point.lat]))
      expect(coordinates.length).toBe(route.nodes.length)
      expect(coordinates.length).toBeGreaterThan(2)
      expect(route.nodes).not.toContain(40)
      for (let index = 1; index < route.nodes.length; index++) expect(terrainMovement(analysis, route.nodes[index - 1], route.nodes[index]).costM).not.toBeNull()
    }
    const endpoints = features.filter(item => item.get('terrainRole') === 'endpoint')
    expect((endpoints[0].getGeometry() as Point).getCoordinates()).toEqual([comparison.terrain.points[0].lon, comparison.terrain.points[0].lat])
    expect((endpoints[1].getGeometry() as Point).getCoordinates()).toEqual([comparison.terrain.points.at(-1)!.lon, comparison.terrain.points.at(-1)!.lat])
    expect(terrainModelRouteFeatures(display(analysis))).toEqual([])
  })

  it('rejects a simplified jump instead of drawing a segment across the terrain', () => {
    const analysis = fixture()
    const comparison = routes(analysis)
    const original = comparison.terrain
    const simplified = { ...original, nodes: [original.nodes[0], original.nodes.at(-1)!], points: [original.points[0], original.points.at(-1)!] }
    const features = terrainModelRouteFeatures(display(analysis, { ...comparison, terrain: simplified }))
    expect(features.map(feature => feature.get('terrainRole'))).toEqual(['distance'])
  })

  it('suppresses malformed selected polylines and endpoints without throwing', () => {
    const analysis = fixture()
    const comparison = routes(analysis)
    const original = comparison.terrain
    const invalid = [
      { ...original, nodes: [], points: [] },
      { ...original, nodes: [original.nodes[0]], points: [original.points[0]] },
      { ...original, nodes: [999999, ...original.nodes.slice(1)] },
      { ...original, points: [{ ...original.points[0], lon: Infinity }, ...original.points.slice(1)] },
      { ...original, source: { ...original.source, gridHash: 'different-grid' } },
      { ...original, points: original.points.slice(1) },
    ]
    for (const route of invalid) {
      const features = terrainModelRouteFeatures(display(analysis, { ...comparison, terrain: route }))
      expect(features.map(feature => feature.get('terrainRole'))).toEqual(['distance'])
    }
  })

  it('rejects a previously computed path if a current movement becomes blocked', () => {
    const analysis = fixture()
    const comparison = routes(analysis)
    analysis.states[comparison.terrain.nodes[1]] = 3
    const features = terrainModelRouteFeatures(display(analysis, comparison))
    expect(features.some(feature => feature.get('terrainRole') === 'terrain')).toBe(false)
    expect(features.some(feature => feature.get('terrainRole') === 'endpoint')).toBe(false)
  })

  it('copies geometry and differentiates objective, selection and endpoint labels accessibly', () => {
    const analysis = fixture()
    const comparison = routes(analysis)
    const features = terrainModelRouteFeatures(display(analysis, comparison))
    const shortest = features.find(feature => feature.get('terrainRole') === 'distance')!
    const terrain = features.find(feature => feature.get('terrainRole') === 'terrain')!
    expect(terrain.get('selected')).toBe(true)
    expect(shortest.get('selected')).toBe(false)
    expect(terrainModelRouteStyle(shortest)[1].getStroke()?.getLineDash()).toBeNull()
    expect(terrainModelRouteStyle(terrain)[1].getStroke()?.getLineDash()).toEqual([10, 4])
    expect(terrainModelRouteStyle(terrain)[1].getStroke()?.getWidth()).toBeGreaterThan(terrainModelRouteStyle(shortest)[1].getStroke()!.getWidth()!)
    const endpoint = features.find(feature => feature.get('terrainRole') === 'endpoint')!
    expect(terrainModelRouteStyle(endpoint)[0].getText()?.getText()).toBe('HRSC origin')
    ;(terrain.getGeometry() as LineString).setCoordinates([[0, 0], [1, 1]])
    expect(comparison.terrain.points[0].lon).not.toBe(0)
  })
})
