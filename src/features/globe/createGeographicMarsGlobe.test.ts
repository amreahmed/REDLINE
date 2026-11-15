import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BufferGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from 'three'
import type { TileContract } from '../map/types'
import { createGeographicMarsGlobe, createGlobeTileGeometry, rgbaHasVisiblePixels } from './createGeographicMarsGlobe'
import type { GeographicGlobeController } from './createGeographicMarsGlobe'
import { cartesianToGeographic } from './geographicMath'
import type { GlobeTileLayer } from './globeTileLod'

const fixture = vi.hoisted(() => ({
  frames: new Map<number, FrameRequestCallback>(), nextFrame: 0,
  positions: [] as number[][], disposeRenderer: vi.fn(), closed: vi.fn(),
  markers: [] as { visible: boolean; radius: number; pixelY: number }[],
  labels: [] as { visible: boolean; pixelY: number }[],
  tiles: [] as { layerId: string; key: string; opacity: number }[],
  listeners: new Map<string, EventListener>(),
}))
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  return { ...actual, WebGLRenderer: class {
    domElement = { style: { cursor: '' }, clientWidth: 800, setAttribute() {}, remove() {}, addEventListener(name: string, callback: EventListener) { fixture.listeners.set(name, callback) }, removeEventListener(name: string) { fixture.listeners.delete(name) }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) }
    setPixelRatio() {} setSize() {} forceContextLoss() {}
    render(scene: Scene, camera: PerspectiveCamera) {
      fixture.positions.push(camera.position.toArray())
      fixture.markers = scene.children.filter(child => child.type === 'Sprite' && child.renderOrder === 100).map(marker => ({ visible: marker.visible, radius: marker.position.length(), pixelY: marker.position.clone().project(camera).y * 300 }))
      fixture.labels = scene.children.filter(child => child.type === 'Sprite' && child.renderOrder === 101).map(label => ({ visible: label.visible, pixelY: label.position.clone().project(camera).y * 300 }))
      fixture.tiles = []
      scene.traverseVisible(child => { if (child.userData.tileKey) fixture.tiles.push({ layerId: child.userData.globeLayerId, key: child.userData.tileKey, opacity: (child as Mesh<BufferGeometry, MeshStandardMaterial>).material.opacity }) })
    }
    dispose() { fixture.disposeRenderer() }
  } }
})
vi.mock('three/addons/controls/OrbitControls.js', async () => {
  const { Spherical, Vector3 } = await import('three')
  return { OrbitControls: class {
    target = new Vector3()
    enabled = true
    listener: (() => void) | undefined
    constructor(private camera: PerspectiveCamera) {}
    getAzimuthalAngle() { return new Spherical().setFromVector3(this.camera.position).theta }
    getPolarAngle() { return new Spherical().setFromVector3(this.camera.position).phi }
    update() { this.camera.lookAt(this.target); this.listener?.() }
    addEventListener(_name: string, listener: () => void) { this.listener = listener }
    removeEventListener() { this.listener = undefined }
    dispose() { this.listener = undefined }
  } }
})

function imagery(id = 'test-only'): GlobeTileLayer {
  const tileSource: TileContract = { extent: [-180, -90, 180, 90], origin: [-180, 90], matrixSet: 'default028mm', style: 'default', tileSize: 512, format: 'image/png', matrixIds: ['0', '1', '2', '3'], resolutions: [0, 1, 2, 3].map(z => 360 / (512 * 2 ** (z + 1))), sizes: [0, 1, 2, 3].map(z => [2 ** (z + 1), 2 ** z]), template: `https://example.invalid/${id}/{TileMatrix}/{TileRow}/{TileCol}` }
  return { id, name: 'Test-only renderer source', coverage: [-180, -90, 180, 90], minZoom: 0, maxZoom: 3, tileSource }
}

describe('tile sphere geometry without WebGL', () => {
  it('preserves clipped source UVs, orientation and sphere attachment', () => {
    const geometry = createGlobeTileGeometry({ key: 'test-only', level: 0, column: 0, row: 0, bounds: [0, -10, 20, 10], clippedBounds: [5, -5, 15, 5] })
    const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv')
    const first = cartesianToGeographic([position.getX(0), position.getY(0), position.getZ(0)])
    expect(first[0]).toBeCloseTo(5, 6); expect(first[1]).toBeCloseTo(-5, 6)
    expect(uv.getX(0)).toBeCloseTo(0.25); expect(uv.getY(0)).toBeCloseTo(0.25)
    expect(uv.getX(uv.count - 1)).toBeCloseTo(0.75); expect(uv.getY(uv.count - 1)).toBeCloseTo(0.75)
    expect(Math.hypot(position.getX(0), position.getY(0), position.getZ(0))).toBeCloseTo(1, 6)
    const normal = geometry.getAttribute('normal')
    expect(Math.hypot(normal.getX(0), normal.getY(0), normal.getZ(0))).toBeCloseTo(1, 6)
    const a = [position.getX(0), position.getY(0), position.getZ(0)], b = [position.getX(1), position.getY(1), position.getZ(1)], next = geometry.getIndex()!.getX(2)
    const c = [position.getX(next), position.getY(next), position.getZ(next)]
    const east = b.map((value, index) => value - a[index]), north = c.map((value, index) => value - a[index])
    const cross = [east[1] * north[2] - east[2] * north[1], east[2] * north[0] - east[0] * north[2], east[0] * north[1] - east[1] * north[0]]
    expect(cross.reduce((sum, value, index) => sum + value * a[index], 0)).toBeGreaterThan(0)
    geometry.dispose()
  })
  it('uses alpha alone to identify entirely absent imagery', () => {
    expect(rgbaHasVisiblePixels(new Uint8Array([255, 255, 255, 0, 0, 0, 0, 0]))).toBe(false)
    expect(rgbaHasVisiblePixels(new Uint8Array([0, 0, 0, 255]))).toBe(true)
    expect(rgbaHasVisiblePixels(new Uint8Array([0, 0, 0, 1]))).toBe(true)
    expect(() => rgbaHasVisiblePixels(new Uint8Array([0, 0, 0]))).toThrow()
  })
})

describe('geographic globe controller with renderer/network mocked', () => {
  let controller: GeographicGlobeController | undefined
  beforeEach(() => {
    fixture.frames.clear(); fixture.positions.length = 0; fixture.markers.length = 0; fixture.labels.length = 0; fixture.tiles.length = 0; fixture.listeners.clear(); fixture.disposeRenderer.mockClear(); fixture.closed.mockClear()
    vi.stubGlobal('window', { devicePixelRatio: 1, matchMedia: () => ({ matches: true }) })
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++fixture.nextFrame; fixture.frames.set(id, callback); return id })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => fixture.frames.delete(id))
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, fillText() {} }) }) })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(64), { status: 200, headers: { 'content-type': 'image/png' } })))
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 512, height: 512, close: fixture.closed })))
  })
  afterEach(() => { controller?.dispose(); controller = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })
  const frame = (offset = 2000) => { const callbacks = [...fixture.frames.values()]; fixture.frames.clear(); callbacks.forEach(callback => callback(performance.now() + offset)) }
  function start() {
    const onStatus = vi.fn(), onView = vi.fn(), onDistance = vi.fn()
    controller = createGeographicMarsGlobe({ append() {}, getBoundingClientRect: () => ({ width: 800, height: 600 }) } as unknown as HTMLElement, onStatus, onDistance, { initialLayer: imagery(), onView })
    return { globe: controller, onStatus, onView, onDistance }
  }
  it('keeps an interactive geographic sphere when imagery requests fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unavailable', { status: 503 })))
    const { globe, onStatus } = start()
    expect(onStatus).toHaveBeenLastCalledWith({ phase: 'ready', message: 'Geographic Mars globe ready; imagery streams separately.' })
    await vi.waitFor(() => expect(globe.getView().imagery.phase).toBe('error'))
    const before = globe.getView()
    globe.rotate(0.2, -0.1); frame()
    expect(globe.getView().longitude).not.toBeCloseTo(before.longitude)
    expect(onStatus.mock.calls.some(call => call[0].phase === 'error')).toBe(false)
  })
  it('fits the full overview after a narrow resize while preserving geography and a deliberately close view', () => {
    let resized: (() => void) | undefined
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resized = callback } observe() {} disconnect() {} })
    const size = { width: 800, height: 600 }
    controller = createGeographicMarsGlobe({ append() {}, getBoundingClientRect: () => size } as unknown as HTMLElement, vi.fn(), vi.fn(), { initialLayer: imagery() })
    const previous = controller.getView()
    size.width = 320; size.height = 800; resized!()
    expect(controller.getView().distance).toBeGreaterThan(previous.distance)
    expect(controller.getView().longitude).toBeCloseTo(previous.longitude, 8)
    expect(controller.getView().latitude).toBeCloseTo(previous.latitude, 8)
    controller.setGeographicView([77.45, 18.44], 1.12)
    size.width = 900; resized!()
    expect(controller.getView().distance).toBeCloseTo(1.12, 8)
    expect(controller.getView().longitude).toBeCloseTo(77.45, 8)
  })
  it('reports fully transparent decoded tiles as missing while preserving black image pixels', async () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(16) }) }) }) })
    const { globe, onStatus } = start()
    await vi.waitFor(() => expect(globe.getView().imagery.phase).toBe('error'))
    expect(globe.getView().imagery.missing).toBeGreaterThan(0)
    expect(globe.getView().imagery.loaded).toBe(0)
    expect(globe.getView().imagery.failed).toBe(0)
    expect(fixture.closed).toHaveBeenCalled()
    expect(onStatus.mock.calls.some(call => call[0].phase === 'error')).toBe(false)
  })
  it('switches imagery without changing geographic camera coordinates or orientation', async () => {
    const { globe } = start()
    globe.setGeographicView([77.69, 18.41], 1.1)
    const before = globe.getView()
    globe.setLayer(imagery('second-test-only'))
    expect(globe.getView().longitude).toBeCloseTo(before.longitude, 12)
    expect(globe.getView().latitude).toBeCloseTo(before.latitude, 12)
    expect(globe.getView().distance).toBeCloseTo(before.distance, 12)
    await vi.waitFor(() => expect(globe.getView().imagery.loaded).toBeGreaterThan(0))
    frame()
  })
  it('does not display a cached previous dataset when the selected layer settles unavailable', async () => {
    const { globe } = start()
    await vi.waitFor(() => expect(globe.getView().imagery.loaded).toBeGreaterThan(0))
    frame()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unavailable', { status: 503 })))
    globe.setLayer(imagery('unavailable-test-only'))
    expect(globe.getView().transitioningFrom).toBe('test-only')
    await vi.waitFor(() => expect(globe.getView().imagery.phase).toBe('error'))
    frame()
    expect(globe.getView().transitioningFrom).toBeUndefined()
    expect(fixture.tiles.some(tile => tile.layerId === 'test-only' && tile.opacity > 0)).toBe(false)
    expect(globe.getView().imagery.loaded).toBe(0)
  })
  it('reuses bounded source caches when switching back without refetching the overview', async () => {
    const { globe } = start()
    await vi.waitFor(() => expect(globe.getView().imagery.pending).toBe(0))
    frame()
    const firstRequests = vi.mocked(fetch).mock.calls.filter(call => String(call[0]).includes('/test-only/')).length
    globe.setLayer(imagery('second-test-only'))
    await vi.waitFor(() => expect(globe.getView().imagery.pending).toBe(0))
    frame(); frame(2500)
    globe.setLayer(imagery())
    await vi.waitFor(() => expect(globe.getView().imagery.pending).toBe(0))
    frame(); frame(2500)
    expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).includes('/test-only/'))).toHaveLength(firstRequests)
    expect(fixture.tiles.filter(tile => tile.layerId === 'test-only' && tile.key.startsWith('0/') && tile.opacity > 0)).toHaveLength(2)
    expect(fixture.tiles.some(tile => tile.layerId === 'second-test-only' && tile.opacity > 0)).toBe(false)
  })
  it('keeps both coarse hemispheres beneath pending refinements during a large rotation', async () => {
    const { globe } = start()
    globe.setGeographicView([77.69, 18.41], 1.1)
    await vi.waitFor(() => expect(globe.getView().imagery.pending).toBe(0))
    frame()
    const pending: AbortSignal[] = []
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => { const signal = init.signal!; pending.push(signal); signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }) })))
    globe.setGeographicView([-110, 18.41], 1.1)
    await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0))
    frame()
    expect(fixture.tiles.filter(tile => tile.key.startsWith('0/') && tile.opacity > 0)).toHaveLength(2)
    globe.setGeographicView([77.69, 18.41], 1.1)
    expect(pending.every(signal => signal.aborted)).toBe(true)
    frame()
    expect(fixture.tiles.filter(tile => tile.key.startsWith('0/') && tile.opacity > 0)).toHaveLength(2)
  })
  it('updates imagery throughout continuous rotation instead of waiting for dragging to stop', async () => {
    const { globe, onView } = start()
    await vi.waitFor(() => expect(globe.getView().imagery.pending).toBe(0))
    await new Promise(resolve => setTimeout(resolve, 160))
    vi.useFakeTimers(); onView.mockClear()
    for (let turn = 0; turn < 6; turn++) { globe.rotate(0.3, 0); await vi.advanceTimersByTimeAsync(100) }
    expect(onView.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
  it('steps button and wheel zoom relative to the surface and keeps intermediate LOD available', () => {
    const { globe } = start()
    globe.setGeographicView([77.69, 18.41], 4)
    const initialLevel = globe.getView().level
    globe.zoom(0.8); frame()
    expect(globe.getView().distance).toBeCloseTo(3.4, 10)
    for (let step = 0; step < 8; step++) { globe.zoom(0.8); frame() }
    expect(globe.getView().distance).toBeCloseTo(1 + 3 * 0.8 ** 9, 10)
    expect(globe.getView().distance).toBeGreaterThan(1.0015)
    expect(globe.getView().level).toBeGreaterThan(initialLevel)
    const beforeWheel = globe.getView().distance, preventDefault = vi.fn(), stopImmediatePropagation = vi.fn()
    fixture.listeners.get('wheel')!({ deltaY: -100, deltaMode: 0, preventDefault, stopImmediatePropagation } as unknown as Event)
    frame()
    expect(globe.getView().distance).toBeCloseTo(1 + (beforeWheel - 1) * Math.exp(-0.15), 10)
    expect(preventDefault).toHaveBeenCalledOnce()
  })
  it('removes old imagery immediately when the selected footprint is outside the view', async () => {
    const { globe } = start()
    await vi.waitFor(() => expect(globe.getView().imagery.loaded).toBeGreaterThan(0))
    globe.setGeographicView([20, 10], 1.05)
    globe.setLayer({ ...imagery('outside-test-only'), coverage: [100, -10, 110, -5] })
    expect(globe.getView().imagery.phase).toBe('outside')
    expect(globe.getView().transitioningFrom).toBeUndefined()
    frame()
  })
  it('reports outside center coverage even when a regional footprint is visible elsewhere on the globe', async () => {
    const { globe } = start()
    await vi.waitFor(() => expect(globe.getView().imagery.pending).toBe(0))
    frame()
    globe.setGeographicView([20, 10], 4)
    globe.setLayer({ ...imagery('regional-test-only'), coverage: [76.8, 17.8, 78.5, 19.2] })
    await vi.waitFor(() => expect(globe.getView().imagery.loaded).toBeGreaterThan(0))
    expect(globe.getView().imagery.phase).toBe('outside')
    expect(globe.getView().transitioningFrom).toBeUndefined()
    frame()
    expect(fixture.tiles.some(tile => tile.layerId === 'test-only' && tile.opacity > 0)).toBe(false)
    expect(fixture.tiles.some(tile => tile.layerId === 'regional-test-only' && tile.opacity > 0)).toBe(true)
    globe.setGeographicView([77.69, 18.41], 1.1)
    await vi.waitFor(() => expect(globe.getView().imagery.pending).toBe(0))
    expect(globe.getView().imagery.phase).toBe('ready')
    globe.setGeographicView([20, 10], 4)
    expect(globe.getView().imagery.phase).toBe('outside')
  })
  it('flies and stages to actual target directions, not a fixed longitude rotation', () => {
    const { globe, onDistance } = start()
    const complete = vi.fn()
    globe.flyTo([-137.4, 4.5], complete); frame()
    expect(globe.getView().longitude).toBeCloseTo(-137.4, 10)
    expect(globe.getView().latitude).toBeCloseTo(4.5, 10)
    expect(complete).toHaveBeenCalledOnce()
    globe.setActive(false); onDistance.mockClear()
    globe.beginApproach(); globe.setOverviewProgress(1); globe.setApproachProgress(1); frame()
    expect(globe.getView().longitude).toBeCloseTo(77.69, 10)
    expect(globe.getView().latitude).toBeCloseTo(18.41, 10)
    expect(globe.getView().distance).toBeCloseTo(1.9, 10)
    expect(onDistance).not.toHaveBeenCalled()
  })
  it('cancels obsolete native flights when navigating away and keeps close front-side POIs visible', () => {
    const { globe } = start()
    const complete = vi.fn()
    globe.flyTo([90, 0], complete)
    globe.setActive(false); globe.setActive(true); frame()
    expect(complete).not.toHaveBeenCalled()
    globe.setGeographicView([20, 10], 1.0015)
    globe.setPois([{ id: 'front-test-only', name: 'Front test-only', category: 'test', longitude: 20, latitude: 10 }, { id: 'back-test-only', name: 'Back test-only', category: 'test', longitude: -160, latitude: -10 }], 'front-test-only')
    frame()
    expect(fixture.markers).toHaveLength(2)
    expect(fixture.markers[0].visible).toBe(true)
    expect(fixture.markers[1].visible).toBe(false)
    expect(fixture.markers[0].radius).toBeLessThan(globe.getView().distance)
    expect(fixture.labels[0].visible).toBe(true)
    expect(fixture.labels[0].pixelY - fixture.markers[0].pixelY).toBeCloseTo(30, 8)
  })
  it('restores requested imagery after inactive map time and releases WebGL resources once', async () => {
    const { globe } = start()
    await vi.waitFor(() => expect(globe.getView().imagery.loaded).toBeGreaterThan(0))
    globe.setActive(false)
    expect(globe.getView().imagery.phase).toBe('outside')
    globe.setActive(true)
    expect(globe.getView().imagery.phase).not.toBe('outside')
    await vi.waitFor(() => expect(globe.getView().imagery.pending).toBe(0))
    frame(); expect(fixture.frames.size).toBe(0)
    globe.dispose(); globe.dispose()
    expect(fixture.disposeRenderer).toHaveBeenCalledOnce()
    expect(fixture.closed).toHaveBeenCalled()
    expect(fixture.listeners.size).toBe(0)
    expect(fixture.frames.size).toBe(0)
  })
})
