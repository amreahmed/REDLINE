import { DOMParser } from '@xmldom/xmldom'
import Tile from 'ol/Tile'
import TileState from 'ol/TileState'
import CanvasTileLayerRenderer from 'ol/renderer/canvas/TileLayer'
import type { FrameState } from 'ol/Map'
import { afterEach, expect, it, vi } from 'vitest'
import { FrameAwareTileLayer, FrameAwareTileRenderer } from './FrameAwareTileLayer'
import { MARS_LAYERS } from '../../data/marsLayers'
import { readCapabilities } from './capabilities'
import { createDisplayProjection, createTileSource } from './mapProjection'
import type { ImageSupport, ViewFrame } from './frameReadiness'
import { createAlphaSupport } from './frameReadiness'
import type { Bounds } from './types'
import ctxXml from '../../../docs/evidence/phase-2/Jezero_CTX_BlockAdj_dd.WMTSCapabilities.xml?raw'

class RecordedFrameRenderer extends FrameAwareTileRenderer<FrameAwareTileLayer> {
  recordTiles(tiles: Tile[]) { this.renderedTiles = tiles }
}

afterEach(() => vi.restoreAllMocks())

it('invalidates readiness on source replacement, hidden layers, zero opacity and reset', () => {
  const definition = MARS_LAYERS[1]
  const projection = createDisplayProjection()
  const contract = readCapabilities(ctxXml, definition, (xml) => new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document)
  const source = createTileSource(definition, contract, projection, () => {})
  const replacement = createTileSource(definition, contract, projection, () => {})
  const layer = new FrameAwareTileLayer({ source, extent: definition.extent })
  const renderer = new RecordedFrameRenderer(layer)
  const tile = new Tile([10, 1465, 407], TileState.LOADED)
  const pixels = new WeakMap<Tile, ImageSupport>([[tile, { hasPixels: true }]])
  const current: ViewFrame = { center: [77.69, 18.41], resolution: 0.703125 / 2 ** 10, size: [960, 600] }
  const extent: Bounds = [77.6, 18.35, 77.75, 18.5]
  // Canvas/GPU drawing is intentionally mocked; this tests the adapter's lifecycle gate.
  const target = {} as HTMLElement
  const frame = { viewState: { center: current.center, resolution: current.resolution }, size: current.size } as unknown as FrameState
  vi.spyOn(CanvasTileLayerRenderer.prototype, 'renderFrame').mockReturnValue(target)
  try {
    renderer.recordTiles([tile])
    expect(renderer.hasCurrentImagery(current, extent, pixels)).toBe(false)
    renderer.renderFrame(frame, target)
    expect(renderer.hasCurrentImagery(current, extent, pixels)).toBe(true)
    // An opaque pixel elsewhere in a loaded tile must not make its transparent crop ready.
    const rgba = new Uint8ClampedArray(4 * 4 * 4)
    rgba[3] = 255
    pixels.set(tile, createAlphaSupport(rgba, 4, 4))
    const tileExtent = source.getTileGrid()!.getTileCoordExtent(tile.tileCoord)
    const middleX = (tileExtent[0] + tileExtent[2]) / 2
    const middleY = (tileExtent[1] + tileExtent[3]) / 2
    expect(renderer.hasCurrentImagery(current, [middleX, tileExtent[1], tileExtent[2], middleY], pixels)).toBe(false)
    expect(renderer.hasCurrentImagery(current, [tileExtent[0], middleY, middleX, tileExtent[3]], pixels)).toBe(true)
    pixels.set(tile, { hasPixels: true })
    layer.setVisible(false)
    expect(renderer.hasCurrentImagery(current, extent, pixels)).toBe(false)
    layer.setVisible(true)
    layer.setOpacity(0)
    expect(renderer.hasCurrentImagery(current, extent, pixels)).toBe(false)
    layer.setOpacity(1)
    layer.setSource(replacement)
    expect(renderer.hasCurrentImagery(current, extent, pixels)).toBe(false)
    layer.setSource(source)
    renderer.invalidateFrame()
    expect(renderer.hasCurrentImagery(current, extent, pixels)).toBe(false)
  } finally {
    renderer.dispose()
    layer.dispose()
    source.dispose()
    replacement.dispose()
    tile.dispose()
  }
})
