import Feature from 'ol/Feature'
import type { FeatureLike } from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import Fill from 'ol/style/Fill'
import RegularShape from 'ol/style/RegularShape'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import Text from 'ol/style/Text'
import type { Bounds, GridOverlayEndpoint } from './types'

export function validGridBounds(bounds: Bounds): boolean {
  const [west, south, east, north] = bounds
  return bounds.length === 4 && bounds.every(Number.isFinite) && west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north
}

export function gridOverlayVisible(active: boolean, controlledVisible: boolean, hasBounds: boolean): boolean {
  return active && controlledVisible && hasBounds
}

/** Source-frame extent and explicit cell centers; no path or derived terrain metric. */
export function createGridOverlayFeatures(bounds: Bounds | null, endpoints: readonly GridOverlayEndpoint[]): Feature<Geometry>[] {
  if (!bounds || !validGridBounds(bounds)) return []
  const [west, south, east, north] = bounds
  const features: Feature<Geometry>[] = [new Feature({
    geometry: new Polygon([[[west, north], [east, north], [east, south], [west, south], [west, north]]]),
    gridRole: 'bounds',
  })]
  for (const endpoint of endpoints) {
    const [longitude, latitude] = endpoint.coordinate
    if ((endpoint.role !== 'origin' && endpoint.role !== 'destination') || endpoint.coordinate.length !== 2 || !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < west || longitude > east || latitude < south || latitude > north) continue
    features.push(new Feature({ geometry: new Point([longitude, latitude]), gridRole: endpoint.role }))
  }
  return features
}

export function gridOverlayStyle(feature: FeatureLike): Style {
  const role: unknown = feature.get('gridRole')
  if (role === 'bounds') return new Style({ stroke: new Stroke({ color: '#89d3cf', width: 2, lineDash: [6, 5] }) })
  const origin = role === 'origin'
  return new Style({
    image: new RegularShape({ points: origin ? 3 : 6, radius: 11, fill: new Fill({ color: '#142029' }), stroke: new Stroke({ color: '#f2f5f7', width: 2 }) }),
    text: new Text({ text: `${origin ? 'G-O' : 'G-D'} · Grid cell`, font: '600 12px "Segoe UI", sans-serif', offsetY: -25, fill: new Fill({ color: '#f2f5f7' }), stroke: new Stroke({ color: '#0b0f14', width: 3 }) }),
    zIndex: 1,
  })
}

/** Selection gating belongs to the caller; this only emits valid longitude-first map coordinates. */
export function emitMapCoordinatePick(coordinate: readonly number[], active: boolean, inspectedFeature: boolean, onPick?: (coordinate: [number, number]) => void): void {
  if (!active || inspectedFeature || coordinate.length !== 2 || !Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1]) || coordinate[0] < -180 || coordinate[0] > 180 || coordinate[1] < -90 || coordinate[1] > 90) return
  onPick?.([coordinate[0], coordinate[1]])
}
