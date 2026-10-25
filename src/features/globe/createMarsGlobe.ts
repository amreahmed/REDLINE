import { Box3, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Texture, Vector3, WebGLRenderer } from 'three'
import type { Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { fetchGlobeAsset, GlobeAssetError } from './asset'

export type GlobeStatus = { phase: 'loading' | 'ready' | 'error'; message: string }
export type GlobeController = { rotate: (horizontal: number, vertical: number) => void; zoom: (factor: number) => void; reset: () => void; retreat: () => void; setActive: (active: boolean) => void; dispose: () => void }

function releaseModel(root: Object3D) {
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
      material.dispose()
    }
  })
  for (const texture of textures) {
    texture.dispose()
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close()
  }
}

/** Arbitrary display units only; deliberately has no Mars coordinate/measurement API. */
export function createMarsGlobe(host: HTMLElement, onStatus: (status: GlobeStatus) => void, onDistance?: (distance: number) => void): GlobeController {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.append(renderer.domElement)
  const scene = new Scene()
  const camera = new PerspectiveCamera(40, 1, 0.1, 50)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableDamping = false
  controls.minDistance = 1.8
  controls.maxDistance = 8
  controls.zoomSpeed = 0.65
  const light = new DirectionalLight(0xffffff, 2.5)
  light.position.set(-3, 2, 4)
  scene.add(new HemisphereLight(0xffffff, 0x594b42, 2), light)
  let disposed = false
  let ready = false
  let active = true
  let model: Object3D | undefined
  let decodeTimer: ReturnType<typeof setTimeout> | undefined
  const abort = new AbortController()
  const report = (status: GlobeStatus) => { if (!disposed) onStatus(status) }
  function render() {
    if (!disposed && ready) {
      renderer.render(scene, camera)
      if (active) onDistance?.(camera.position.length())
    }
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect()
    if (width < 1 || height < 1 || disposed) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    render()
  }
  function overviewDistance() { return Math.min(7, Math.max(3.8, 1.35 / Math.sin(Math.atan(Math.tan(20 * Math.PI / 180) * Math.min(camera.aspect, 1))))) }
  function reset() {
    camera.position.set(0, 0, overviewDistance())
    controls.target.set(0, 0, 0)
    controls.update()
    render()
  }
  function fail(message: string) {
    ready = false
    renderer.clear()
    report({ phase: 'error', message })
  }
  const contextLost = (event: Event) => {
    event.preventDefault()
    abort.abort()
    clearTimeout(decodeTimer)
    fail('The 3D graphics context was lost. Retry the globe or use the regional map.')
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  controls.addEventListener('change', render)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  reset()

  void (async () => {
    try {
      report({ phase: 'loading', message: 'Downloading NASA’s visual Mars model…' })
      const bytes = await fetchGlobeAsset(abort.signal, (count) => report({ phase: 'loading', message: `Downloading NASA model · ${(count / 1_000_000).toFixed(1)} MB received` }))
      abort.signal.throwIfAborted()
      report({ phase: 'loading', message: 'Preparing NASA model and textures…' })
      let decodeExpired = false
      decodeTimer = setTimeout(() => { decodeExpired = true; fail('Model textures took too long to prepare. Retry or use the regional map.') }, 30_000)
      const gltf = await new GLTFLoader().parseAsync(bytes, '')
      clearTimeout(decodeTimer)
      if (disposed || abort.signal.aborted || decodeExpired) { releaseModel(gltf.scene); return }
      model = gltf.scene
      let texturedMeshes = 0
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        if (!materials.every((material) => material instanceof MeshStandardMaterial && material.map?.image && material.normalMap?.image)) throw new GlobeAssetError('The model textures could not be prepared. No untextured substitute is shown.')
        texturedMeshes++
      })
      const bounds = new Box3().setFromObject(model)
      const size = bounds.getSize(new Vector3())
      const displayRadius = Math.max(size.x, size.y, size.z) / 2
      if (!texturedMeshes || !Number.isFinite(displayRadius) || displayRadius <= 0) throw new GlobeAssetError('The model geometry could not be prepared.')
      const display = new Group()
      display.add(model)
      model.position.sub(bounds.getCenter(new Vector3()))
      display.scale.setScalar(1 / displayRadius)
      scene.add(display)
      ready = true
      resize()
      reset()
      report({ phase: 'ready', message: 'NASA visual model loaded' })
    } catch (error) {
      clearTimeout(decodeTimer)
      if (disposed || abort.signal.aborted) return
      if (model) { releaseModel(model); model = undefined }
      fail(error instanceof GlobeAssetError ? error.message : 'The 3D model could not be prepared. Retry or continue with the regional map.')
    }
  })()

  return {
    rotate: (horizontal, vertical) => {
      if (!ready) return
      // Orbit angles are view controls, not geodetic longitude or latitude.
      const radius = camera.position.length()
      const theta = controls.getAzimuthalAngle() + horizontal
      const phi = Math.max(0.05, Math.min(Math.PI - 0.05, controls.getPolarAngle() + vertical))
      camera.position.copy(new Vector3().setFromSphericalCoords(radius, phi, theta))
      controls.update()
    },
    zoom: (factor) => {
      if (!ready) return
      camera.position.setLength(Math.max(controls.minDistance, Math.min(controls.maxDistance, camera.position.length() * factor)))
      controls.update()
    },
    reset,
    retreat: () => { camera.position.setLength(overviewDistance()); controls.update(); render() },
    setActive: (value) => { active = value; controls.enabled = value; if (value) { resize(); render() } },
    dispose: () => {
      disposed = true
      abort.abort()
      clearTimeout(decodeTimer)
      observer.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      if (model) releaseModel(model)
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
