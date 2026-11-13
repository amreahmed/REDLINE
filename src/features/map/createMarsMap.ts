import ImageTile from 'ol/ImageTile'
import OlMap from 'ol/Map'
import type MapBrowserEvent from 'ol/MapBrowserEvent'
import TileState from 'ol/TileState'
import View from 'ol/View'
import { defaults as defaultInteractions } from 'ol/interaction/defaults'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import type Feature from 'ol/Feature'
import type Point from 'ol/geom/Point'
import type Tile from 'ol/Tile'
import { JEZERO_EXTENT, MARS_LAYERS } from '../../data/marsLayers'
import { JEZERO_CONTEXT_ZOOM, JEZERO_DETAIL_ZOOM } from '../../data/jezero'
import { readCapabilities } from './capabilities'
import { coverageForView, MAX_LEVEL, WORLD_EXTENT } from './grid'
import { createDisplayProjection, createTileSource } from './mapProjection'
import { requestTile, requestXml, ResourceError } from './requests'
import { initialLayerStatus } from './types'
import { clampApproachZoom, clampDetailOpacity, jezeroCenter } from './jezeroView'
import { FrameAwareTileLayer } from './FrameAwareTileLayer'
import { createAlphaSupport } from './frameReadiness'
import type { ImageSupport } from './frameReadiness'
import type { Bounds, LayerDefinition, LayerId, LayerStatus, LayerVisibility, ViewStatus } from './types'
import { toDisplayCoordinate } from '../mission/coordinates'
import type { MissionSelection, ScienceTarget, TargetId } from '../mission/types'
import { createMissionFeatures, missionFeatureStyle, missionTargetId } from './featureMarkers'

type LayerRun = { abort: AbortController; status: LayerStatus; imageSupport: WeakMap<Tile, ImageSupport> }
export type MarsMapController = {
  setVisibility: (visibility: LayerVisibility) => void
  retry: (id: LayerId) => void
  reset: () => void
  refresh: () => void
  setActive: (active: boolean) => void
  enterContext: (atJezero: boolean, minimumZoom: number) => void
  focusJezero: () => void
  prepareJezeroApproach: () => void
  setApproachZoom: (zoom: number) => void
  setDetailOpacity: (opacity: number) => void
  hasRenderedImagery: (id?: LayerId) => boolean
  setMissionFeatures: (targets: readonly ScienceTarget[], selection: MissionSelection, selectedId: TargetId | null) => void
  focusReference: (target: ScienceTarget) => boolean
  panBy: (horizontal: number, vertical: number) => void
  zoomBy: (delta: number) => void
  dispose: () => void
}

/** Owns the renderer lifecycle; no terrain or physical measurement APIs. */
export function createMarsMap(target: HTMLElement, onStatus: (id: LayerId, status: LayerStatus) => void, onView: (status: ViewStatus) => void, options: { keyboard?: boolean; onInspectTarget?: (id: TargetId) => void } = {}): MarsMapController {
  const projection = createDisplayProjection()
  const view = new View({ projection, resolutions: Array.from({ length: MAX_LEVEL + 1 }, (_, z) => 0.703125 / 2 ** z), extent: WORLD_EXTENT, constrainOnlyCenter: true, enableRotation: false })
  const layers = new Map<LayerId, FrameAwareTileLayer>()
  const runs = new Map<LayerId, LayerRun>()
  const missionSource = new VectorSource<Feature<Point>>({ wrapX: false })
  const missionLayer = new VectorLayer({ source: missionSource, style: missionFeatureStyle, zIndex: 20, minZoom: 6, declutter: true })
  let disposed = false
  let active = true
  let alphaCanvas: HTMLCanvasElement | undefined
  for (const definition of MARS_LAYERS) layers.set(definition.id, new FrameAwareTileLayer({ extent: definition.extent, cacheSize: 128 }))
  const map = new OlMap({
    target,
    view,
    layers: [...layers.values(), missionLayer],
    controls: [],
    interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false, keyboard: options.keyboard }),
    maxTilesLoading: 8,
  })
  const inspectMarker = (event: MapBrowserEvent) => {
    if (disposed || !active) return
    const id = map.forEachFeatureAtPixel(event.pixel, (feature) => missionTargetId(feature), { layerFilter: (layer) => layer === missionLayer, hitTolerance: 10 })
    if (id) options.onInspectTarget?.(id)
  }
  map.on('singleclick', inspectMarker)

  function emit(definition: LayerDefinition, run: LayerRun) {
    if (disposed || run.abort.signal.aborted || runs.get(definition.id) !== run) return
    const extent = view.calculateExtent(map.getSize()) as Bounds
    onStatus(definition.id, { ...run.status, coverage: coverageForView(extent, definition.extent), enlarged: (view.getResolution() ?? 1) < 0.703125 / 2 ** definition.maxLevel })
  }

  async function loadTile(tile: Tile, url: string, definition: LayerDefinition, run: LayerRun) {
    if (!(tile instanceof ImageTile)) { tile.setState(TileState.ERROR); return }
    const signal = run.abort.signal
    run.status.pending++
    emit(definition, run)
    let objectUrl: string | undefined
    try {
      const blob = await requestTile(url, definition.format, signal)
      signal.throwIfAborted()
      objectUrl = URL.createObjectURL(blob)
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      signal.throwIfAborted()
      if (image.naturalWidth !== 256 || image.naturalHeight !== 256) throw new ResourceError('content', 'Unexpected tile dimensions; imagery was not displayed.')
      // Alpha is only a display-readiness check; grayscale values are never terrain data.
      let support: ImageSupport = { hasPixels: definition.format === 'image/jpeg' }
      if (!support.hasPixels) {
        try {
          alphaCanvas ??= document.createElement('canvas')
          alphaCanvas.width = 256
          alphaCanvas.height = 256
          const context = alphaCanvas.getContext('2d', { willReadFrequently: true })
          if (context) { context.drawImage(image, 0, 0); support = createAlphaSupport(context.getImageData(0, 0, 256, 256).data, 256, 256) }
        } catch {
          // A readback restriction must not invent readiness or block normal imagery rendering.
          support = { hasPixels: false }
        }
      }
      if (support.hasPixels) run.imageSupport.set(tile, support)
      tile.setImage(image)
      run.status.loaded++
    } catch (error) {
      if (signal.aborted) {
        tile.setState(TileState.EMPTY)
      } else if (error instanceof ResourceError && error.kind === 'missing') {
        run.status.missing++
        tile.setState(TileState.EMPTY)
      } else {
        run.status.failed++
        run.status.detail = error instanceof ResourceError ? error.message : 'The returned image could not be decoded.'
        tile.setState(TileState.ERROR)
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      run.status.pending--
      emit(definition, run)
    }
  }

  async function connect(definition: LayerDefinition) {
    const layer = layers.get(definition.id)!
    layer.invalidateFrame()
    runs.get(definition.id)?.abort.abort()
    const oldSource = layer.getSource()
    layer.setSource(null)
    oldSource?.dispose()
    const run: LayerRun = { abort: new AbortController(), status: initialLayerStatus(), imageSupport: new WeakMap() }
    runs.set(definition.id, run)
    emit(definition, run)
    try {
      const xml = await requestXml(definition.capabilitiesUrl, run.abort.signal)
      const contract = readCapabilities(xml, definition)
      run.abort.signal.throwIfAborted()
      const source = createTileSource(definition, contract, projection, (tile, url) => { void loadTile(tile, url, definition, run) })
      run.status.phase = 'available'
      layer.setSource(source)
      emit(definition, run)
    } catch (error) {
      if (run.abort.signal.aborted || disposed) return
      run.status.phase = 'unavailable'
      run.status.detail = error instanceof Error ? error.message : 'Service metadata could not be loaded.'
      emit(definition, run)
    }
  }

  function reportView() {
    const center = view.getCenter()
    const zoom = view.getZoom()
    if (!center || zoom === undefined || disposed) return
    onView({ center: [center[0], center[1]], zoom, canZoomIn: zoom < MAX_LEVEL - 0.001, canZoomOut: zoom > 0.001 })
    for (const definition of MARS_LAYERS) {
      const run = runs.get(definition.id)
      if (run) emit(definition, run)
    }
  }
  function reset() {
    map.updateSize()
    view.fit(JEZERO_EXTENT, { size: map.getSize(), padding: [24, 24, 24, 24], maxZoom: MAX_LEVEL, duration: 0 })
    reportView()
  }
  map.on('moveend', reportView)
  function refresh() {
    if (!target.clientWidth || !target.clientHeight || disposed) return
    map.updateSize()
    reportView()
  }
  function setApproachZoom(zoom: number) {
    if (disposed) return
    view.setCenter(jezeroCenter())
    view.setZoom(clampApproachZoom(zoom))
    reportView()
  }

  function hasRenderedImagery(id?: LayerId) {
    if (disposed) return false
    const size = map.getSize()
    const center = view.getCenter()
    const resolution = view.getResolution()
    if (!size || !center || !resolution || size[0] <= 0 || size[1] <= 0) return false
    const current = { center: [center[0], center[1]] as [number, number], resolution, size: [size[0], size[1]] as [number, number] }
    const extent = view.calculateExtent(size) as Bounds
    return [...layers].some(([layerId, layer]) => {
      const run = runs.get(layerId)
      return (!id || layerId === id) && !!run && !run.abort.signal.aborted && layer.hasCurrentImagery(current, extent, run.imageSupport)
    })
  }

  const resizeObserver = new ResizeObserver(refresh)
  resizeObserver.observe(target)
  reset()
  for (const definition of MARS_LAYERS) void connect(definition)

  return {
    setVisibility: (visibility) => { if (!disposed) for (const [id, layer] of layers) { if (layer.getVisible() !== visibility[id]) layer.invalidateFrame(); layer.setVisible(visibility[id]) } },
    retry: (id) => { const definition = MARS_LAYERS.find((layer) => layer.id === id); if (definition && !disposed) void connect(definition) },
    reset,
    refresh,
    setActive: (value) => { if (disposed) return; active = value; missionLayer.setVisible(value); view.cancelAnimations(); map.getInteractions().forEach((interaction) => interaction.setActive(value)); if (value) refresh() },
    enterContext: (atJezero, minimumZoom) => { refresh(); if (atJezero) view.setCenter(jezeroCenter()); view.setZoom(atJezero ? minimumZoom : Math.max(minimumZoom, view.getZoom() ?? minimumZoom)); reportView() },
    focusJezero: () => { if (!disposed) { view.cancelAnimations(); view.setCenter(jezeroCenter()); view.setZoom(JEZERO_DETAIL_ZOOM); reportView() } },
    prepareJezeroApproach: () => { if (!disposed) { view.cancelAnimations(); for (const layer of layers.values()) layer.invalidateFrame(); refresh(); setApproachZoom(JEZERO_CONTEXT_ZOOM) } },
    setApproachZoom,
    setDetailOpacity: (opacity) => { if (!disposed) layers.get('ctx')?.setOpacity(clampDetailOpacity(opacity)) },
    hasRenderedImagery,
    setMissionFeatures: (targets, selection, selectedId) => {
      if (disposed) return
      missionSource.clear(true)
      missionSource.addFeatures(createMissionFeatures(targets, selection, selectedId))
    },
    focusReference: (reference) => {
      const coordinate = toDisplayCoordinate(reference.coordinate)
      if (disposed || !coordinate) return false
      view.cancelAnimations()
      view.setCenter(coordinate)
      view.setZoom(JEZERO_DETAIL_ZOOM)
      reportView()
      return true
    },
    panBy: (horizontal, vertical) => { const resolution = view.getResolution() ?? 0; view.adjustCenter([horizontal * resolution * 128, -vertical * resolution * 128]); reportView() },
    zoomBy: (delta) => { view.setZoom(Math.max(0, Math.min(MAX_LEVEL, (view.getZoom() ?? 0) + delta))); reportView() },
    dispose: () => {
      if (disposed) return
      disposed = true
      resizeObserver.disconnect()
      map.un('singleclick', inspectMarker)
      map.un('moveend', reportView)
      map.removeLayer(missionLayer)
      missionSource.clear(true)
      missionSource.dispose()
      missionLayer.dispose()
      for (const run of runs.values()) run.abort.abort()
      for (const layer of layers.values()) layer.getSource()?.dispose()
      if (alphaCanvas) { alphaCanvas.width = 0; alphaCanvas.height = 0; alphaCanvas = undefined }
      map.setTarget(undefined)
      map.dispose()
    },
  }
}
