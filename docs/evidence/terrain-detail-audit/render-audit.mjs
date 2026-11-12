// Read-only application/grid audit. This does not open a browser or request tiles.
// Run from the repository root: node docs/evidence/terrain-detail-audit/render-audit.mjs
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'
import { createServer } from 'vite'
import View from 'ol/View.js'
import TileLayer from 'ol/layer/Tile.js'
import { containsCoordinate } from 'ol/extent.js'

const evidenceDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(evidenceDir, '../../..')
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
const sources = []

try {
  const [{ MARS_LAYERS, JEZERO_EXTENT }, { readCapabilities }, { createDisplayProjection, createTileSource }, gridModule, layerModule, transitionModule] = await Promise.all([
    server.ssrLoadModule('/src/data/marsLayers.ts'),
    server.ssrLoadModule('/src/features/map/capabilities.ts'),
    server.ssrLoadModule('/src/features/map/mapProjection.ts'),
    server.ssrLoadModule('/src/features/map/grid.ts'),
    server.ssrLoadModule('/src/features/explorer/layers.ts'),
    server.ssrLoadModule('/src/features/explorer/transition.ts'),
  ])
  const projection = createDisplayProjection()
  const resolutions = Array.from({ length: gridModule.MAX_LEVEL + 1 }, (_, z) => 0.703125 / 2 ** z)
  const view = new View({ projection, resolutions, extent: gridModule.WORLD_EXTENT, constrainOnlyCenter: true, enableRotation: false })
  const shortcutCenter = [(JEZERO_EXTENT[0] + JEZERO_EXTENT[2]) / 2, (JEZERO_EXTENT[1] + JEZERO_EXTENT[3]) / 2]
  const reference = {
    label: 'USGS Gazetteer Jezero crater center (navigation reference, not a pixel registration assertion)',
    longitudeLatitude: [77.69, 18.41],
    convention: 'Planetocentric latitude, positive-east longitude 0–360; this positive longitude is unchanged in a -180–180 domain.',
    url: 'https://planetarynames.wr.usgs.gov/Feature/14300',
    qualification: 'Native preliminary CTX latitude convention and precise image registration remain unverified. This is an angular comparison only.',
  }
  view.setCenter(shortcutCenter)
  const output = {
    auditedAtUtc: new Date().toISOString(),
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    runtime: process.version,
    method: 'Actual application parser/projection/source functions loaded in Vite SSR; installed OpenLayers View, tile-grid selection and source URL APIs executed in Node. No browser, canvas, tile fetch, or actual viewport measurement.',
    rendererRule: 'ol/renderer/canvas/TileLayer.js selects getZForResolution(viewResolution, source.zDirection), then scales by (tileResolution / viewResolution) * devicePixelRatio / sourceTilePixelRatio.',
    projection: { code: projection.getCode(), units: projection.getUnits(), axisOrientation: projection.getAxisOrientation(), extent: projection.getExtent(), metersPerUnit: projection.getMetersPerUnit() },
    viewResolutionsDegreesPerCssPixel: resolutions,
    currentShortcut: { center: shortcutCenter, mapDetailZoom: 8, initialContextZoom: transitionModule.MAP_ENTRY_ZOOM, extentUsedForMidpoint: JEZERO_EXTENT },
    geographicReference: reference,
    layers: [],
    visibilityCases: [],
    simulatedViewports: [],
    sourceHashes: {},
    limitations: [
      'Generated tile URLs are configuration evidence, not browser network capture.',
      'Simulated viewport dimensions are explicitly illustrative; actual browser viewport, zoom, DPR, cached/interim tiles, and GPU rendering were not observed.',
      'Angular sample spacing does not prove effective native source resolution or pixel registration.',
      'A rectangular service bound does not establish valid pixels throughout its interior.',
      'No numerical elevation, terrain metric, or route is derived.',
    ],
  }
  for (const definition of MARS_LAYERS) {
    const xmlPath = resolve(evidenceDir, `ctx-${definition.productId}.WMTSCapabilities.xml`)
    const xml = await readFile(xmlPath, 'utf8')
    const contract = readCapabilities(xml, definition, (text) => new DOMParser().parseFromString(text, 'text/xml'))
    const source = createTileSource(definition, contract, projection, () => { throw new Error('This audit must not create or fetch image tiles') })
    sources.push(source)
    const layer = new TileLayer({ source, extent: definition.extent, cacheSize: 128 })
    const tileGrid = source.getTileGrid()
    const layerResult = {
      id: definition.id,
      productId: definition.productId,
      renderOrderBottomToTop: output.layers.length,
      opacity: layer.getOpacity(),
      zIndex: layer.getZIndex() ?? null,
      extentClip: layer.getExtent(),
      interpolate: source.getInterpolate(),
      zDirection: source.zDirection,
      matrixSet: source.getMatrixSet(),
      tileGridMinZoom: tileGrid.getMinZoom(),
      tileGridMaxZoom: tileGrid.getMaxZoom(),
      tileSize: tileGrid.getTileSize(0),
      sourceTilePixelRatioAtDeviceRatio1: source.getTilePixelRatio(1),
      sourceTilePixelRatioAtDeviceRatio2: source.getTilePixelRatio(2),
      wrapX: source.getWrapX(),
      capabilitiesEvidencePath: `docs/evidence/terrain-detail-audit/ctx-${definition.productId}.WMTSCapabilities.xml`,
      capabilitiesSha256: sha256(xml),
      selectedLevels: [],
    }
    for (const zoom of [4, 6.25, 6.75, 7, 7.5, 8, 9, 10, 11, 12]) {
      view.setZoom(zoom)
      const viewResolution = view.getResolution()
      const tileZ = tileGrid.getZForResolution(viewResolution, source.zDirection)
      const tileResolution = tileGrid.getResolution(tileZ)
      const tileCoordinate = tileGrid.getTileCoordForCoordAndZ(shortcutCenter, tileZ)
      const referenceTileCoordinate = tileGrid.getTileCoordForCoordAndZ(reference.longitudeLatitude, tileZ)
      const url = source.getTileUrlFunction()(tileCoordinate, 1, projection)
      const urlAtDpr2 = source.getTileUrlFunction()(tileCoordinate, 2, projection)
      assert.equal(urlAtDpr2, url, 'WMTS must not invent a high-DPI tile variant')
      assert.equal(layer.getOpacity(), 1)
      if (Number.isInteger(zoom)) assert.equal(tileZ, Math.min(zoom, definition.maxLevel))
      layerResult.selectedLevels.push({
        viewZoom: zoom,
        viewResolutionDegreesPerCssPixel: viewResolution,
        requestedMatrixIdentifier: tileGrid.getMatrixId(tileZ),
        sourceResolutionDegreesPerTilePixel: tileResolution,
        sourcePixelScaleInCssPixels: tileResolution / viewResolution,
        sourcePixelScaleInDevicePixelsAtDpr2: 2 * tileResolution / viewResolution,
        shortcutTileCoordinateZColumnRow: tileCoordinate,
        shortcutTileExtent: tileGrid.getTileCoordExtent(tileCoordinate),
        generatedUrlAtShortcut: url,
        referenceTileCoordinateZColumnRow: referenceTileCoordinate,
        generatedUrlAtReference: source.getTileUrlFunction()(referenceTileCoordinate, 1, projection),
      })
    }
    output.layers.push(layerResult)
  }
  for (const [zoom, coverage] of [[4, 'inside'], [7, 'inside'], [8, 'inside'], [12, 'inside'], [12, 'partial'], [12, 'outside']]) {
    const state = transitionModule.transitionExplorer({ ...transitionModule.initialExplorerState, phase: 'map' }, { type: 'map-zoom', value: zoom, overviewAvailable: true })
    output.visibilityCases.push({ zoom, coverage, localDetail: state.localDetail, effective: layerModule.explorerLayerVisibility({ mola: true, ctx: true }, true, state.localDetail, coverage) })
  }
  for (const size of [[960, 600], [390, 430]]) {
    view.setViewportSize(size)
    for (const zoom of [4, 8, 10, 12]) {
      view.setCenter(shortcutCenter)
      view.setZoom(zoom)
      const extent = view.calculateExtent(size)
      const resolution = view.getResolution()
      output.simulatedViewports.push({
        description: 'Illustrative dimensions only; not an observed app viewport.',
        cssPixelSize: size,
        zoom,
        center: view.getCenter(),
        extent,
        preliminaryCtxBoundingBoxCoverage: gridModule.coverageForView(extent, JEZERO_EXTENT),
        referenceCraterCenterInViewport: containsCoordinate(extent, reference.longitudeLatitude),
        referenceCraterCenterCssPixel: [size[0] / 2 + (reference.longitudeLatitude[0] - shortcutCenter[0]) / resolution, size[1] / 2 - (reference.longitudeLatitude[1] - shortcutCenter[1]) / resolution],
      })
    }
  }
  for (const path of ['src/data/marsLayers.ts', 'src/features/map/createMarsMap.ts', 'src/features/map/mapProjection.ts', 'src/features/map/capabilities.ts', 'src/features/explorer/transition.ts', 'src/features/explorer/layers.ts', 'src/components/explorer/MarsExplorer.tsx', 'src/features/globe/createMarsGlobe.ts', 'src/styles/index.css', 'node_modules/ol/renderer/canvas/TileLayer.js']) {
    output.sourceHashes[path] = sha256(await readFile(resolve(root, path)))
  }
  const outputPath = resolve(evidenceDir, 'render-trace.json')
  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n')
  console.log(JSON.stringify({ outputPath, projection: output.projection, shortcut: output.currentShortcut, layers: output.layers.map((layer) => ({ id: layer.id, maxZoom: layer.tileGridMaxZoom, opacity: layer.opacity, interpolate: layer.interpolate, selectedLevels: layer.selectedLevels.filter((row) => Number.isInteger(row.viewZoom)).map((row) => ({ viewZoom: row.viewZoom, matrix: row.requestedMatrixIdentifier, cssPixelScale: row.sourcePixelScaleInCssPixels })) })), simulatedViewports: output.simulatedViewports, assertionStatus: 'PASS (configuration APIs only)' }, null, 2))
} finally {
  for (const source of sources) source.dispose()
  await server.close()
}
