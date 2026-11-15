import ImageTile from 'ol/ImageTile'
import OlMap from 'ol/Map'
import type MapBrowserEvent from 'ol/MapBrowserEvent'
import TileState from 'ol/TileState'
import View from 'ol/View'
import { defaults as defaultInteractions } from 'ol/interaction/defaults'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import ImageLayer from 'ol/layer/Image'
import ImageStatic from 'ol/source/ImageStatic'
import type Feature from 'ol/Feature'
import type Point from 'ol/geom/Point'
import type Geometry from 'ol/geom/Geometry'
import type Tile from 'ol/Tile'
import { JEZERO_EXTENT, MARS_LAYERS } from '../../data/marsLayers'
import { JEZERO_CONTEXT_ZOOM, JEZERO_DETAIL_ZOOM, JEZERO_OVERVIEW_ZOOM } from '../../data/jezero'
import { readCapabilities } from './capabilities'
import { coverageForView, MAX_LEVEL, WORLD_EXTENT } from './grid'
import { createDisplayProjection, createTileSource } from './mapProjection'
import { requestTile, requestXml, ResourceError } from './requests'
import { DETAIL_LAYER_IDS, initialLayerStatus } from './types'
import { clampApproachZoom, clampDetailOpacity, jezeroCenter } from './jezeroView'
import { FrameAwareTileLayer } from './FrameAwareTileLayer'
import { createAlphaSupport } from './frameReadiness'
import type { ImageSupport } from './frameReadiness'
import type { Bounds, GridOverlayEndpoint, LayerDefinition, LayerId, LayerStatus, LayerVisibility, ViewStatus } from './types'
import { toDisplayCoordinate } from '../mission/coordinates'
import type { MissionSelection, ScienceTarget, TargetId } from '../mission/types'
import { createMissionFeatures, missionFeatureStyle, missionTargetId } from './featureMarkers'
import { createGridOverlayFeatures, emitMapCoordinatePick, gridOverlayStyle, gridOverlayVisible, validGridBounds } from './gridOverlay'
import { createHypotheticalRouteFeatures, hypotheticalRouteStyle } from './routeOverlay'
import type { HypotheticalRoute, RoutePoint } from '../routing/types'
import type { GlobeImageryLayer } from '../../data/globeLayers'
import { createGlobeMapImagery, geographicMapContext } from './globeMapImagery'
import type { GlobeMapImageryStatus } from './globeMapImagery'
import { terrainModelExtent, terrainModelRouteFeatures, terrainModelRouteStyle, terrainOverlayPixels } from './terrainModelOverlay'
import type { TerrainMapDisplay } from './terrainModelOverlay'

type LayerRun = { abort: AbortController; status: LayerStatus; imageSupport: WeakMap<Tile, ImageSupport> }
export type MarsMapController = {
  setVisibility: (visibility: LayerVisibility) => void
  retry: (id: LayerId) => void
  reset: () => void
  refresh: () => void
  setActive: (active: boolean) => void
  enterContext: (atJezero: boolean, minimumZoom: number) => void
  enterGeographicContext: (coordinate: readonly [number, number], distance: number) => void
  setGlobeImagery: (layer: GlobeImageryLayer | null) => void
  retryGlobeImagery: () => void
  focusJezero: (targetZoom?: number) => void
  prepareJezeroApproach: () => void
  setApproachZoom: (zoom: number) => void
  setDetailOpacity: (opacity: number) => void
  hasRenderedImagery: (id?: LayerId) => boolean
  setMissionFeatures: (targets: readonly ScienceTarget[], selection: MissionSelection, selectedId: TargetId | null) => void
  focusReference: (target: ScienceTarget) => boolean
  setGridOverlay: (bounds: Bounds | null, endpoints: readonly GridOverlayEndpoint[]) => void
  setHypotheticalRoutes: (routes: readonly HypotheticalRoute[], selectedId: 'shortest' | 'via' | null, waypoint: RoutePoint | null) => void
  setTerrainModel: (display: TerrainMapDisplay | null) => void
  focusGrid: (bounds: Bounds) => void
  pickViewCenter: () => void
  panBy: (horizontal: number, vertical: number) => void
  zoomBy: (delta: number) => void
  dispose: () => void
}

/** Owns the renderer lifecycle; no terrain or physical measurement APIs. */
export function createMarsMap(target: HTMLElement, onStatus: (id: LayerId, status: LayerStatus) => void, onView: (status: ViewStatus) => void, options: { keyboard?: boolean; onInspectTarget?: (id: TargetId) => void; onPickCoordinate?: (coordinate: [number, number]) => void; onControlledImageryReady?: (ready: boolean) => void; onGlobeImageryStatus?: (status: GlobeMapImageryStatus) => void } = {}): MarsMapController {
  const projection = createDisplayProjection()
  // Extra HiRISE display levels are enabled only while that explicit source is
  // selected. The original mission/terrain workspace keeps its existing limit.
  const view = new View({ projection, resolutions: Array.from({ length: 18 }, (_, z) => 0.703125 / 2 ** z), maxZoom: MAX_LEVEL, extent: WORLD_EXTENT, constrainOnlyCenter: true, enableRotation: false })
  let displayZoomLimit = MAX_LEVEL
  const layers = new Map<LayerId, FrameAwareTileLayer>()
  const runs = new Map<LayerId, LayerRun>()
  const missionSource = new VectorSource<Feature<Point>>({ wrapX: false })
  const missionLayer = new VectorLayer({ source: missionSource, style: missionFeatureStyle, zIndex: 20, minZoom: 6, declutter: true })
  const gridSource = new VectorSource<Feature<Geometry>>({ wrapX: false })
  const gridLayer = new VectorLayer({ source: gridSource, style: gridOverlayStyle, zIndex: 30 })
  const routeSource = new VectorSource<Feature<Geometry>>({ wrapX: false })
  const routeLayer = new VectorLayer({ source: routeSource, style: hypotheticalRouteStyle, zIndex: 25 })
  const terrainRaster = new ImageLayer<ImageStatic>({ zIndex: 21, visible: false })
  const terrainRouteSource = new VectorSource<Feature<Geometry>>({ wrapX: false })
  const terrainRouteLayer = new VectorLayer({ source: terrainRouteSource, style: terrainModelRouteStyle, zIndex: 28, visible: false })
  let terrainDisplay: TerrainMapDisplay | null = null
  let disposed = false
  let active = true
  let hasGridBounds = false
  let gridBounds: Bounds | null = null
  let routeInputs: { routes: readonly HypotheticalRoute[]; selectedId: 'shortest' | 'via' | null; waypoint: RoutePoint | null } = { routes: [], selectedId: null, waypoint: null }
  let controlledImageryReady: boolean | undefined
  let alphaCanvas: HTMLCanvasElement | undefined
  for (const [index, definition] of MARS_LAYERS.entries()) layers.set(definition.id, new FrameAwareTileLayer({ extent: definition.extent, cacheSize: 128, zIndex: index }))
  const map = new OlMap({
    target,
    view,
    layers: [...layers.values(), missionLayer, gridLayer, routeLayer, terrainRaster, terrainRouteLayer],
    controls: [],
    interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false, keyboard: options.keyboard }),
    maxTilesLoading: 8,
  })
  let globeImagery: ReturnType<typeof createGlobeMapImagery> | undefined
  const inspectMarker = (event: MapBrowserEvent) => {
    if (disposed || !active) return
    const id = map.forEachFeatureAtPixel(event.pixel, (feature) => missionTargetId(feature), { layerFilter: (layer) => layer === missionLayer, hitTolerance: 10 })
    if (id) options.onInspectTarget?.(id)
    emitMapCoordinatePick(event.coordinate, active, !!id, options.onPickCoordinate)
  }
  map.on('singleclick', inspectMarker)
  function syncGridVisibility() {
    const visible = gridOverlayVisible(active && !disposed, layers.get('controlledCtx')?.getVisible() === true, hasGridBounds)
    gridLayer.setVisible(visible)
    routeLayer.setVisible(visible && !terrainDisplay?.comparison && routeSource.getFeatures().length > 0)
    terrainRaster.setVisible(visible && !!terrainDisplay && terrainDisplay.overlay !== 'none')
    terrainRouteLayer.setVisible(visible && terrainRouteSource.getFeatures().length > 0)
  }
  function updateRoutes() {
    routeSource.clear(true)
    routeSource.addFeatures(createHypotheticalRouteFeatures(gridBounds, routeInputs.routes, routeInputs.selectedId, routeInputs.waypoint))
    syncGridVisibility()
  }
  syncGridVisibility()
  function reportControlledImageryReady() {
    if (!options.onControlledImageryReady) return
    // Flights may render inactive panes; only the active map can support picking.
    const ready = active && !disposed && hasRenderedImagery('controlledCtx')
    if (ready === controlledImageryReady) return
    controlledImageryReady = ready
    options.onControlledImageryReady(ready)
  }
  map.on('postrender', reportControlledImageryReady)

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
    reportControlledImageryReady()
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
    reportControlledImageryReady()
    onView({ center: [center[0], center[1]], zoom, canZoomIn: zoom < displayZoomLimit - 0.001, canZoomOut: zoom > 0.001 })
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
    setVisibility: (visibility) => {
      if (disposed) return
      for (const [id, layer] of layers) { if (layer.getVisible() !== visibility[id]) layer.invalidateFrame(); layer.setVisible(visibility[id]) }
      syncGridVisibility()
      reportControlledImageryReady()
    },
    retry: (id) => { const definition = MARS_LAYERS.find((layer) => layer.id === id); if (definition && !disposed) void connect(definition) },
    reset,
    refresh,
    setActive: (value) => { if (disposed) return; active = value; missionLayer.setVisible(value); syncGridVisibility(); view.cancelAnimations(); map.getInteractions().forEach((interaction) => interaction.setActive(value)); reportControlledImageryReady(); if (value) refresh() },
    enterContext: (atJezero, minimumZoom) => { refresh(); if (atJezero) view.setCenter(jezeroCenter()); view.setZoom(atJezero ? minimumZoom : Math.max(minimumZoom, view.getZoom() ?? minimumZoom)); reportView() },
    enterGeographicContext: (coordinate, distance) => { if (disposed) return; const context = geographicMapContext(coordinate, distance, map.getSize() as [number, number] ?? [800, 600]); view.cancelAnimations(); refresh(); view.setCenter(context.center); view.setZoom(context.zoom); reportView() },
    setGlobeImagery: (layer) => {
      if (disposed) return
      displayZoomLimit = layer ? Math.max(MAX_LEVEL, layer.maxZoom) : MAX_LEVEL
      view.setMaxZoom(displayZoomLimit)
      if ((view.getZoom() ?? 0) > displayZoomLimit) view.setZoom(displayZoomLimit)
      if (!globeImagery && layer) globeImagery = createGlobeMapImagery(map, projection, status => options.onGlobeImageryStatus?.(status))
      globeImagery?.setLayer(layer)
      reportView()
    },
    retryGlobeImagery: () => globeImagery?.retry(),
    focusJezero: (targetZoom = JEZERO_OVERVIEW_ZOOM) => { if (!disposed) { view.cancelAnimations(); view.setCenter(jezeroCenter()); view.setZoom(targetZoom); reportView() } },
    prepareJezeroApproach: () => { if (!disposed) { view.cancelAnimations(); for (const layer of layers.values()) layer.invalidateFrame(); refresh(); setApproachZoom(JEZERO_CONTEXT_ZOOM) } },
    setApproachZoom,
    setDetailOpacity: (opacity) => { if (!disposed) { for (const id of DETAIL_LAYER_IDS) layers.get(id)?.setOpacity(clampDetailOpacity(opacity)); reportControlledImageryReady() } },
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
    setGridOverlay: (bounds, endpoints) => {
      if (disposed) return
      gridSource.clear(true)
      const features = createGridOverlayFeatures(bounds, endpoints)
      hasGridBounds = features.length > 0
      gridBounds = hasGridBounds && bounds ? [...bounds] as Bounds : null
      gridSource.addFeatures(features)
      updateRoutes()
    },
    setHypotheticalRoutes: (routes, selectedId, waypoint) => {
      if (disposed) return
      routeInputs = { routes, selectedId, waypoint }
      updateRoutes()
    },
    setTerrainModel: (display) => {
      if (disposed) return
      terrainDisplay = display
      terrainRouteSource.clear(true)
      const oldSource = terrainRaster.getSource()
      terrainRaster.setSource(null)
      oldSource?.dispose()
      if (display) {
        terrainRouteSource.addFeatures(terrainModelRouteFeatures(display))
        if (display.overlay !== 'none') {
          const canvas = document.createElement('canvas')
          canvas.width = display.analysis.grid.columns
          canvas.height = display.analysis.grid.rows
          const context = canvas.getContext('2d')
          if (context) {
            const pixels = context.createImageData(canvas.width, canvas.height)
            pixels.data.set(terrainOverlayPixels(display))
            context.putImageData(pixels, 0, 0)
            terrainRaster.setSource(new ImageStatic({ url: canvas.toDataURL('image/png'), imageExtent: terrainModelExtent(display.analysis), projection, interpolate: false, attributions: display.analysis.grid.source.attribution }))
          }
          canvas.width = 0; canvas.height = 0
        }
      }
      syncGridVisibility()
    },
    focusGrid: (bounds) => {
      if (disposed || !validGridBounds(bounds)) return
      view.cancelAnimations()
      map.updateSize()
      view.fit(bounds, { size: map.getSize(), padding: [32, 32, 32, 32], maxZoom: 12, duration: 0 })
      reportView()
    },
    pickViewCenter: () => {
      const center = view.getCenter()
      if (center) emitMapCoordinatePick(center, active && !disposed, false, options.onPickCoordinate)
    },
    panBy: (horizontal, vertical) => { const resolution = view.getResolution() ?? 0; view.adjustCenter([horizontal * resolution * 128, -vertical * resolution * 128]); reportView() },
    zoomBy: (delta) => { view.setZoom(Math.max(0, Math.min(displayZoomLimit, (view.getZoom() ?? 0) + delta))); reportView() },
    dispose: () => {
      if (disposed) return
      disposed = true
      globeImagery?.dispose()
      reportControlledImageryReady()
      resizeObserver.disconnect()
      map.un('singleclick', inspectMarker)
      map.un('moveend', reportView)
      map.un('postrender', reportControlledImageryReady)
      map.removeLayer(missionLayer)
      missionSource.clear(true)
      missionSource.dispose()
      missionLayer.dispose()
      map.removeLayer(gridLayer)
      gridSource.clear(true)
      gridSource.dispose()
      gridLayer.dispose()
      map.removeLayer(routeLayer)
      routeSource.clear(true)
      routeSource.dispose()
      routeLayer.dispose()
      map.removeLayer(terrainRaster)
      terrainRaster.getSource()?.dispose()
      terrainRaster.dispose()
      map.removeLayer(terrainRouteLayer)
      terrainRouteSource.clear(true)
      terrainRouteSource.dispose()
      terrainRouteLayer.dispose()
      terrainDisplay = null
      routeInputs = { routes: [], selectedId: null, waypoint: null }
      gridBounds = null
      for (const run of runs.values()) run.abort.abort()
      for (const layer of layers.values()) layer.getSource()?.dispose()
      if (alphaCanvas) { alphaCanvas.width = 0; alphaCanvas.height = 0; alphaCanvas = undefined }
      map.setTarget(undefined)
      map.dispose()
    },
  }
}
