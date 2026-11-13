import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import CircleStyle from 'ol/style/Circle'
import RegularShape from 'ol/style/RegularShape'
import { describe, expect, it } from 'vitest'
import { SCIENCE_TARGETS } from '../../data/scienceTargets'
import { createMissionFeatures, missionFeatureStyle, missionTargetId } from './featureMarkers'

describe('approximate feature reference markers', () => {
  it('uses actual longitude-first OpenLayers points without an Earth transform or route geometry', () => {
    const features = createMissionFeatures(SCIENCE_TARGETS, { origin: null, destination: null }, null)
    expect(features.map((feature) => [feature.getId(), feature.getGeometry()?.getCoordinates()])).toEqual([
      ['jezero', [77.69, 18.41]],
      ['belva', [77.38, 18.48]],
      ['neretva', [77.20, 18.55]],
    ])
    expect(features.every((feature) => feature instanceof Feature && feature.getGeometry() instanceof Point)).toBe(true)
    expect(features.every((feature) => feature.get('role') === 'reference')).toBe(true)
  })

  it('assigns origin/destination roles and the inspected flag without changing source coordinates', () => {
    const before = SCIENCE_TARGETS.map((target) => ({ ...target.coordinate }))
    const features = createMissionFeatures(SCIENCE_TARGETS, { origin: 'jezero', destination: 'belva' }, 'neretva')
    expect(features.map((feature) => [feature.get('targetId'), feature.get('role'), feature.get('selected')])).toEqual([
      ['jezero', 'origin', false],
      ['belva', 'destination', false],
      ['neretva', 'reference', true],
    ])
    features[0].getGeometry()!.setCoordinates([0, 0])
    expect(SCIENCE_TARGETS.map((target) => target.coordinate)).toEqual(before)
  })

  it('excludes unsupported coordinate conventions and invalid values', () => {
    const target = SCIENCE_TARGETS[0]
    const invalid = [
      { ...target, coordinate: { ...target.coordinate, lat: Number.NaN } },
      { ...target, coordinate: { ...target.coordinate, lon: 361 } },
      { ...target, coordinate: { ...target.coordinate, latitudeConvention: 'planetographic' as const } },
    ]
    expect(createMissionFeatures(invalid, { origin: null, destination: null }, null)).toEqual([])
  })

  it('styles O-circle, D-square and reference-diamond with names labeled approximate', () => {
    const features = createMissionFeatures(SCIENCE_TARGETS, { origin: 'jezero', destination: 'belva' }, null)
    const styles = features.map(missionFeatureStyle)
    expect(styles[0].getImage()).toBeInstanceOf(CircleStyle)
    expect(styles[0].getText()?.getText()).toBe('O\nJezero crater (approx.)')
    expect(styles[1].getImage()).toBeInstanceOf(RegularShape)
    expect((styles[1].getImage() as RegularShape).getAngle()).toBe(Math.PI / 4)
    expect(styles[1].getText()?.getText()).toBe('D\nBelva crater (approx.)')
    expect((styles[2].getImage() as RegularShape).getAngle()).toBe(0)
    expect(styles[2].getText()?.getText()).toBe('Neretva Vallis (approx.)')
  })

  it('returns only supported target IDs from selectable feature hits', () => {
    const features = createMissionFeatures(SCIENCE_TARGETS, { origin: null, destination: null }, null)
    expect(features.map(missionTargetId)).toEqual(['jezero', 'belva', 'neretva'])
    expect(missionTargetId(new Feature<Point>({ geometry: new Point([0, 0]) }))).toBeNull()
    expect(missionTargetId(new Feature<Point>({ geometry: new Point([0, 0]), targetId: 'unknown' }))).toBeNull()
  })
})
