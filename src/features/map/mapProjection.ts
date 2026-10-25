import Projection from 'ol/proj/Projection'
import WMTS from 'ol/source/WMTS'
import WMTSTileGrid from 'ol/tilegrid/WMTS'
import type { LoadFunction } from 'ol/Tile'
import { WORLD_EXTENT } from './grid'
import type { LayerDefinition, TileContract } from './types'

export function createDisplayProjection() {
  return new Projection({
    code: 'REDLINE:MARS-TREK-DISPLAY',
    units: 'degrees',
    axisOrientation: 'enu',
    extent: WORLD_EXTENT,
    worldExtent: WORLD_EXTENT,
    global: false,
    // Explicit Mars equatorial conversion prevents OL's Earth degree fallback.
    // It is not used for scales or measurements; see docs/data-sources.md.
    metersPerUnit: 2 * Math.PI * 3_396_190 / 360,
    getPointResolution: (resolution) => resolution,
  })
}

export function createTileSource(definition: LayerDefinition, contract: TileContract, projection: Projection, load: LoadFunction) {
  return new WMTS({
    projection,
    url: contract.template,
    layer: definition.productId,
    matrixSet: contract.matrixSet,
    format: contract.format,
    style: contract.style,
    requestEncoding: 'REST',
    crossOrigin: 'anonymous',
    wrapX: false,
    transition: 0,
    attributions: definition.attribution,
    tileLoadFunction: load,
    tileGrid: new WMTSTileGrid({
      extent: contract.extent,
      origin: contract.origin,
      resolutions: contract.resolutions,
      matrixIds: contract.matrixIds,
      sizes: contract.sizes,
      tileSize: contract.tileSize,
    }),
  })
}
