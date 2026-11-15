import { AdditiveBlending, BackSide, BufferGeometry, CanvasTexture, Color, DirectionalLight, Float32BufferAttribute, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Points, Raycaster, Scene, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace, Texture, Vector2, Vector3, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { GlobeController, GlobeStatus } from './createMarsGlobe'
import { overviewDistanceForAspect } from './flightPose'
import { cartesianToGeographic, geographicToCartesian, globePointVisible, interpolateGlobeDirection } from './geographicMath'
import type { CartesianPoint, GeographicCoordinate } from './geographicMath'
import { createGlobeTileCache, globeLayerCoversCoordinate, globeOverviewTiles, globeTileUrl, MissingGlobeTile, selectGlobeTiles } from './globeTileLod'
import type { GlobeImageryStatus, GlobeTile, GlobeTileLayer } from './globeTileLod'

export type GlobePointOfInterest = { id: string; name: string; longitude: number; latitude: number; category: string }
export type GeographicGlobeView = { longitude: number; latitude: number; distance: number; level: number; imagery: GlobeImageryStatus; transitioningFrom?: string }
export type GeographicGlobeController = GlobeController & {
  setLayer: (layer: GlobeTileLayer) => void
  setPois: (pois: readonly GlobePointOfInterest[], selectedId?: string | null) => void
  flyTo: (coordinate: GeographicCoordinate, onComplete?: () => void) => void
  getView: () => GeographicGlobeView
  setGeographicView: (coordinate: GeographicCoordinate, distance?: number) => void
  retryImagery: () => void
  setApproachTarget: (coordinate: GeographicCoordinate) => void
}
export type GeographicGlobeOptions = {
  initialLayer: GlobeTileLayer
  pois?: readonly GlobePointOfInterest[]
  onView?: (view: GeographicGlobeView) => void
  onInspectPoi?: (id: string) => void
  onHoverPoi?: (id: string | null) => void
}

type TileAsset = { bitmap: ImageBitmap; texture: Texture; mesh: Mesh<BufferGeometry, MeshStandardMaterial>; started: number }
type SourceCache = { group: Group; cache: ReturnType<typeof createGlobeTileCache<TileAsset>>; overview: GlobeTile[] }
type PoiMarker = { poi: GlobePointOfInterest; sprite: Sprite; label: Sprite }
const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }
const cartesian = (vector: Vector3): CartesianPoint => [vector.x, vector.y, vector.z]
const markerRadius = 1.00008

/** Only alpha is interpreted: visible black/white imagery is never treated as NoData. */
export function rgbaHasVisiblePixels(pixels: Uint8Array | Uint8ClampedArray): boolean {
  if (!pixels.length || pixels.length % 4) throw new RangeError('RGBA pixels are required.')
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) return true
  return false
}

function bitmapHasVisiblePixels(bitmap: ImageBitmap): boolean | undefined {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bitmap.width, bitmap.height) : document.createElement('canvas')
  canvas.width = bitmap.width; canvas.height = bitmap.height
  const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  // A blocked/unavailable readback is not bypassed or inferred to be empty imagery.
  if (!context || typeof context.drawImage !== 'function' || typeof context.getImageData !== 'function') return undefined
  try { context.drawImage(bitmap, 0, 0); return rgbaHasVisiblePixels(context.getImageData(0, 0, bitmap.width, bitmap.height).data) } catch { return undefined }
}

/** Clipped, angular tile mesh. UVs preserve the original tile pixels at footprint edges. */
export function createGlobeTileGeometry(tile: GlobeTile, radius = 1): BufferGeometry {
  const [west, south, east, north] = tile.clippedBounds
  const [tileWest, tileSouth, tileEast, tileNorth] = tile.bounds
  const columns = Math.max(2, Math.min(96, Math.ceil((east - west) / 2)))
  const rows = Math.max(2, Math.min(96, Math.ceil((north - south) / 2)))
  const positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = []
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const longitude = west + (east - west) * column / columns
    const latitude = south + (north - south) * row / rows
    const normal = geographicToCartesian([longitude, latitude])
    positions.push(...normal.map(value => value * radius))
    normals.push(...normal)
    uv.push((longitude - tileWest) / (tileEast - tileWest), (latitude - tileSouth) / (tileNorth - tileSouth))
    if (row < rows && column < columns) {
      const first = row * (columns + 1) + column, next = first + columns + 1
      indices.push(first, first + 1, next, first + 1, next + 1, next)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/** Procedural Milky Way galactic band inspired by authentic celestial orientation and Google Earth style. */
function createMilkyWay() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx && typeof ctx.createRadialGradient === 'function' && typeof ctx.createLinearGradient === 'function' && typeof ctx.fillRect === 'function') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'
    ctx.fillRect(0, 0, 1024, 512)

    // Galactic core bulge
    const coreGrad = ctx.createRadialGradient(512, 256, 10, 512, 256, 210)
    coreGrad.addColorStop(0, 'rgba(235, 212, 180, 0.42)')
    coreGrad.addColorStop(0.25, 'rgba(180, 195, 225, 0.22)')
    coreGrad.addColorStop(0.6, 'rgba(100, 130, 180, 0.10)')
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = coreGrad
    ctx.fillRect(0, 0, 1024, 512)

    // Galactic plane band
    const bandGrad = ctx.createLinearGradient(0, 160, 0, 352)
    bandGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
    bandGrad.addColorStop(0.3, 'rgba(80, 110, 160, 0.08)')
    bandGrad.addColorStop(0.5, 'rgba(170, 190, 225, 0.16)')
    bandGrad.addColorStop(0.7, 'rgba(90, 120, 170, 0.08)')
    bandGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = bandGrad
    ctx.fillRect(0, 160, 1024, 192)

    // Procedural dust clouds & absorption lanes
    let seed = 0x67616c61
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < 90; i++) {
      const cx = random() * 1024
      const distFromCenter = Math.abs(cx - 512) / 512
      const cy = 256 + (random() * 2 - 1) * 35 * (1 - distFromCenter * 0.5)
      const radius = 30 + random() * 70
      const cloudGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius)
      const isWarm = random() > 0.4
      const alpha = (0.05 + random() * 0.12) * (1 - distFromCenter * 0.45)
      if (isWarm) {
        cloudGrad.addColorStop(0, `rgba(220, 195, 170, ${alpha})`)
        cloudGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else {
        cloudGrad.addColorStop(0, `rgba(130, 170, 220, ${alpha})`)
        cloudGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      }
      ctx.fillStyle = cloudGrad
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Great rift / dark dust absorption lanes
    for (let i = 0; i < 35; i++) {
      const rx = 350 + random() * 320
      const ry = 256 + (random() * 2 - 1) * 16
      const rad = 15 + random() * 30
      const darkGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad)
      darkGrad.addColorStop(0, 'rgba(2, 5, 11, 0.28)')
      darkGrad.addColorStop(1, 'rgba(2, 5, 11, 0)')
      ctx.fillStyle = darkGrad
      ctx.beginPath()
      ctx.arc(rx, ry, rad, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const geometry = new SphereGeometry(140, 48, 32)
  const material = new MeshBasicMaterial({
    map: texture,
    side: BackSide,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const mesh = new Mesh(geometry, material)
  mesh.rotation.set(0.65, 0.35, 0.85)
  mesh.renderOrder = -200
  return { mesh, geometry, material, texture }
}

/** Procedural celestial starfield with multi-magnitude stars, Gaussian point shaders and additive blending. */
function createSpace() {
  let seed = 0x4d415253
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const positions: number[] = [], colors: number[] = [], sizes: number[] = []

  // 1. Bright anchor stars with realistic spectral tints (Sirius, Betelgeuse, Vega, Arcturus, Rigel)
  const anchorTints: [number, number, number][] = [
    [0.78, 0.88, 1.0],  // Sirius / Vega blue-white
    [1.0, 0.94, 0.82],  // Solar warm white
    [1.0, 0.72, 0.45],  // Betelgeuse / Aldebaran orange-red
    [1.0, 0.86, 0.58],  // Arcturus golden amber
    [0.72, 0.82, 1.0],  // Rigel electric cyan-blue
  ]
  for (let i = 0; i < 110; i++) {
    const z = random() * 2 - 1, lon = random() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    positions.push(Math.cos(lon) * r * 95, z * 95, Math.sin(lon) * r * 95)
    const tint = anchorTints[Math.floor(random() * anchorTints.length)]
    const brightness = 0.85 + random() * 0.15
    colors.push(tint[0] * brightness, tint[1] * brightness, tint[2] * brightness)
    sizes.push(3.4 + random() * 1.8)
  }

  // 2. Medium stars across the celestial sphere
  for (let i = 0; i < 900; i++) {
    const z = random() * 2 - 1, lon = random() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    positions.push(Math.cos(lon) * r * 95, z * 95, Math.sin(lon) * r * 95)
    const warmth = random()
    const brightness = 0.55 + random() * 0.35
    colors.push(brightness * (0.88 + warmth * 0.12), brightness * 0.94, brightness * (1 - warmth * 0.15))
    sizes.push(1.8 + random() * 1.3)
  }

  // 3. Dense faint stellar field concentrated towards the galactic disk
  const galacticTilt = 0.65
  for (let i = 0; i < 7500; i++) {
    let z = (random() * 2 - 1)
    if (random() > 0.35) {
      z = (random() * 2 - 1) ** 3 * 0.55
    }
    const lon = random() * Math.PI * 2
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    const x0 = Math.cos(lon) * r * 95
    const y0 = z * 95
    const z0 = Math.sin(lon) * r * 95
    const y1 = y0 * Math.cos(galacticTilt) - z0 * Math.sin(galacticTilt)
    const z1 = y0 * Math.sin(galacticTilt) + z0 * Math.cos(galacticTilt)
    positions.push(x0, y1, z1)

    const brightness = 0.18 + random() ** 2 * 0.45
    const warmth = random()
    colors.push(brightness * (0.85 + warmth * 0.15), brightness * 0.92, brightness * (1 - warmth * 0.18))
    sizes.push(0.9 + random() * 0.8)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('starSize', new Float32BufferAttribute(sizes, 1))
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: 'attribute vec3 color; attribute float starSize; varying vec3 tint; void main(){ tint=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=starSize*1.35; }',
    fragmentShader: 'varying vec3 tint; void main(){ vec2 c=gl_PointCoord-vec2(0.5); float d=dot(c,c); if(d>0.25)discard; float a=exp(-d*28.0)+exp(-d*7.0)*0.35; gl_FragColor=vec4(tint*a, a); }',
  })
  return { geometry, material }
}

function markerTexture(name?: string) {
  const canvas = document.createElement('canvas')
  canvas.width = name ? Math.min(512, Math.max(160, name.length * 13 + 28)) : 64
  canvas.height = name ? 48 : 64
  const context = canvas.getContext('2d')
  if (context) {
    if (name) {
      context.fillStyle = 'rgba(5,12,18,0.9)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#edf3f6'
      context.font = '20px Segoe UI, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(name, canvas.width / 2, canvas.height / 2, canvas.width - 20)
    } else {
      context.fillStyle = '#101923'
      context.strokeStyle = '#edf3f6'
      context.lineWidth = 5
      context.beginPath(); context.arc(32, 32, 20, 0, Math.PI * 2); context.fill(); context.stroke()
      context.fillStyle = '#83d7df'; context.beginPath(); context.arc(32, 32, 9, 0, Math.PI * 2); context.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function createGeographicMarsGlobe(host: HTMLElement, onStatus: (status: GlobeStatus) => void, onDistance: ((distance: number) => void) | undefined, options: GeographicGlobeOptions): GeographicGlobeController {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.append(renderer.domElement)
  const scene = new Scene()
  scene.background = new Color(0x02050b)
  const camera = new PerspectiveCamera(40, 1, 0.0001, 200)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false; controls.enableDamping = false; controls.minDistance = 1.0015; controls.maxDistance = 8; controls.zoomSpeed = 0.55
  const bodyGeometry = new SphereGeometry(1, 96, 64)
  // The neutral backdrop never depth-occludes a finer independently tessellated tile.
  // This is a display sphere, not displaced terrain; tile winding culls the far side.
  const bodyMaterial = new MeshStandardMaterial({ color: 0x25272b, roughness: 1, depthWrite: false })
  scene.add(new Mesh(bodyGeometry, bodyMaterial))
  const sun = new DirectionalLight(0xfff5e7, 2.5); sun.position.set(-4, 2, 4)
  scene.add(new HemisphereLight(0xc4d8eb, 0x030509, 0.3), sun)
  const milkyWay = createMilkyWay()
  scene.add(milkyWay.mesh)
  const sky = createSpace()
  const stars = new Points(sky.geometry, sky.material)
  stars.renderOrder = -100
  scene.add(stars)
  const rimGeometry = new SphereGeometry(1.008, 64, 48)
  const rimMaterial = new ShaderMaterial({
    side: BackSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 n; varying vec3 p; void main(){ n=normalize(normalMatrix*normal); vec4 v=modelViewMatrix*vec4(position,1.0); p=v.xyz; gl_Position=projectionMatrix*v; }',
    fragmentShader: 'varying vec3 n; varying vec3 p; void main(){ float rim=pow(1.0-abs(dot(normalize(n),normalize(-p))),3.5); gl_FragColor=vec4(0.58,0.28,0.15,rim*0.18); }',
  })
  const rim = new Mesh(rimGeometry, rimMaterial)
  scene.add(rim)
  const raycaster = new Raycaster(), pointer = new Vector2()
  let layer = options.initialLayer
  const sourceKeyFor = (source: GlobeTileLayer) => JSON.stringify([source.id, source.coverage, source.minZoom, source.maxZoom, source.tileSource])
  let sourceKey = sourceKeyFor(layer)
  const sourceCaches = new Map<string, SourceCache>()
  let tileGroup = new Group(); scene.add(tileGroup)
  let oldGroup: Group | undefined, oldCache: ReturnType<typeof createGlobeTileCache<TileAsset>> | undefined, previousLayer: string | undefined
  let cache: ReturnType<typeof createGlobeTileCache<TileAsset>>
  let markers: PoiMarker[] = [], markerSignature = '', selectedId: string | null = null, hoveredId: string | null = null
  let disposed = false, active = true, contextFailed = false, frame: number | undefined, lodTimer: ReturnType<typeof setTimeout> | undefined
  let height = 600, level = 0, previousLodLevel: number | undefined, lastSelection = '', lastViewAt = 0, sourceFadeStarted: number | undefined
  let approach: { start: CartesianPoint; overview: number; target: GeographicCoordinate } | undefined
  let approachTarget: GeographicCoordinate = [77.69, 18.41]
  let flight: { started: number; start: CartesianPoint; startDistance: number; target: CartesianPoint; duration: number; onComplete?: () => void } | undefined
  let zoomFlight: { started: number; startDistance: number; targetDistance: number; duration: number } | undefined
  let down: { x: number; y: number } | undefined
  const overviewDistance = () => overviewDistanceForAspect(camera.aspect)
  const imageryAtCenter = (coordinate: GeographicCoordinate): GlobeImageryStatus => { const status = cache.status(); return globeLayerCoversCoordinate(layer, coordinate) ? status : { ...status, phase: 'outside' } }
  const view = (): GeographicGlobeView => { const coordinate = cartesianToGeographic(cartesian(camera.position)); return { longitude: coordinate[0], latitude: coordinate[1], distance: camera.position.length(), level, imagery: imageryAtCenter(coordinate), ...(previousLayer ? { transitioningFrom: previousLayer } : {}) } }
  const release = (asset: TileAsset) => { asset.mesh.removeFromParent(); asset.mesh.geometry.dispose(); asset.mesh.material.dispose(); asset.texture.dispose(); asset.bitmap.close() }
  const notifyView = (force = false) => { const now = performance.now(); if (!disposed && (force || now - lastViewAt > 150)) { lastViewAt = now; options.onView?.(view()) } }
  function requestFrame() { if (!disposed && !contextFailed && frame === undefined) frame = requestAnimationFrame(draw) }
  function makeCache(sourceLayer: GlobeTileLayer, group: Group) {
    return createGlobeTileCache<TileAsset>(async (tile, signal) => {
      signal.throwIfAborted()
      const abortRequest = new AbortController()
      const timeout = setTimeout(() => abortRequest.abort(), 20_000)
      const cancel = () => abortRequest.abort()
      signal.addEventListener('abort', cancel, { once: true })
      try {
        const response = await fetch(globeTileUrl(sourceLayer, tile), { signal: abortRequest.signal, mode: 'cors', credentials: 'omit' })
        if (response.status === 404 || response.status === 204) throw new MissingGlobeTile('No image tile is available.')
        if (!response.ok) throw new Error(`Image request failed (${response.status}).`)
        if (!(response.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('The imagery service returned a non-image response.')
        const blob = await response.blob()
        if (blob.size < 16) throw new MissingGlobeTile('Empty imagery tile.')
        if (blob.size > 8_000_000) throw new Error('Image tile exceeds the bounded request size.')
        signal.throwIfAborted()
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' })
        if (signal.aborted || disposed) { bitmap.close(); throw new DOMException('Aborted', 'AbortError') }
        if (bitmap.width !== sourceLayer.tileSource.tileSize || bitmap.height !== sourceLayer.tileSource.tileSize) { bitmap.close(); throw new Error('Image dimensions do not match the verified tile contract.') }
        if (bitmapHasVisiblePixels(bitmap) === false) { bitmap.close(); throw new MissingGlobeTile('The decoded tile contains no visible image pixels.') }
        const texture = new Texture(bitmap); texture.colorSpace = SRGBColorSpace; texture.flipY = false; texture.needsUpdate = true
        const material = new MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 1, transparent: true, opacity: 0, depthWrite: false })
        const mesh = new Mesh(createGlobeTileGeometry(tile, 1 + (tile.level + 1) * 0.000002), material)
        mesh.renderOrder = tile.level + 1
        mesh.userData.globeLayerId = sourceLayer.id; mesh.userData.tileKey = tile.key
        group.add(mesh)
        return { bitmap, texture, mesh, started: performance.now() }
      } finally { clearTimeout(timeout); signal.removeEventListener('abort', cancel) }
    }, release, () => { notifyView(true); if (active || approach || flight) requestFrame() }, { capacity: 64, concurrency: 4, retainReady: true })
  }
  cache = makeCache(layer, tileGroup)
  sourceCaches.set(sourceKey, { group: tileGroup, cache, overview: globeOverviewTiles(layer) })
  function hideOldSource() {
    if (!oldGroup || !oldCache) return
    const overview = [...sourceCaches.values()].find(source => source.group === oldGroup)?.overview ?? []
    oldGroup.visible = false; oldCache.trim(16, overview)
    oldCache = undefined; oldGroup = undefined; previousLayer = undefined; sourceFadeStarted = undefined
  }
  function evictSources() {
    for (const [key, source] of sourceCaches) {
      if (sourceCaches.size <= 2) break
      if (key === sourceKey || source.group === oldGroup) continue
      source.cache.dispose(); source.group.removeFromParent(); sourceCaches.delete(key)
    }
  }
  function updateLod() {
    if (disposed || contextFailed) return
    if (!active && !approach && !flight) { lastSelection = ''; cache.update([]); return }
    const coordinate = cartesianToGeographic(cartesian(camera.position))
    const overview = sourceCaches.get(sourceKey)!.overview
    const result = selectGlobeTiles(layer, coordinate, camera.position.length(), height, camera.aspect, camera.fov, 64 - overview.length, previousLodLevel)
    level = result.level; previousLodLevel = level
    const signature = `${layer.id}:${result.tiles.map(tile => tile.key).join(',')}`
    if (signature !== lastSelection) { lastSelection = signature; cache.update(result.tiles, result.tiles.length ? overview : []) }
    if ((!result.tiles.length || !globeLayerCoversCoordinate(layer, coordinate)) && oldCache) hideOldSource()
    notifyView(true)
    requestFrame()
  }
  function scheduleLod() { if (lodTimer === undefined) lodTimer = setTimeout(() => { lodTimer = undefined; updateLod() }, 140) }
  function updateMarkers() {
    const cameraPoint = cartesian(camera.position)
    const candidates = markers.filter(marker => globePointVisible(geographicToCartesian([marker.poi.longitude, marker.poi.latitude], markerRadius), cameraPoint))
    candidates.sort((a, b) => Number(b.poi.id === selectedId) - Number(a.poi.id === selectedId))
    const occupied: Vector3[] = [], close = camera.position.length() < 2.4
    const pixelScale = 2 * Math.tan(camera.fov * Math.PI / 360) / height
    for (const marker of markers) { marker.sprite.visible = false; marker.label.visible = false }
    for (const marker of candidates) {
      const screen = marker.sprite.position.clone().project(camera)
      if (Math.abs(screen.x) > 1.05 || Math.abs(screen.y) > 1.05 || screen.z > 1) continue
      const collision = occupied.some(other => Math.hypot((screen.x - other.x) * renderer.domElement.clientWidth / 2, (screen.y - other.y) * height / 2) < 28)
      if (marker.poi.id !== selectedId && (collision || (!close && occupied.length >= 12))) continue
      marker.sprite.visible = true
      marker.sprite.scale.setScalar(pixelScale * (marker.poi.id === selectedId ? 24 : 18))
      marker.label.visible = marker.poi.id === selectedId || marker.poi.id === hoveredId
      const labelImage = marker.label.material.map?.image as HTMLCanvasElement | undefined
      marker.label.scale.set(pixelScale * Math.min(240, (labelImage?.width ?? 160) * 0.5), pixelScale * 24, 1)
      const markerDepth = -marker.sprite.position.clone().applyMatrix4(camera.matrixWorldInverse).z
      marker.label.position.copy(marker.sprite.position).addScaledVector(new Vector3(0, 1, 0).applyQuaternion(camera.quaternion), pixelScale * markerDepth * 30)
      occupied.push(screen)
    }
  }
  function draw(now: number) {
    frame = undefined
    if (disposed || contextFailed) return
    let animate = false
    if (zoomFlight) {
      const t = Math.min(1, (now - zoomFlight.started) / zoomFlight.duration), amount = ease(t)
      const altitude = Math.exp(Math.log(zoomFlight.startDistance - 1) * (1 - amount) + Math.log(zoomFlight.targetDistance - 1) * amount)
      camera.position.setLength(1 + altitude); controls.update(); scheduleLod()
      if (t < 1) animate = true
      else { zoomFlight = undefined; updateLod() }
    }
    if (flight) {
      const t = Math.min(1, (now - flight.started) / flight.duration), amount = ease(t)
      const direction = interpolateGlobeDirection(flight.start, flight.target, amount)
      const distance = Math.exp(Math.log(flight.startDistance) * (1 - amount) + Math.log(1.12) * amount)
      camera.position.set(...direction).multiplyScalar(distance)
      camera.lookAt(0, 0, 0)
      scheduleLod()
      if (t < 1) animate = true
      else { const completed = flight.onComplete; flight = undefined; controls.enabled = active && !approach; controls.update(); updateLod(); completed?.() }
    }
    const ready = cache.ready(), imageryStatus = imageryAtCenter(cartesianToGeographic(cartesian(camera.position)))
    if (oldGroup && oldCache && ['error', 'outside'].includes(imageryStatus.phase)) { hideOldSource(); notifyView(true) }
    if (oldGroup && oldCache && ready.some(entry => entry.visible)) {
      const overview = sourceCaches.get(sourceKey)!.overview
      const overviewReady = overview.every(tile => ready.some(entry => entry.tile.key === tile.key))
      if (sourceFadeStarted === undefined && (overviewReady || imageryStatus.pending === 0)) sourceFadeStarted = now
    }
    const sourceFade = sourceFadeStarted === undefined ? 1 : Math.min(1, Math.max(0, (now - sourceFadeStarted) / 320))
    for (const entry of ready) {
      entry.resource.mesh.visible = entry.visible
      const opacity = Math.min(1, Math.max(0, (now - entry.resource.started) / 320))
      entry.resource.mesh.material.opacity = opacity * sourceFade
      if (entry.visible && opacity < 1) animate = true
    }
    if (oldGroup && oldCache && sourceFadeStarted !== undefined) {
      for (const entry of oldCache.ready()) entry.resource.mesh.material.opacity = 1 - sourceFade
      if (sourceFade === 1) { hideOldSource(); notifyView(true) }
      else animate = true
    }
    camera.updateMatrixWorld(true)
    rim.visible = camera.position.length() > 1.03
    updateMarkers()
    renderer.render(scene, camera)
    notifyView()
    if (active && !approach && !flight) onDistance?.(camera.position.length())
    if (animate) requestFrame()
  }
  function cancelFlight() { flight = undefined; zoomFlight = undefined; controls.enabled = active && !approach && !contextFailed }
  function startZoom(factor: number) {
    if (disposed || contextFailed || !active || approach || !Number.isFinite(factor) || factor <= 0) return
    const goal = zoomFlight?.targetDistance ?? camera.position.length()
    const targetDistance = Math.max(controls.minDistance, Math.min(controls.maxDistance, 1 + (goal - 1) * factor))
    flight = undefined; controls.enabled = active && !approach
    zoomFlight = { started: performance.now(), startDistance: camera.position.length(), targetDistance, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 220 }
    requestFrame()
  }
  function endApproach() { if (disposed) return; approach = undefined; controls.enabled = active && !contextFailed; controls.update(); scheduleLod(); requestFrame() }
  function setGeographicView(coordinate: GeographicCoordinate, distance = camera.position.length()) {
    if (disposed || contextFailed || !Number.isFinite(distance)) return
    const point = geographicToCartesian(coordinate, Math.max(controls.minDistance, Math.min(controls.maxDistance, distance)))
    cancelFlight(); approach = undefined; controls.enabled = active && !contextFailed; camera.position.set(...point); controls.target.set(0, 0, 0); controls.update(); updateLod()
  }
  function resize() {
    const size = host.getBoundingClientRect()
    if (disposed || size.width < 1 || size.height < 1) return
    const framingOverview = !flight && !zoomFlight && !approach && Math.abs(camera.position.length() - overviewDistance()) < 0.01
    height = size.height; camera.aspect = size.width / size.height
    if (framingOverview) camera.position.setLength(overviewDistance())
    camera.updateProjectionMatrix(); renderer.setSize(size.width, size.height); updateLod()
  }
  const controlChange = () => { if (disposed) return; scheduleLod(); requestFrame() }
  controls.addEventListener('change', controlChange)
  const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; cancelFlight() }
  function pick(event: PointerEvent): PoiMarker | undefined {
    const bounds = renderer.domElement.getBoundingClientRect()
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1)
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(markers.filter(marker => marker.sprite.visible).map(marker => marker.sprite))
    return hits.length ? markers.find(marker => marker.sprite === hits[0].object) : undefined
  }
  const pointerMove = (event: PointerEvent) => { if (!active || approach || disposed) return; const id = pick(event)?.poi.id ?? null; if (id !== hoveredId) { hoveredId = id; renderer.domElement.style.cursor = id ? 'pointer' : ''; options.onHoverPoi?.(id); requestFrame() } }
  const pointerLeave = () => { hoveredId = null; options.onHoverPoi?.(null); requestFrame() }
  const pointerUp = (event: PointerEvent) => { if (active && down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6) { const marker = pick(event); if (marker) options.onInspectPoi?.(marker.poi.id) }; down = undefined }
  const wheel = (event: WheelEvent) => {
    if (!active || approach || disposed || contextFailed) return
    event.preventDefault(); event.stopImmediatePropagation()
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1)
    startZoom(Math.exp(Math.max(-0.35, Math.min(0.35, delta * 0.0015))))
  }
  renderer.domElement.addEventListener('pointerdown', pointerDown)
  renderer.domElement.addEventListener('pointermove', pointerMove)
  renderer.domElement.addEventListener('pointerleave', pointerLeave)
  renderer.domElement.addEventListener('pointerup', pointerUp)
  renderer.domElement.addEventListener('wheel', wheel, { passive: false, capture: true })
  const contextLost = (event: Event) => { event.preventDefault(); contextFailed = true; cancelFlight(); controls.enabled = false; for (const source of sourceCaches.values()) source.cache.dispose(); clearTimeout(lodTimer); lodTimer = undefined; if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; onStatus({ phase: 'error', message: 'The 3D graphics context was lost. Retry the globe or use the regional map.' }) }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  const observer = new ResizeObserver(resize); observer.observe(host)
  function setPois(pois: readonly GlobePointOfInterest[], selection: string | null = null) {
    if (disposed) return
    const signature = JSON.stringify(pois.map(poi => [poi.id, poi.name, poi.category, poi.longitude, poi.latitude]))
    selectedId = selection
    if (signature === markerSignature) { requestFrame(); return }
    markerSignature = signature
    if (hoveredId && !pois.some(poi => poi.id === hoveredId)) { hoveredId = null; renderer.domElement.style.cursor = ''; options.onHoverPoi?.(null) }
    for (const marker of markers) for (const sprite of [marker.sprite, marker.label]) { sprite.removeFromParent(); sprite.material.map?.dispose(); sprite.material.dispose() }
    markers = pois.flatMap(poi => {
      if (!Number.isFinite(poi.longitude) || !Number.isFinite(poi.latitude) || poi.latitude < -90 || poi.latitude > 90) return []
      const sprite = new Sprite(new SpriteMaterial({ map: markerTexture(), sizeAttenuation: false, depthTest: true }))
      const label = new Sprite(new SpriteMaterial({ map: markerTexture(poi.name), sizeAttenuation: false, depthTest: false, depthWrite: false }))
      sprite.position.set(...geographicToCartesian([poi.longitude, poi.latitude], markerRadius)); sprite.renderOrder = 100; label.renderOrder = 101
      scene.add(sprite, label)
      return [{ poi, sprite, label }]
    })
    requestFrame()
  }
  camera.position.set(...geographicToCartesian([20, 10], overviewDistance()))
  controls.update(); resize(); setPois(options.pois ?? []); onStatus({ phase: 'ready', message: 'Geographic Mars globe ready; imagery streams separately.' }); requestFrame()
  return {
    rotate(horizontal, vertical) { if (!disposed && !contextFailed && !approach && Number.isFinite(horizontal) && Number.isFinite(vertical)) { cancelFlight(); camera.position.setFromSphericalCoords(camera.position.length(), Math.max(0.001, Math.min(Math.PI - 0.001, controls.getPolarAngle() + vertical)), controls.getAzimuthalAngle() + horizontal); controls.update(); scheduleLod(); requestFrame() } },
    zoom: startZoom,
    reset() { endApproach(); setGeographicView([20, 10], overviewDistance()) },
    retreat() { if (!disposed) { endApproach(); cancelFlight(); camera.position.setLength(overviewDistance()); controls.update(); updateLod() } },
    beginApproach() { if (!disposed && !contextFailed && !approach) { cancelFlight(); approach = { start: cartesian(camera.position), overview: overviewDistance(), target: approachTarget }; controls.enabled = false } },
    setOverviewProgress(value) { if (!disposed && approach && Number.isFinite(value)) { const t = ease(value), radius = Math.exp(Math.log(Math.hypot(...approach.start)) * (1 - t) + Math.log(approach.overview) * t); camera.position.set(...approach.start).setLength(radius); camera.lookAt(0, 0, 0); scheduleLod(); requestFrame() } },
    setApproachProgress(value) { if (!disposed && approach && Number.isFinite(value)) { const t = ease(value); camera.position.set(...interpolateGlobeDirection(approach.start, geographicToCartesian(approach.target), t)).multiplyScalar(Math.exp(Math.log(approach.overview) * (1 - t) + Math.log(1.9) * t)); camera.lookAt(0, 0, 0); scheduleLod(); requestFrame() } },
    setApproachTarget(coordinate) { geographicToCartesian(coordinate); approachTarget = coordinate },
    endApproach,
    setActive(value) { if (disposed) return; active = value; if (!value) cancelFlight(); controls.enabled = value && !approach && !flight && !contextFailed; if (value) { resize(); requestFrame() } else if (!approach) { clearTimeout(lodTimer); lodTimer = undefined; lastSelection = ''; cache.update([]); if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined } },
    setLayer(next) {
      const nextKey = sourceKeyFor(next)
      if (disposed || contextFailed || nextKey === sourceKey) return
      hideOldSource()
      oldCache = cache; oldCache.update([]); oldGroup = tileGroup; previousLayer = layer.id
      layer = next; sourceKey = nextKey; previousLodLevel = undefined; sourceFadeStarted = undefined
      let source = sourceCaches.get(sourceKey)
      if (!source) { const group = new Group(); scene.add(group); source = { group, cache: makeCache(next, group), overview: globeOverviewTiles(next) } }
      sourceCaches.delete(sourceKey); sourceCaches.set(sourceKey, source)
      tileGroup = source.group; tileGroup.visible = true; cache = source.cache; lastSelection = ''
      evictSources()
      if (active || approach) updateLod()
    },
    setPois,
    flyTo(coordinate, onComplete) { if (disposed || contextFailed) return; const target = geographicToCartesian(coordinate); approach = undefined; flight = { started: performance.now(), start: cartesian(camera.position), startDistance: camera.position.length(), target, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1100, onComplete }; controls.enabled = false; requestFrame() },
    getView: view,
    setGeographicView,
    retryImagery() { if (!disposed) { cache.retry(); updateLod() } },
    dispose() {
      if (disposed) return
      disposed = true; flight = undefined; zoomFlight = undefined; approach = undefined; for (const source of sourceCaches.values()) source.cache.dispose(); sourceCaches.clear(); observer.disconnect(); clearTimeout(lodTimer); if (frame !== undefined) cancelAnimationFrame(frame)
      controls.removeEventListener('change', controlChange); controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointerleave', pointerLeave); renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.domElement.removeEventListener('wheel', wheel, true)
      for (const marker of markers) for (const sprite of [marker.sprite, marker.label]) { sprite.material.map?.dispose(); sprite.material.dispose() }
      bodyGeometry.dispose(); bodyMaterial.dispose(); sky.geometry.dispose(); sky.material.dispose(); milkyWay.geometry.dispose(); milkyWay.material.dispose(); milkyWay.texture.dispose(); rimGeometry.dispose(); rimMaterial.dispose()
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
    },
  }
}
