import Feature from 'ol/Feature'
import type { FeatureLike } from 'ol/Feature'
import type BaseLayer from 'ol/layer/Base'
import type View from 'ol/View'
import VectorLayer from 'ol/layer/Vector'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCIENCE_TARGETS } from '../../data/scienceTargets'
import { createMarsMap } from './createMarsMap'
import type { MarsMapController } from './createMarsMap'
import type { Bounds } from './types'
import { FrameAwareTileLayer } from './FrameAwareTileLayer'
import type { ViewFrame } from './frameReadiness'
import { frameMatches } from './frameReadiness'
import type { HypotheticalRoute, RoutePoint } from '../routing/types'
import { TERRAIN_SOURCE_HASH, TERRAIN_SOURCE_ID } from '../terrain/sampling'
import { TERRAIN_GRID_BINARY_SHA256 } from '../terrain/terrainGrid'

// Mock the DOM renderer only. Controller view, sources, layers and geometry are real OpenLayers objects.
const runtime = vi.hoisted(() => ({ map: null as MapHarness | null }))
type MapHarness = {
  view: View
  layers: BaseLayer[]
  events: Map<string, (event: { pixel: number[]; coordinate: number[] }) => void>
  hit: FeatureLike | null
  dispose: ReturnType<typeof vi.fn>
}
vi.mock('ol/Map', () => ({
  default: class {
    view: View
    layers: BaseLayer[]
    events = new Map<string, (event: { pixel: number[]; coordinate: number[] }) => void>()
    hit: FeatureLike | null = null
    dispose = vi.fn()
    constructor(options: { view: View; layers: BaseLayer[] }) { this.view = options.view; this.layers = options.layers; runtime.map = this }
    getSize() { return [800, 600] }
    updateSize() {}
    getInteractions() { return [{ setActive: vi.fn() }] }
    on(name: string, callback: (event: { pixel: number[]; coordinate: number[] }) => void) { this.events.set(name, callback) }
    un(name: string) { this.events.delete(name) }
    removeLayer(layer: BaseLayer) { this.layers = this.layers.filter((item) => item !== layer) }
    setTarget() {}
    forEachFeatureAtPixel(_pixel: number[], callback: (feature: FeatureLike) => unknown) { return this.hit ? callback(this.hit) : undefined }
  },
}))
vi.mock('./requests', async (importOriginal) => ({
  ...await importOriginal<typeof import('./requests')>(),
  requestXml: vi.fn(async () => { throw new Error('Offline test fixture') }),
}))
vi.mock('ol/interaction/defaults', () => ({ defaults: vi.fn(() => []) }))

let controller: MarsMapController | undefined
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => { controller?.dispose(); controller = undefined; runtime.map = null; vi.restoreAllMocks(); vi.unstubAllGlobals() })
const host = { clientWidth: 800, clientHeight: 600 } as HTMLElement
const gridBounds: Bounds = [77.2, 18.3, 77.4, 18.5]
const routePoint = (row: number, column: number): RoutePoint => ({ row, column, lon: gridBounds[0] + (column - 522 + 0.5) * (gridBounds[2] - gridBounds[0]) / 256, lat: gridBounds[3] - (row - 586 + 0.5) * (gridBounds[3] - gridBounds[1]) / 256 })
const hypotheticalRoute: HypotheticalRoute = { id: 'shortest', name: 'Shortest path', points: [routePoint(714, 650), routePoint(714, 651)], distanceM: 25, visitedCells: 2, sourceId: TERRAIN_SOURCE_ID, sourceHash: TERRAIN_SOURCE_HASH, gridHash: TERRAIN_GRID_BINARY_SHA256, model: 'hypothetical-distance-only', referenceRadiusM: 3396190 }

describe('controlled imagery and grid controller hooks', () => {
  it('preserves original layers, renders controlled CTX above preliminary, and applies detail opacity to both', () => {
    controller = createMarsMap(host, vi.fn(), vi.fn())
    const map = runtime.map!
    expect(map.layers.slice(0, 3).map((layer) => layer.getZIndex())).toEqual([0, 1, 2])
    controller.setDetailOpacity(0.4)
    expect(map.layers[0].getOpacity()).toBe(1)
    expect(map.layers[1].getOpacity()).toBe(0.4)
    expect(map.layers[2].getOpacity()).toBe(0.4)
  })
  it('retains grid geometry while hiding it unless controlled imagery and the map are active', () => {
    controller = createMarsMap(host, vi.fn(), vi.fn())
    const map = runtime.map!
    const overlay = map.layers[4]
    controller.setVisibility({ mola: true, ctx: true, controlledCtx: false })
    controller.setGridOverlay(gridBounds, [{ role: 'origin', coordinate: [77.25, 18.4] }])
    expect(overlay.getVisible()).toBe(false)
    controller.setVisibility({ mola: true, ctx: true, controlledCtx: true })
    expect(overlay.getVisible()).toBe(true)
    controller.setActive(false)
    expect(overlay.getVisible()).toBe(false)
    controller.setActive(true)
    expect(overlay.getVisible()).toBe(true)
    controller.setGridOverlay(null, [])
    expect(overlay.getVisible()).toBe(false)
  })
  it('keeps routes separate, gates visibility, rebuilds on bounds changes and cleans up on disposal', () => {
    controller = createMarsMap(host, vi.fn(), vi.fn())
    const map = runtime.map!
    const overlay = map.layers[5] as VectorLayer
    const source = overlay.getSource()!
    expect(overlay.getZIndex()).toBe(25)
    expect(map.layers[4].getZIndex()).toBe(30)
    controller.setHypotheticalRoutes([hypotheticalRoute], 'shortest', routePoint(714, 651))
    expect(source.getFeatures()).toHaveLength(0)
    expect(overlay.getVisible()).toBe(false)
    controller.setGridOverlay(gridBounds, [])
    expect(source.getFeatures()).toHaveLength(2)
    expect(overlay.getVisible()).toBe(true)
    controller.setActive(false)
    expect(overlay.getVisible()).toBe(false)
    expect(source.getFeatures()).toHaveLength(2)
    controller.setActive(true)
    controller.setVisibility({ mola: true, ctx: true, controlledCtx: false })
    expect(overlay.getVisible()).toBe(false)
    controller.setVisibility({ mola: true, ctx: true, controlledCtx: true })
    expect(overlay.getVisible()).toBe(true)
    controller.setGridOverlay([77.3, 18.3, 77.5, 18.5], [])
    expect(source.getFeatures()).toHaveLength(0)
    expect(overlay.getVisible()).toBe(false)
    controller.setGridOverlay(gridBounds, [])
    expect(source.getFeatures()).toHaveLength(2)
    controller.setGridOverlay(null, [])
    expect(source.getFeatures()).toHaveLength(0)
    controller.setGridOverlay(gridBounds, [])
    controller.setHypotheticalRoutes([], null, null)
    expect(source.getFeatures()).toHaveLength(0)
    controller.setHypotheticalRoutes([hypotheticalRoute], null, null)
    controller.dispose()
    expect(map.layers).not.toContain(overlay)
    expect(source.getFeatures()).toHaveLength(0)
    controller.setHypotheticalRoutes([hypotheticalRoute], null, null)
    expect(source.getFeatures()).toHaveLength(0)
  })
  it('fits source bounds and dispatches view-center and free map picks without inspecting references', () => {
    const pick = vi.fn()
    controller = createMarsMap(host, vi.fn(), vi.fn(), { onPickCoordinate: pick })
    const map = runtime.map!
    controller.focusGrid(gridBounds)
    expect(map.view.getZoom()).toBeLessThanOrEqual(12)
    controller.pickViewCenter()
    expect(pick.mock.calls[0][0][0]).toBeCloseTo(77.3, 8)
    expect(pick.mock.calls[0][0][1]).toBeCloseTo(18.4, 8)
    map.events.get('singleclick')?.({ pixel: [50, 50], coordinate: [77.25, 18.35] })
    expect(pick).toHaveBeenLastCalledWith([77.25, 18.35])
    controller.setActive(false)
    controller.pickViewCenter()
    map.events.get('singleclick')?.({ pixel: [50, 50], coordinate: [77.25, 18.35] })
    expect(pick).toHaveBeenCalledTimes(2)
  })
  it('inspects a named reference instead of silently selecting it as a grid coordinate', () => {
    const pick = vi.fn()
    const inspect = vi.fn()
    controller = createMarsMap(host, vi.fn(), vi.fn(), { onPickCoordinate: pick, onInspectTarget: inspect })
    controller.setMissionFeatures(SCIENCE_TARGETS, { origin: null, destination: null }, null)
    const map = runtime.map!
    map.hit = new Feature({ targetId: 'jezero' })
    map.events.get('singleclick')?.({ pixel: [50, 50], coordinate: [77.69, 18.41] })
    expect(inspect).toHaveBeenCalledWith('jezero')
    expect(pick).not.toHaveBeenCalled()
  })
  it('disconnects click handlers and prevents coordinate picking after disposal', () => {
    const pick = vi.fn()
    controller = createMarsMap(host, vi.fn(), vi.fn(), { onPickCoordinate: pick })
    const map = runtime.map!
    const click = map.events.get('singleclick')!
    controller.dispose()
    controller.pickViewCenter()
    click({ pixel: [50, 50], coordinate: [77.25, 18.35] })
    expect(pick).not.toHaveBeenCalled()
    expect(map.events.has('singleclick')).toBe(false)
    expect(map.dispose).toHaveBeenCalledOnce()
  })
  it('reports active controlled imagery from the current rendered frame and suppresses duplicate callbacks', () => {
    const ready = vi.fn()
    controller = createMarsMap(host, vi.fn(), vi.fn(), { onControlledImageryReady: ready })
    const map = runtime.map!
    const controlled = map.layers[2] as FrameAwareTileLayer
    let recordedFrame: ViewFrame | null = null
    let hasPixels = false
    // The renderer's alpha/source-generation gate has its own real-adapter suite;
    // this spy exercises controller publication and frame-change invalidation.
    vi.spyOn(controlled, 'hasCurrentImagery').mockImplementation((current) => hasPixels && controlled.getVisible() && controlled.getOpacity() > 0 && frameMatches(recordedFrame, current))
    const invalidate = vi.spyOn(controlled, 'invalidateFrame').mockImplementation(() => { recordedFrame = null })
    const render = () => {
      const center = map.view.getCenter()!
      recordedFrame = { center: [center[0], center[1]], resolution: map.view.getResolution()!, size: [800, 600] }
      map.events.get('postrender')?.({ pixel: [], coordinate: [] })
    }
    expect(ready.mock.calls).toEqual([[false]])
    hasPixels = true
    render()
    expect(ready.mock.calls).toEqual([[false], [true]])
    render(); controller.refresh()
    expect(ready).toHaveBeenCalledTimes(2)
    controller.panBy(1, 0)
    expect(ready).toHaveBeenLastCalledWith(false)
    render()
    expect(ready).toHaveBeenLastCalledWith(true)
    controller.setVisibility({ mola: true, ctx: true, controlledCtx: false })
    expect(ready).toHaveBeenLastCalledWith(false)
    controller.setVisibility({ mola: true, ctx: true, controlledCtx: true })
    expect(ready).toHaveBeenLastCalledWith(false)
    render()
    expect(ready).toHaveBeenLastCalledWith(true)
    controller.setActive(false)
    expect(ready).toHaveBeenLastCalledWith(false)
    render()
    expect(ready).toHaveBeenLastCalledWith(false)
    controller.setActive(true)
    expect(ready).toHaveBeenLastCalledWith(true)
    controller.setDetailOpacity(0)
    expect(ready).toHaveBeenLastCalledWith(false)
    controller.setDetailOpacity(1)
    expect(ready).toHaveBeenLastCalledWith(true)
    controller.retry('controlledCtx')
    expect(invalidate).toHaveBeenCalled()
    expect(ready).toHaveBeenLastCalledWith(false)
    hasPixels = false
    render()
    expect(ready).toHaveBeenLastCalledWith(false)
    hasPixels = true
    render()
    expect(ready).toHaveBeenLastCalledWith(true)
    controller.dispose()
    expect(ready).toHaveBeenLastCalledWith(false)
    expect(map.events.has('postrender')).toBe(false)
    const count = ready.mock.calls.length
    controller.refresh(); controller.setActive(true)
    expect(ready).toHaveBeenCalledTimes(count)
  })
})
