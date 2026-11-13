import Feature from 'ol/Feature'
import type { FeatureLike } from 'ol/Feature'
import Point from 'ol/geom/Point'
import CircleStyle from 'ol/style/Circle'
import Fill from 'ol/style/Fill'
import RegularShape from 'ol/style/RegularShape'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import Text from 'ol/style/Text'
import { toDisplayCoordinate } from '../mission/coordinates'
import type { MissionSelection, ScienceTarget, TargetId } from '../mission/types'

/** Published feature centers only; no image registration, terrain or route geometry is inferred. */
export function createMissionFeatures(targets: readonly ScienceTarget[], selection: MissionSelection, selectedId: TargetId | null): Feature<Point>[] {
  return targets.flatMap((target) => {
    const coordinate = toDisplayCoordinate(target.coordinate)
    if (!coordinate) return []
    const feature = new Feature<Point>({
      geometry: new Point(coordinate),
      targetId: target.id,
      name: target.name,
      role: selection.origin === target.id ? 'origin' : selection.destination === target.id ? 'destination' : 'reference',
      selected: selectedId === target.id,
    })
    feature.setId(target.id)
    return [feature]
  })
}

/** The letter and shape distinguish endpoint roles independently of color. */
export function missionFeatureStyle(feature: FeatureLike): Style {
  const role: unknown = feature.get('role')
  const name: unknown = feature.get('name')
  const selected = feature.get('selected') === true
  const label = `${typeof name === 'string' ? name : 'Feature reference'} (approx.)`
  const color = role === 'origin' ? '#e06b45' : role === 'destination' ? '#e6b35c' : '#58c7d8'
  const fill = new Fill({ color: '#121922' })
  const stroke = new Stroke({ color: selected ? '#f2f5f7' : color, width: selected ? 3 : 2 })
  const image = role === 'origin'
    ? new CircleStyle({ radius: selected ? 12 : 10, fill, stroke })
    : new RegularShape({ points: 4, radius: role === 'destination' ? 14 : selected ? 10 : 8, angle: role === 'destination' ? Math.PI / 4 : 0, fill, stroke })
  const endpoint = role === 'origin' ? 'O' : role === 'destination' ? 'D' : null
  return new Style({
    image,
    text: new Text({
      text: endpoint ? `${endpoint}\n${label}` : label,
      font: '600 12px "Segoe UI", sans-serif',
      textAlign: 'center',
      textBaseline: 'middle',
      offsetY: endpoint ? 8 : 20,
      fill: new Fill({ color: '#f2f5f7' }),
      stroke: new Stroke({ color: '#0b0f14', width: 3 }),
    }),
    zIndex: selected ? 10 : endpoint ? 2 : 1,
  })
}

export function missionTargetId(feature: FeatureLike): TargetId | null {
  const id: unknown = feature.get('targetId')
  return id === 'jezero' || id === 'belva' || id === 'neretva' ? id : null
}
