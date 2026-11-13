import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import { describe, expect, it, vi } from 'vitest'
import { createGridOverlayFeatures, emitMapCoordinatePick, gridOverlayStyle, gridOverlayVisible, validGridBounds } from './gridOverlay'
import type { Bounds } from './types'

// Angular fixture bounds and endpoint positions are test data, not Mars measurements.
const bounds: Bounds = [77, 18, 78, 19]

describe('source-frame grid overlay', () => {
  it('places all four independent corners and closes a rectangle without a route segment', () => {
    const features = createGridOverlayFeatures(bounds, [{ role: 'origin', coordinate: [77.1, 18.8] }, { role: 'destination', coordinate: [77.9, 18.2] }])
    expect(features).toHaveLength(3)
    expect(features[0].getGeometry()).toBeInstanceOf(Polygon)
    expect((features[0].getGeometry() as Polygon).getCoordinates()).toEqual([[[77, 19], [78, 19], [78, 18], [77, 18], [77, 19]]])
    expect(features.slice(1).map((feature) => (feature.getGeometry() as Point).getCoordinates())).toEqual([[77.1, 18.8], [77.9, 18.2]])
    expect(features.map((feature) => feature.get('gridRole'))).toEqual(['bounds', 'origin', 'destination'])
    expect(gridOverlayStyle(features[1]).getText()?.getText()).toBe('G-O · Grid cell')
    expect(gridOverlayStyle(features[2]).getText()?.getText()).toBe('G-D · Grid cell')
    expect(gridOverlayStyle(features[0]).getFill()).toBeNull()
  })
  it('rejects absent, reversed, non-finite and out-of-domain extents', () => {
    expect(createGridOverlayFeatures(null, [])).toEqual([])
    for (const invalid of [[78, 18, 77, 19], [77, 19, 78, 18], [NaN, 18, 78, 19], [77, 18, 181, 19]] as Bounds[]) {
      expect(validGridBounds(invalid)).toBe(false)
      expect(createGridOverlayFeatures(invalid, [])).toEqual([])
    }
  })
  it('excludes invalid and outside endpoints without moving them into valid coverage', () => {
    const features = createGridOverlayFeatures(bounds, [{ role: 'origin', coordinate: [76.9, 18.8] }, { role: 'destination', coordinate: [77.9, Infinity] }])
    expect(features).toHaveLength(1)
  })
  it('copies coordinates so OpenLayers geometry changes do not mutate supplied endpoints', () => {
    const coordinate = Object.freeze([77.1, 18.8] as const)
    const features = createGridOverlayFeatures(bounds, [{ role: 'origin', coordinate }])
    ;(features[1].getGeometry() as Point).setCoordinates([0, 0])
    expect(coordinate).toEqual([77.1, 18.8])
    expect(bounds).toEqual([77, 18, 78, 19])
  })
  it('requires an active map, selected controlled imagery and source bounds to show the overlay', () => {
    expect(gridOverlayVisible(true, true, true)).toBe(true)
    expect(gridOverlayVisible(false, true, true)).toBe(false)
    expect(gridOverlayVisible(true, false, true)).toBe(false)
    expect(gridOverlayVisible(true, true, false)).toBe(false)
  })
})

describe('coordinate pick dispatch', () => {
  it('emits longitude-first coordinate copies from active, non-reference picks', () => {
    const onPick = vi.fn()
    const coordinate = [77.1, 18.8]
    emitMapCoordinatePick(coordinate, true, false, onPick)
    expect(onPick).toHaveBeenCalledWith([77.1, 18.8])
    expect(onPick.mock.calls[0][0]).not.toBe(coordinate)
  })
  it('does not pick while inactive, when inspecting a reference, or with invalid coordinates', () => {
    const onPick = vi.fn()
    emitMapCoordinatePick([77, 18], false, false, onPick)
    emitMapCoordinatePick([77, 18], true, true, onPick)
    for (const coordinate of [[NaN, 18], [181, 18], [77, 91], [77], [77, 18, 0]]) emitMapCoordinatePick(coordinate, true, false, onPick)
    expect(onPick).not.toHaveBeenCalled()
  })
})
