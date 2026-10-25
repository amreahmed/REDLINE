import ImageTile from 'ol/ImageTile'
import OlMap from 'ol/Map'
import TileState from 'ol/TileState'
import View from 'ol/View'
import { defaults as defaultInteractions } from 'ol/interaction/defaults'
import TileLayer from 'ol/layer/Tile'
import type Tile from 'ol/Tile'
import type WMTS from 'ol/source/WMTS'
import { JEZERO_EXTENT, MARS_LAYERS } from '../../data/marsLayers'
import { readCapabilities } from './capabilities'
import { coverageForView, MAX_LEVEL, WORLD_EXTENT } from './grid'
import { createDisplayProjection, createTileSource } from './mapProjection'
import { requestTile, requestXml, ResourceError } from './requests'
import { initialLayerStatus } from './types'
import type { Bounds, LayerDefinition, LayerId, LayerStatus, LayerVisibility, ViewStatus } from './types'

type LayerRun = { abort: AbortController; status: LayerStatus }
export type MarsMapController = {
  setVisibility: (visibility: LayerVisibility) => void
  retry: (id: LayerId) => void
  reset: () => void
  refresh: () => void
  setActive: (active: boolean) => void
  enterContext: (atJezero: boolean, minimumZoom: number) => void
  focusJezero: () => void
  panBy: (horizontal: number, vertical: number) => void
  zoomBy: (delta: number) => void
  dispose: () => void
}

/** Owns the renderer lifecycle; no terrain or physical measurement APIs. */
export function createMarsMap(target: HTMLElement, onStatus: (id: LayerId, status: LayerStatus) => void, onView: (status: ViewStatus) => void, options: { keyboard?: boolean } = {}): MarsMapController {
  const projection = createDisplayProjection()
  const view = new View({ projection, resolutions: Array.from({ length: MAX_LEVEL + 1 }, (_, z) => 0.703125 / 2 ** z), extent: WORLD_EXTENT, constrainOnlyCenter: true, enableRotation: false })
  const layers = new Map<LayerId, TileLayer<WMTS>>()
  const runs = new Map<LayerId, LayerRun>()
  let disposed = false
  for (const definition of MARS_LAYERS) layers.set(definition.id, new TileLayer<WMTS>({ extent: definition.extent, cacheSize: 128 }))
  const map = new OlMap({
    target,
    view,
    layers: [...layers.values()],
    controls: [],
    interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false, keyboard: options.keyboard }),
    maxTilesLoading: 8,
  })

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
    runs.get(definition.id)?.abort.abort()
    const oldSource = layer.getSource()
    layer.setSource(null)
    oldSource?.dispose()
    const run: LayerRun = { abort: new AbortController(), status: initialLayerStatus() }
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
  const jezeroCenter = () => [(JEZERO_EXTENT[0] + JEZERO_EXTENT[2]) / 2, (JEZERO_EXTENT[1] + JEZERO_EXTENT[3]) / 2]
  const resizeObserver = new ResizeObserver(refresh)
  resizeObserver.observe(target)
  reset()
  for (const definition of MARS_LAYERS) void connect(definition)

  return {
    setVisibility: (visibility) => { for (const [id, layer] of layers) layer.setVisible(visibility[id]) },
    retry: (id) => { const definition = MARS_LAYERS.find((layer) => layer.id === id); if (definition && !disposed) void connect(definition) },
    reset,
    refresh,
    setActive: (active) => { view.cancelAnimations(); map.getInteractions().forEach((interaction) => interaction.setActive(active)); if (active) refresh() },
    enterContext: (atJezero, minimumZoom) => { refresh(); if (atJezero) view.setCenter(jezeroCenter()); view.setZoom(atJezero ? minimumZoom : Math.max(minimumZoom, view.getZoom() ?? minimumZoom)); reportView() },
    focusJezero: () => { view.setCenter(jezeroCenter()); view.setZoom(8); reportView() },
    panBy: (horizontal, vertical) => { const resolution = view.getResolution() ?? 0; view.adjustCenter([horizontal * resolution * 128, -vertical * resolution * 128]); reportView() },
    zoomBy: (delta) => { view.setZoom(Math.max(0, Math.min(MAX_LEVEL, (view.getZoom() ?? 0) + delta))); reportView() },
    dispose: () => {
      disposed = true
      resizeObserver.disconnect()
      for (const run of runs.values()) run.abort.abort()
      for (const layer of layers.values()) layer.getSource()?.dispose()
      map.setTarget(undefined)
      map.dispose()
    },
  }
}
