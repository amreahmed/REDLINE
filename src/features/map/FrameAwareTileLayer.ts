import TileLayer from 'ol/layer/Tile'
import CanvasTileLayerRenderer from 'ol/renderer/canvas/TileLayer'
import type { FrameState } from 'ol/Map'
import type Tile from 'ol/Tile'
import type WMTS from 'ol/source/WMTS'
import { frameMatches, isCurrentImageTile } from './frameReadiness'
import type { ImageSupport, ViewFrame } from './frameReadiness'
import type { Bounds } from './types'

/** Uses the renderer's protected extension API, not a private cache cast. */
export class FrameAwareTileRenderer<Layer extends TileLayer<WMTS>> extends CanvasTileLayerRenderer<Layer> {
  private imageFrame: ViewFrame | null = null
  private imageSource: WMTS | null = null

  override renderFrame(frame: FrameState, target: HTMLElement) {
    const element = super.renderFrame(frame, target)
    this.imageSource = this.getLayer().getSource()
    this.imageFrame = {
      center: [frame.viewState.center[0], frame.viewState.center[1]],
      resolution: frame.viewState.resolution,
      size: [frame.size[0], frame.size[1]],
    }
    return element
  }

  invalidateFrame() { this.imageFrame = null; this.imageSource = null }

  hasCurrentImagery(current: ViewFrame, viewport: Bounds, pixels: WeakMap<Tile, ImageSupport>) {
    const layer = this.getLayer()
    const source = layer.getSource()
    const grid = source?.getTileGrid()
    if (!source || !grid || source !== this.imageSource || !frameMatches(this.imageFrame, current) || !layer.getVisible() || layer.getOpacity() <= 0) return false
    const targetLevel = grid.getZForResolution(current.resolution, source.zDirection)
    const coverage = (layer.getExtent() ?? grid.getExtent()) as Bounds
    return this.renderedTiles.some((tile) => {
      const support = pixels.get(tile)
      return !!support && isCurrentImageTile({ state: tile.getState(), level: tile.tileCoord[0], extent: grid.getTileCoordExtent(tile.tileCoord) as Bounds, ...support }, viewport, coverage, targetLevel)
    })
  }
}

export class FrameAwareTileLayer extends TileLayer<WMTS> {
  override createRenderer(): FrameAwareTileRenderer<this> { return new FrameAwareTileRenderer(this, { cacheSize: this.getCacheSize() }) }

  invalidateFrame() {
    const renderer = this.hasRenderer() ? this.getRenderer() : null
    if (renderer instanceof FrameAwareTileRenderer) renderer.invalidateFrame()
  }

  hasCurrentImagery(current: ViewFrame, viewport: Bounds, pixels: WeakMap<Tile, ImageSupport>) {
    const renderer = this.hasRenderer() ? this.getRenderer() : null
    return renderer instanceof FrameAwareTileRenderer && renderer.hasCurrentImagery(current, viewport, pixels)
  }
}
