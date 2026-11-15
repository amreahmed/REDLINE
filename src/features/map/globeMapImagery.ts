import ImageTile from 'ol/ImageTile'
import TileState from 'ol/TileState'
import TileLayer from 'ol/layer/Tile'
import WMTS from 'ol/source/WMTS'
import WMTSTileGrid from 'ol/tilegrid/WMTS'
import type OlMap from 'ol/Map'
import type Projection from 'ol/proj/Projection'
import type Tile from 'ol/Tile'
import type { GlobeImageryLayer } from '../../data/globeLayers'
import { ResourceError, requestTile } from './requests'
import { globeAngularViewRadius, wrapGlobeLongitude } from '../globe/geographicMath'
import { createAlphaSupport } from './frameReadiness'

export type GlobeMapImageryStatus = { phase: 'loading' | 'ready' | 'error' | 'outside'; loaded: number; pending: number; failed: number; missing: number }

/** Display-only camera bridge. It does not alter terrain/source coordinates. */
export function geographicMapContext(coordinate: readonly [number, number], distance: number, size: readonly [number, number]) {
  if (!Number.isFinite(coordinate[1]) || coordinate[1] < -90 || coordinate[1] > 90 || size.some(value => !Number.isFinite(value) || value <= 0)) throw new RangeError('Invalid geographic map context.')
  const radius = globeAngularViewRadius(distance, 40, size[0] / size[1])
  const resolution = Math.max(1e-9, 2 * radius / Math.min(...size))
  return { center: [wrapGlobeLongitude(coordinate[0]), coordinate[1]] as [number, number], zoom: Math.max(0, Math.min(13, Math.log2(0.703125 / resolution))) }
}

/** An explicitly selected extra imagery layer; existing regional layers remain untouched. */
export function createGlobeMapImagery(map: OlMap, projection: Projection, changed: (status: GlobeMapImageryStatus) => void) {
  const overlay = new TileLayer({ zIndex: 0.5, visible: false, cacheSize: 64 })
  map.addLayer(overlay)
  let selected: GlobeImageryLayer | null = null
  let abort = new AbortController()
  let disposed = false
  let alphaCanvas: HTMLCanvasElement | undefined
  let status: GlobeMapImageryStatus = { phase: 'loading', loaded: 0, pending: 0, failed: 0, missing: 0 }
  const emit = () => {
    if (disposed || !selected) return
    const center = map.getView().getCenter()
    const bounds = selected.coverage
    const outside = !center || center[0] < bounds[0] || center[0] > bounds[2] || center[1] < bounds[1] || center[1] > bounds[3]
    changed({ ...status, phase: outside ? 'outside' : status.pending ? 'loading' : status.loaded ? 'ready' : status.failed || status.missing ? 'error' : 'loading' })
  }
  map.on('moveend', emit)
  async function load(tile: Tile, url: string, layer: GlobeImageryLayer, signal: AbortSignal, current: GlobeMapImageryStatus) {
    if (!(tile instanceof ImageTile)) { tile.setState(TileState.ERROR); return }
    current.pending++
    emit()
    let objectUrl: string | undefined
    try {
      const blob = await requestTile(url, layer.tileSource.format, signal)
      signal.throwIfAborted()
      objectUrl = URL.createObjectURL(blob)
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      signal.throwIfAborted()
      if (image.naturalWidth !== layer.tileSource.tileSize || image.naturalHeight !== layer.tileSource.tileSize) throw new ResourceError('content', 'Selected imagery tile dimensions changed.')
      let emptyImage = false
      if (layer.tileSource.format === 'image/png') {
        try {
          alphaCanvas ??= document.createElement('canvas')
          const size = layer.tileSource.tileSize
          alphaCanvas.width = size; alphaCanvas.height = size
          const context = alphaCanvas.getContext('2d', { willReadFrequently: true })
          if (context) { context.drawImage(image, 0, 0); emptyImage = !createAlphaSupport(context.getImageData(0, 0, size, size).data, size, size).hasPixels }
        } catch { /* Unavailable readback cannot be inferred to be missing imagery. */ }
      }
      if (emptyImage) throw new ResourceError('missing', 'The selected source tile has no visible imagery pixels.')
      tile.setImage(image)
      current.loaded++
    } catch (error) {
      if (signal.aborted) tile.setState(TileState.EMPTY)
      else if (error instanceof ResourceError && error.kind === 'missing') { current.missing++; tile.setState(TileState.EMPTY) }
      else { current.failed++; tile.setState(TileState.ERROR) }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      current.pending--
      if (status === current) emit()
    }
  }
  function setLayer(layer: GlobeImageryLayer | null) {
    if (disposed) return
    abort.abort()
    abort = new AbortController()
    selected = layer
    const old = overlay.getSource()
    overlay.setSource(null)
    old?.dispose()
    overlay.setVisible(!!layer)
    if (!layer) return
    status = { phase: 'loading', loaded: 0, pending: 0, failed: 0, missing: 0 }
    const run = status, signal = abort.signal, contract = layer.tileSource
    overlay.setExtent([...layer.coverage])
    overlay.setSource(new WMTS({ projection, url: contract.template, layer: layer.id, matrixSet: contract.matrixSet, format: contract.format, style: contract.style, requestEncoding: 'REST', crossOrigin: 'anonymous', wrapX: false, transition: 160, attributions: layer.attribution, tileLoadFunction: (tile, url) => { void load(tile, url, layer, signal, run) }, tileGrid: new WMTSTileGrid({ extent: contract.extent, origin: contract.origin, resolutions: contract.resolutions, matrixIds: contract.matrixIds, sizes: contract.sizes, tileSize: contract.tileSize }) }))
    emit()
  }
  return { setLayer, retry: () => { if (selected) setLayer(selected) }, dispose: () => { if (disposed) return; disposed = true; abort.abort(); map.un('moveend', emit); const source = overlay.getSource(); overlay.setSource(null); source?.dispose(); map.removeLayer(overlay); overlay.dispose() } }
}
