import Feature from 'ol/Feature'
import type { FeatureLike } from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import Fill from 'ol/style/Fill'
import RegularShape from 'ol/style/RegularShape'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import Text from 'ol/style/Text'
import type { HypotheticalRoute, RoutePoint } from '../routing/types'
import { TERRAIN_SOURCE_HASH, TERRAIN_SOURCE_ID } from '../terrain/sampling'
import { TERRAIN_GRID_BINARY_SHA256 } from '../terrain/terrainGrid'
import { validGridBounds } from './gridOverlay'
import type { Bounds } from './types'

/** Display validation only: the route engine owns coverage and graph authorization. */
function nativePointInBounds(point: RoutePoint, bounds: Bounds): boolean {
  if (!point || !Number.isSafeInteger(point.row) || !Number.isSafeInteger(point.column) || point.row < 586 || point.row > 841 || point.column < 522 || point.column > 777 || !Number.isFinite(point.lon) || !Number.isFinite(point.lat)) return false
  const [west, south, east, north] = bounds
  // The existing crop is an unresampled 256 × 256 equirectangular grid.
  const longitude = west + (point.column - 522 + 0.5) * (east - west) / 256
  const latitude = north - (point.row - 586 + 0.5) * (north - south) / 256
  return Math.abs(point.lon - longitude) <= 1e-10 && Math.abs(point.lat - latitude) <= 1e-10
}

function validRoute(route: HypotheticalRoute, bounds: Bounds): boolean {
  if (!route || (route.id !== 'shortest' && route.id !== 'via') || route.model !== 'hypothetical-distance-only' || route.referenceRadiusM !== 3396190 || route.sourceId !== TERRAIN_SOURCE_ID || route.sourceHash !== TERRAIN_SOURCE_HASH || route.gridHash !== TERRAIN_GRID_BINARY_SHA256 || !Number.isFinite(route.distanceM) || route.distanceM <= 0 || !Number.isSafeInteger(route.visitedCells) || route.visitedCells < 1 || !Array.isArray(route.points) || route.points.length < 2 || route.points.length > 131072) return false
  for (let index = 0; index < route.points.length; index += 1) {
    const point = route.points[index]
    if (!nativePointInBounds(point, bounds)) return false
    if (index === 0) continue
    const previous = route.points[index - 1]
    const rowStep = Math.abs(point.row - previous.row)
    const columnStep = Math.abs(point.column - previous.column)
    if (rowStep > 1 || columnStep > 1 || rowStep + columnStep === 0) return false
  }
  return true
}

/** Computed native-center geometry, kept separate from approximate named references. */
export function createHypotheticalRouteFeatures(bounds: Bounds | null, routes: readonly HypotheticalRoute[], selectedId: 'shortest' | 'via' | null, waypoint: RoutePoint | null): Feature<Geometry>[] {
  if (!bounds || !validGridBounds(bounds)) return []
  const features: Feature<Geometry>[] = []
  const seen = new Set<string>()
  for (const route of routes) {
    if (!validRoute(route, bounds) || seen.has(route.id)) continue
    seen.add(route.id)
    const feature = new Feature<Geometry>({
      geometry: new LineString(route.points.map((point) => [point.lon, point.lat])),
      routeRole: route.id,
      name: route.name,
      selected: selectedId === route.id,
    })
    feature.setId(`hypothetical-${route.id}`)
    features.push(feature)
  }
  if (waypoint && nativePointInBounds(waypoint, bounds)) {
    features.push(new Feature<Geometry>({ geometry: new Point([waypoint.lon, waypoint.lat]), routeRole: 'waypoint' }))
  }
  return features
}

/** Shape, line pattern and text distinguish alternatives independently of color. */
export function hypotheticalRouteStyle(feature: FeatureLike): Style[] {
  const role: unknown = feature.get('routeRole')
  if (role === 'waypoint') return [new Style({
    image: new RegularShape({ points: 4, radius: 12, angle: Math.PI / 4, fill: new Fill({ color: '#142029' }), stroke: new Stroke({ color: '#e6b35c', width: 2 }) }),
    text: new Text({ text: 'W · Hypothetical waypoint', font: '600 12px "Segoe UI", sans-serif', offsetY: 26, fill: new Fill({ color: '#f2f5f7' }), stroke: new Stroke({ color: '#0b0f14', width: 3 }) }),
    zIndex: 5,
  })]
  if (role !== 'shortest' && role !== 'via') return []
  const selected = feature.get('selected') === true
  const name: unknown = feature.get('name')
  const width = selected ? 4 : 2.5
  const lineDash = role === 'via' ? [8, 6] : undefined
  return [
    new Style({ stroke: new Stroke({ color: '#0b0f14', width: width + 3, lineDash }), zIndex: selected ? 2 : 0 }),
    new Style({
      stroke: new Stroke({ color: role === 'shortest' ? '#58c7d8' : '#e6b35c', width, lineDash }),
      text: new Text({ text: `${typeof name === 'string' ? name : role === 'shortest' ? 'Shortest path' : 'Via waypoint'} · hypothetical`, placement: 'line', font: '600 12px "Segoe UI", sans-serif', offsetY: -12, fill: new Fill({ color: '#f2f5f7' }), stroke: new Stroke({ color: '#0b0f14', width: 3 }) }),
      zIndex: selected ? 3 : 1,
    }),
  ]
}
