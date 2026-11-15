import Feature from 'ol/Feature'
import type { FeatureLike } from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import Circle from 'ol/style/Circle'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import Text from 'ol/style/Text'
import type { TerrainAnalysis } from '../terrain/modelTypes'
import { modelPoint, terrainMovement } from '../terrain/terrainModel'
import type { TerrainComparison } from '../routing/terrainRoutes'
import type { Bounds } from './types'

export type TerrainOverlayMode = 'none' | 'elevation' | 'slope' | 'roughness' | 'shape' | 'traversability' | 'explored'
export type TerrainMapDisplay = {
  readonly analysis: TerrainAnalysis
  readonly comparison: TerrainComparison | null
  readonly selected: 'distance' | 'terrain'
  readonly overlay: TerrainOverlayMode
}

export function terrainModelExtent(analysis: TerrainAnalysis): Bounds {
  const grid = analysis.grid
  const degrees = 180 / (Math.PI * grid.referenceRadiusM)
  return [grid.originXM * degrees, (grid.originYM + grid.rows * grid.pixelHeightM) * degrees,
    (grid.originXM + grid.columns * grid.pixelWidthM) * degrees, grid.originYM * degrees]
}

const colors = [[117, 130, 138], [71, 173, 168], [229, 176, 87], [215, 98, 83]] as const

/** One pixel per native DEM cell, no upsampling or invented obstacle raster. */
export function terrainOverlayPixels(display: TerrainMapDisplay): Uint8ClampedArray {
  const { analysis, overlay, comparison, selected } = display
  const count = analysis.grid.rows * analysis.grid.columns
  const pixels = new Uint8ClampedArray(count * 4)
  if (overlay === 'none') return pixels
  const expanded = new Set(comparison?.[selected].exploredNodes ?? [])
  const values = overlay === 'elevation' ? analysis.grid.values : overlay === 'slope' ? analysis.slopeDeg : overlay === 'roughness' ? analysis.roughnessM : analysis.shapeM
  let min = Infinity, max = -Infinity
  if (overlay !== 'traversability' && overlay !== 'explored') for (let node = 0; node < count; node++) {
    if (!analysis.grid.valid[node] || !Number.isFinite(values[node])) continue
    min = Math.min(min, values[node]); max = Math.max(max, values[node])
  }
  for (let node = 0; node < count; node++) {
    let color: readonly number[]
    let alpha = 145
    if (overlay === 'explored') {
      if (!expanded.has(node)) continue
      color = [160, 183, 213]; alpha = 100
    } else if (overlay === 'traversability') color = colors[analysis.states[node]] ?? colors[0]
    else if (!analysis.grid.valid[node] || !Number.isFinite(values[node])) color = colors[0]
    else {
      const t = max > min ? (values[node] - min) / (max - min) : 0.5
      color = [Math.round(48 + 194 * t), Math.round(124 + 62 * t), Math.round(156 - 69 * t)]
    }
    pixels.set([...color, alpha], node * 4)
  }
  return pixels
}

/** Retain every adjacent native center. A rendering shortcut cannot bridge a restriction. */
export function terrainModelRouteFeatures(display: TerrainMapDisplay): Feature<Geometry>[] {
  if (!display.comparison) return []
  const features: Feature<Geometry>[] = []
  const acceptedRoles = new Set<string>()
  for (const role of ['distance', 'terrain'] as const) {
    const route = display.comparison[role]
    if (route.nodes.length < 2 || route.nodes.length !== route.points.length || route.source.gridHash !== display.analysis.grid.source.gridHash) continue
    const coordinates: number[][] = []
    let accepted = true
    for (let index = 0; index < route.nodes.length; index++) {
      try {
        const expected = modelPoint(display.analysis.grid, route.nodes[index])
        const point = route.points[index]
        if (point.lon !== expected.lon || point.lat !== expected.lat || point.row !== expected.row || point.column !== expected.column || (index > 0 && terrainMovement(display.analysis, route.nodes[index - 1], route.nodes[index]).costM === null)) { accepted = false; break }
        coordinates.push([point.lon, point.lat])
      } catch { accepted = false; break }
    }
    if (!accepted) continue
    acceptedRoles.add(role)
    features.push(new Feature<Geometry>({ geometry: new LineString(coordinates), terrainRole: role, selected: display.selected === role }))
  }
  const selected = display.comparison[display.selected]
  if (!acceptedRoles.has(display.selected)) return features
  for (const [index, label] of [[0, 'HRSC origin'], [selected.nodes.length - 1, 'HRSC destination']] as const) {
    const point = modelPoint(display.analysis.grid, selected.nodes[index])
    features.push(new Feature<Geometry>({ geometry: new Point([point.lon, point.lat]), terrainRole: 'endpoint', label }))
  }
  return features
}

export function terrainModelRouteStyle(feature: FeatureLike): Style[] {
  const role = feature.get('terrainRole')
  if (role === 'endpoint') return [new Style({ image: new Circle({ radius: 6, fill: new Fill({ color: '#f2f5f7' }), stroke: new Stroke({ color: '#172129', width: 2 }) }), text: new Text({ text: feature.get('label'), offsetY: 18, font: '600 12px Segoe UI', fill: new Fill({ color: '#f2f5f7' }), stroke: new Stroke({ color: '#172129', width: 3 }) }), zIndex: 5 })]
  const selected = feature.get('selected') === true
  const width = selected ? 4 : 2
  const lineDash = role === 'terrain' ? [10, 4] : undefined
  return [new Style({ stroke: new Stroke({ color: '#101920', width: width + 3, lineDash }), zIndex: selected ? 3 : 1 }), new Style({ stroke: new Stroke({ color: role === 'terrain' ? '#e5b057' : '#58c7d8', width, lineDash }), zIndex: selected ? 4 : 2 })]
}
