import { DOMParser } from '@xmldom/xmldom'
import { expect, it } from 'vitest'
import { MARS_LAYERS } from '../../data/marsLayers'
import { readCapabilities } from './capabilities'
import { createDisplayProjection, createTileSource } from './mapProjection'
import ctxXml from '../../../docs/evidence/phase-2/Jezero_CTX_BlockAdj_dd.WMTSCapabilities.xml?raw'
import controlledCtxXml from '../../../docs/evidence/challenge-resources-2026-11-13/controlled-ctx-capabilities.xml?raw'

it('configures OpenLayers to request the independently probed Jezero tile with correct row/column order', () => {
  const definition = MARS_LAYERS[1]
  const contract = readCapabilities(ctxXml, definition, (source) => new DOMParser().parseFromString(source, 'text/xml') as unknown as Document)
  const projection = createDisplayProjection()
  const source = createTileSource(definition, contract, projection, () => {})
  expect(projection.getCode()).toBe('REDLINE:MARS-TREK-DISPLAY')
  expect(projection.getUnits()).toBe('degrees')
  expect(projection.getAxisOrientation()).toBe('enu')
  expect(projection.getMetersPerUnit()).toBeCloseTo(59_274.6975, 3)
  expect(source.getTileGrid()?.getResolution(0)).toBe(0.703125)
  expect(source.getTileGrid()?.getMaxZoom()).toBe(12)
  expect(source.getTileGrid()?.getFullTileRange(9)?.containsXY(732, 203)).toBe(true)
  expect(source.getTileGrid()?.getFullTileRange(9)?.containsXY(0, 0)).toBe(false)
  expect(source.getTileUrlFunction()([9, 732, 203], 1, projection)).toBe('https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_BlockAdj_dd/1.0.0//default/default028mm/9/203/732.png')
  expect(source.getWrapX()).toBe(false)
  source.dispose()
})

it('requests the controlled Jezero tile at its independently saved row, column and level 13', () => {
  const definition = MARS_LAYERS.find((layer) => layer.id === 'controlledCtx')!
  const contract = readCapabilities(controlledCtxXml, definition, (source) => new DOMParser().parseFromString(source, 'text/xml') as unknown as Document)
  const projection = createDisplayProjection()
  const source = createTileSource(definition, contract, projection, () => {})
  expect(source.getTileGrid()?.getMaxZoom()).toBe(13)
  expect(source.getTileGrid()?.getFullTileRange(13)?.containsXY(11727, 3258)).toBe(true)
  expect(source.getTileGrid()?.getFullTileRange(13)?.containsXY(0, 0)).toBe(false)
  expect(source.getTileUrlFunction()([13, 11727, 3258], 1, projection)).toBe('https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0//default/default028mm/13/3258/11727.png')
  source.dispose()
})
