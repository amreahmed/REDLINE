import ImageTile from 'ol/ImageTile'
import type OlMap from 'ol/Map'
import TileState from 'ol/TileState'
import type TileLayer from 'ol/layer/Tile'
import type WMTS from 'ol/source/WMTS'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { globeLayerById } from '../../data/globeLayers'
import { createGlobeMapImagery, geographicMapContext } from './globeMapImagery'
import { createDisplayProjection } from './mapProjection'
import { requestTile, ResourceError } from './requests'

vi.mock('./requests', async importOriginal => ({ ...await importOriginal<typeof import('./requests')>(), requestTile: vi.fn() }))

describe('geographic globe to map camera bridge', () => {
  it('preserves planetocentric north/east coordinates and wraps the longitude discontinuity', () => {
    expect(geographicMapContext([77.69, 18.41], 2, [800, 600]).center).toEqual([77.69000000000005, 18.41])
    expect(geographicMapContext([190, -14.5], 2, [800, 600]).center).toEqual([-170, -14.5])
    expect(geographicMapContext([180, 90], 2, [800, 600]).center).toEqual([-180, 90])
  })
  it('approaches regional detail monotonically without claiming a physical altitude', () => {
    const distant = geographicMapContext([0, 0], 4, [1000, 800])
    const close = geographicMapContext([0, 0], 1.0015, [1000, 800])
    expect(close.zoom).toBeGreaterThan(distant.zoom)
    expect(close.zoom).toBeLessThanOrEqual(13)
    expect(close.center).toEqual([0, 0])
  })
  it('rejects invalid latitude, camera and viewport instead of fabricating a location', () => {
    expect(() => geographicMapContext([0, 91], 2, [800, 600])).toThrow()
    expect(() => geographicMapContext([NaN, 0], 2, [800, 600])).toThrow()
    expect(() => geographicMapContext([0, 0], 1, [800, 600])).toThrow()
    expect(() => geographicMapContext([0, 0], 2, [0, 600])).toThrow()
  })
})

// Real OpenLayers tile/source objects, with only image decoding and network I/O
// replaced by deterministic test fixtures; these pixels are never Mars data.
describe('explicit globe imagery map-source lifecycle', () => {
  let imagery: ReturnType<typeof createGlobeMapImagery> | undefined
  let imageSize = 512
  let pixelAlpha = 255
  let pixelRgb = 0
  const changed = vi.fn()
  const request = vi.mocked(requestTile)
  let overlay: TileLayer<WMTS>
  let center = [77.4, 18.45]
  let map: OlMap

  beforeEach(() => {
    changed.mockReset()
    request.mockReset().mockResolvedValue(new Blob(['test-only-image'], { type: 'image/png' }))
    imageSize = 512
    pixelAlpha = 255
    pixelRgb = 0
    center = [77.4, 18.45]
    vi.stubGlobal('Image', class {
      src = ''
      crossOrigin = ''
      naturalWidth = imageSize
      naturalHeight = imageSize
      decode() { return Promise.resolve() }
    })
    // Avoid DOM/canvas emulation: deterministic RGBA readback exercises the
    // actual alpha-only support adapter without interpreting image brightness.
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0, height: 0,
        getContext: () => ({
          drawImage: vi.fn(),
          getImageData: (_x: number, _y: number, width: number, height: number) => {
            const data = new Uint8ClampedArray(width * height * 4)
            for (let offset = 0; offset < data.length; offset += 4) {
              data[offset] = pixelRgb; data[offset + 1] = pixelRgb; data[offset + 2] = pixelRgb
              data[offset + 3] = pixelAlpha
            }
            return { data }
          },
        }),
      })),
    })
    map = {
      addLayer: vi.fn(layer => { overlay = layer }),
      removeLayer: vi.fn(),
      getView: () => ({ getCenter: () => center }),
      on: vi.fn(), un: vi.fn(),
    } as unknown as OlMap
    imagery = createGlobeMapImagery(map, createDisplayProjection(), changed)
  })

  afterEach(() => { imagery?.dispose(); imagery = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals() })
  const loadTile = () => {
    const tile = new ImageTile([0, 0, 0], TileState.IDLE, 'test-only-image', { crossOrigin: 'anonymous' }, vi.fn())
    overlay.getSource()!.getTileLoadFunction()(tile, 'https://test.invalid/fixture.png')
    return tile
  }

  it('validates actual dimensions and reports image completion with revoked temporary URLs', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    imagery!.setLayer(globeLayerById('globalCtx'))
    const tile = loadTile()
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'loading', pending: 1 }))
    await vi.waitFor(() => expect(tile.getState()).toBe(TileState.LOADED))
    expect(changed).toHaveBeenLastCalledWith({ phase: 'ready', pending: 0, loaded: 1, failed: 0, missing: 0 })
    expect(request).toHaveBeenCalledWith('https://test.invalid/fixture.png', 'image/png', expect.any(AbortSignal))
    expect(revoke).toHaveBeenCalledOnce()
  })

  it('separates source-reported missing imagery from malformed image failures', async () => {
    imagery!.setLayer(globeLayerById('globalCtx'))
    request.mockRejectedValueOnce(new ResourceError('missing', 'Test-only missing tile'))
    const missing = loadTile()
    await vi.waitFor(() => expect(missing.getState()).toBe(TileState.EMPTY))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'error', missing: 1, failed: 0, loaded: 0 }))
    imagery!.retry()
    imageSize = 256 // Deliberately wrong for the 512-pixel global source.
    const malformed = loadTile()
    await vi.waitFor(() => expect(malformed.getState()).toBe(TileState.ERROR))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'error', missing: 0, failed: 1, loaded: 0 }))
  })

  it('treats a completely transparent PNG as missing imagery even when its RGB values are nonzero', async () => {
    pixelRgb = 180
    pixelAlpha = 0
    imagery!.setLayer(globeLayerById('globalCtx'))
    const transparent = loadTile()
    await vi.waitFor(() => expect(transparent.getState()).toBe(TileState.EMPTY))
    expect(changed).toHaveBeenLastCalledWith({ phase: 'error', pending: 0, loaded: 0, failed: 0, missing: 1 })
  })

  it('preserves opaque black PNG pixels as valid visible imagery rather than inferring NoData from brightness', async () => {
    pixelRgb = 0
    pixelAlpha = 255
    imagery!.setLayer(globeLayerById('globalCtx'))
    const black = loadTile()
    await vi.waitFor(() => expect(black.getState()).toBe(TileState.LOADED))
    expect(changed).toHaveBeenLastCalledWith({ phase: 'ready', pending: 0, loaded: 1, failed: 0, missing: 0 })
  })

  it('cancels an obsolete dataset request and prevents its completion from becoming the new source status', async () => {
    let completeOld: ((blob: Blob) => void) | undefined
    request.mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve }))
    imagery!.setLayer(globeLayerById('globalCtx'))
    const stale = loadTile()
    const signal = request.mock.calls[0][2]
    imageSize = 256
    imagery!.setLayer(globeLayerById('hirise'))
    expect(signal.aborted).toBe(true)
    const current = loadTile()
    await vi.waitFor(() => expect(current.getState()).toBe(TileState.LOADED))
    const count = changed.mock.calls.length
    completeOld!(new Blob(['test-only-obsolete-image']))
    await vi.waitFor(() => expect(stale.getState()).toBe(TileState.EMPTY))
    expect(changed).toHaveBeenCalledTimes(count)
    expect(changed).toHaveBeenLastCalledWith({ phase: 'ready', pending: 0, loaded: 1, failed: 0, missing: 0 })
  })

  it('keeps partial missing imagery counts even when other source tiles load', async () => {
    imagery!.setLayer(globeLayerById('globalCtx'))
    const available = loadTile()
    await vi.waitFor(() => expect(available.getState()).toBe(TileState.LOADED))
    request.mockRejectedValueOnce(new ResourceError('missing', 'Test-only mosaic gap'))
    const missing = loadTile()
    await vi.waitFor(() => expect(missing.getState()).toBe(TileState.EMPTY))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ pending: 0, loaded: 1, failed: 0, missing: 1 }))
  })

  it('discloses footprint absence and removes source/listeners exactly once on disposal', () => {
    center = [-170, -14.5]
    imagery!.setLayer(globeLayerById('hirise'))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'outside' }))
    const source = overlay.getSource()!
    const disposeSource = vi.spyOn(source, 'dispose')
    imagery!.dispose()
    imagery!.dispose()
    const count = changed.mock.calls.length
    imagery!.setLayer(globeLayerById('globalCtx'))
    imagery!.retry()
    expect(changed).toHaveBeenCalledTimes(count)
    expect(overlay.getSource()).toBeNull()
    expect(disposeSource).toHaveBeenCalledOnce()
    expect(map.removeLayer).toHaveBeenCalledOnce()
    expect(map.un).toHaveBeenCalledWith('moveend', expect.any(Function))
  })
})
