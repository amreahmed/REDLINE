import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PerspectiveCamera } from 'three'
import { createMarsGlobe } from './createMarsGlobe'
import type { GlobeController } from './createMarsGlobe'

const fixture = vi.hoisted(() => ({
  positions: [] as number[][],
  disposeRenderer: vi.fn(),
  contextLost: undefined as ((event: { preventDefault: () => void }) => void) | undefined,
}))

vi.mock('./asset', () => ({ fetchGlobeAsset: vi.fn(async () => new ArrayBuffer(0)), GlobeAssetError: Error }))
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = {
        setAttribute() {}, remove() {}, removeEventListener() {},
        addEventListener(name: string, callback: typeof fixture.contextLost) { if (name === 'webglcontextlost') fixture.contextLost = callback },
      }
      setPixelRatio() {} setSize() {} clear() {} forceContextLoss() {}
      render(_scene: unknown, camera: PerspectiveCamera) { fixture.positions.push(camera.position.toArray()) }
      dispose() { fixture.disposeRenderer() }
    },
  }
})
vi.mock('three/addons/loaders/GLTFLoader.js', async () => {
  const { Group, Mesh, SphereGeometry, MeshStandardMaterial, Texture } = await import('three')
  return { GLTFLoader: class {
    async parseAsync() {
      // Synthetic graphics fixture; no NASA asset, browser canvas or WebGL renderer runs.
      const texture = new Texture({ width: 1, height: 1 })
      const scene = new Group()
      scene.add(new Mesh(new SphereGeometry(1), new MeshStandardMaterial({ map: texture, normalMap: texture })))
      return { scene }
    }
  } }
})
vi.mock('three/addons/controls/OrbitControls.js', async () => {
  const { Spherical, Vector3 } = await import('three')
  return { OrbitControls: class {
    target = new Vector3()
    listener: (() => void) | undefined
    constructor(private camera: PerspectiveCamera) {}
    getAzimuthalAngle() { return new Spherical().setFromVector3(this.camera.position).theta }
    getPolarAngle() { return new Spherical().setFromVector3(this.camera.position).phi }
    update() { this.camera.lookAt(this.target); this.listener?.() }
    addEventListener(_name: string, listener: () => void) { this.listener = listener }
    dispose() { this.listener = undefined }
  } }
})

describe('globe flight controller lifecycle (renderer mocked)', () => {
  let controller: GlobeController | undefined
  const onDistance = vi.fn()
  beforeEach(() => {
    fixture.positions.length = 0
    fixture.disposeRenderer.mockClear()
    fixture.contextLost = undefined
    onDistance.mockClear()
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  })
  afterEach(() => { controller?.dispose(); controller = undefined; vi.unstubAllGlobals() })

  async function ready() {
    const host = { append() {}, getBoundingClientRect: () => ({ width: 800, height: 600 }) } as unknown as HTMLElement
    const onStatus = vi.fn()
    controller = createMarsGlobe(host, onStatus, onDistance)
    await vi.waitFor(() => expect(onStatus).toHaveBeenLastCalledWith({ phase: 'ready', message: 'NASA visual model loaded' }))
    return controller
  }

  it('drives camera frames while user input is inactive without threshold feedback', async () => {
    const globe = await ready()
    globe.setActive(false)
    onDistance.mockClear()
    globe.beginApproach()
    const start = fixture.positions.at(-1)!
    globe.setApproachProgress(1)
    const end = fixture.positions.at(-1)!
    expect(Math.hypot(...start)).toBeGreaterThan(3.7)
    expect(Math.hypot(...end)).toBeCloseTo(1.9)
    expect(end[0]).not.toBeCloseTo(start[0])
    expect(onDistance).not.toHaveBeenCalled()
  })

  it('rejects a duplicate begin and ignores late progress after interruption', async () => {
    const globe = await ready()
    globe.beginApproach()
    globe.setApproachProgress(0.4)
    const count = fixture.positions.length
    globe.beginApproach()
    expect(fixture.positions).toHaveLength(count)
    globe.endApproach()
    const pose = fixture.positions.at(-1)
    const afterEnd = fixture.positions.length
    globe.setApproachProgress(0.9)
    globe.setOverviewProgress(0.9)
    expect(fixture.positions).toHaveLength(afterEnd)
    expect(fixture.positions.at(-1)).toEqual(pose)
  })

  it('preserves a close camera at begin and eases to the exact approach starting pose', async () => {
    const globe = await ready()
    globe.rotate(0.2, -0.1)
    globe.zoom(0.55)
    globe.setActive(false)
    onDistance.mockClear()
    const before = fixture.positions.at(-1)!
    globe.beginApproach()
    expect(fixture.positions.at(-1)).toEqual(before)
    globe.setOverviewProgress(0)
    fixture.positions.at(-1)!.forEach((value, index) => expect(value).toBeCloseTo(before[index], 12))
    globe.setOverviewProgress(0.5)
    expect(Math.hypot(...fixture.positions.at(-1)!)).toBeGreaterThan(Math.hypot(...before))
    globe.setOverviewProgress(1)
    const prepared = fixture.positions.at(-1)
    globe.setApproachProgress(0)
    expect(fixture.positions.at(-1)).toEqual(prepared)
    expect(onDistance).not.toHaveBeenCalled()
  })

  it('clears the approach on reset and permits a new flight', async () => {
    const globe = await ready()
    globe.beginApproach()
    globe.setApproachProgress(0.8)
    globe.reset()
    expect(Math.hypot(...fixture.positions.at(-1)!)).toBeGreaterThan(3.7)
    const count = fixture.positions.length
    globe.setApproachProgress(1)
    globe.setOverviewProgress(1)
    expect(fixture.positions).toHaveLength(count)
    globe.beginApproach()
    globe.setApproachProgress(1)
    expect(Math.hypot(...fixture.positions.at(-1)!)).toBeCloseTo(1.9)
  })

  it('ignores pending frame calls after context loss or disposal', async () => {
    const globe = await ready()
    globe.beginApproach()
    fixture.contextLost?.({ preventDefault: vi.fn() })
    const count = fixture.positions.length
    globe.setApproachProgress(1)
    globe.setOverviewProgress(1)
    globe.endApproach()
    expect(fixture.positions).toHaveLength(count)
    globe.dispose()
    globe.dispose()
    globe.beginApproach()
    globe.setApproachProgress(1)
    globe.setOverviewProgress(1)
    globe.endApproach()
    globe.reset()
    globe.retreat()
    globe.setActive(true)
    expect(fixture.positions).toHaveLength(count)
    expect(fixture.disposeRenderer).toHaveBeenCalledOnce()
  })
})
