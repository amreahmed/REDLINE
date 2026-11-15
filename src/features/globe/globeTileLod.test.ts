import { describe, expect, it, vi } from 'vitest'
import type { TileContract } from '../map/types'
import { createGlobeTileCache, globeLayerCoversCoordinate, globeOverviewTiles, globeTileAt, globeTileUrl, MissingGlobeTile, selectGlobeTiles } from './globeTileLod'
import { globeAngularViewRadius } from './geographicMath'
import type { GlobeTileLayer } from './globeTileLod'

// Angular fixture only; no test imagery is shipped as NASA data.
function layer(tileSize = 512, maxZoom = 17): GlobeTileLayer {
  const source: TileContract = { extent: [-180, -90, 180, 90], origin: [-180, 90], matrixSet: 'default028mm', style: 'default', tileSize, format: 'image/png', matrixIds: Array.from({ length: maxZoom + 1 }, (_, z) => String(z)), resolutions: Array.from({ length: maxZoom + 1 }, (_, z) => 360 / (tileSize * 2 ** (z + 1))), sizes: Array.from({ length: maxZoom + 1 }, (_, z) => [2 ** (z + 1), 2 ** z]), template: 'https://example.invalid/{TileMatrix}/{TileRow}/{TileCol}.png' }
  return { id: 'test-only', name: 'Test-only source', minZoom: 0, maxZoom, coverage: [-180, -90, 180, 90], tileSource: source }
}

describe('generic angular globe imagery LOD', () => {
  it('checks current-center footprint coverage independently from visible angular tile selection', () => {
    const regional = { ...layer(), coverage: [76.8, 17.8, 78.5, 19.2] as const }
    expect(selectGlobeTiles(regional, [20, 10], 4, 600, 1.4).tiles.length).toBeGreaterThan(0)
    expect(globeLayerCoversCoordinate(regional, [20, 10])).toBe(false)
    expect(globeLayerCoversCoordinate(regional, [77.69, 18.41])).toBe(true)
    expect(globeLayerCoversCoordinate(regional, [437.69, 18.41])).toBe(true)
    expect(globeLayerCoversCoordinate(regional, [76.8, 17.8])).toBe(true)
    expect(globeLayerCoversCoordinate(regional, [77.69, 19.21])).toBe(false)
    expect(globeLayerCoversCoordinate(layer(), [180, 90])).toBe(true)
    expect(globeLayerCoversCoordinate(regional, [NaN, 18.41])).toBe(false)
  })
  it('retains a complete bounded overview while clipping regional coverage honestly', () => {
    expect(globeOverviewTiles(layer()).map(tile => tile.key)).toEqual(['0/0/0', '0/1/0'])
    const regional = { ...layer(), coverage: [77.2, 18.3, 77.58, 18.67] as const }
    expect(globeOverviewTiles(regional)).toHaveLength(1)
    expect(globeOverviewTiles(regional)[0].clippedBounds).toEqual(regional.coverage)
  })
  it('holds the same LOD while zoom oscillates around a detail boundary', () => {
    const distance = 1.01, previousLevel = 5
    const boundaryHeight = 512 * 2 ** previousLevel * globeAngularViewRadius(distance, 40, 1) * 2 / 180
    const above = selectGlobeTiles(layer(), [20, 10], distance, boundaryHeight * 1.01, 1)
    expect(above.level).toBe(previousLevel + 1)
    for (const jitter of [0.99, 1.01, 0.98, 1.02]) expect(selectGlobeTiles(layer(), [20, 10], distance, boundaryHeight * jitter, 1, 40, 64, previousLevel).level).toBe(previousLevel)
  })
  it('honors 512px global and 256px regional contracts without changing angular placement', () => {
    const global = globeTileAt(layer(512), 3, 11, 2)!, regional = globeTileAt(layer(256), 3, 11, 2)!
    expect(global.bounds).toEqual(regional.bounds)
    expect(global.bounds).toEqual([67.5, 22.5, 90, 45])
    expect(globeTileUrl(layer(512), global)).toBe('https://example.invalid/3/2/11.png')
    expect(globeTileAt(layer(), 3, -1, 0)?.column).toBe(15)
    expect(globeTileAt(layer(), 3, 1, -1)).toBeNull()
  })
  it('keeps same-source ancestors while requesting bounded detail as camera approaches', () => {
    const far = selectGlobeTiles(layer(), [77.69, 18.41], 4, 1000, 1.4)
    const near = selectGlobeTiles(layer(), [77.69, 18.41], 1.002, 1000, 1.4)
    expect(near.level).toBeGreaterThan(far.level)
    expect(near.tiles.length).toBeLessThanOrEqual(64)
    expect(near.tiles.some(tile => tile.level === 0)).toBe(true)
    expect(new Set(near.tiles.map(tile => tile.key)).size).toBe(near.tiles.length)
  })
  it('wraps seam requests and bounds close north/south pole work before enumeration', () => {
    for (const coordinate of [[179.999, 0], [-179.999, 0], [0, 89.9999], [0, -89.9999]] as const) {
      const selected = selectGlobeTiles(layer(), coordinate, 1.0015, 1600, 1.4)
      expect(selected.tiles.length).toBeLessThanOrEqual(64)
      for (const tile of selected.tiles) {
        expect(tile.bounds[0]).toBeGreaterThanOrEqual(-180)
        expect(tile.bounds[2]).toBeLessThanOrEqual(180)
        expect(tile.bounds[1]).toBeGreaterThanOrEqual(-90)
        expect(tile.bounds[3]).toBeLessThanOrEqual(90)
      }
    }
  })
  it('clips actual regional footprints and returns explicit unavailable polar coverage', () => {
    const regional = { ...layer(), coverage: [77.2, 18.3, 77.58, 18.67] as const }
    const near = selectGlobeTiles(regional, [77.4, 18.5], 1.002, 1000, 1)
    expect(near.tiles.length).toBeGreaterThan(0)
    near.tiles.forEach(tile => { expect(tile.clippedBounds[0]).toBeGreaterThanOrEqual(77.2); expect(tile.clippedBounds[2]).toBeLessThanOrEqual(77.58) })
    expect(selectGlobeTiles(regional, [0, 89.9], 1.0015, 1000, 1).tiles).toEqual([])
  })
})

describe('abortable imagery cache', () => {
  it('keeps a pinned overview and cached detail visible through rapid selection churn', async () => {
    const overview = globeTileAt(layer(), 0, 0, 0)!, first = globeTileAt(layer(), 3, 5, 2)!, second = globeTileAt(layer(), 3, 6, 2)!
    const pending: { key: string; signal: AbortSignal; resolve: (value: string) => void }[] = []
    const load = vi.fn((tile: typeof overview, signal: AbortSignal) => new Promise<string>(resolve => pending.push({ key: tile.key, signal, resolve })))
    const cache = createGlobeTileCache(load, vi.fn(), vi.fn(), { retainReady: true })
    cache.update([first], [overview])
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending.forEach(request => request.resolve(request.key))
    await vi.waitFor(() => expect(cache.status().loaded).toBe(1))
    cache.update([second], [overview])
    await vi.waitFor(() => expect(pending).toHaveLength(3))
    expect(cache.ready().filter(entry => entry.visible).map(entry => entry.tile.key)).toEqual(expect.arrayContaining([overview.key, first.key]))
    cache.update([first], [overview])
    expect(pending[2].signal.aborted).toBe(true)
    await Promise.resolve(); await Promise.resolve()
    expect(load.mock.calls.filter(call => call[0].key === overview.key)).toHaveLength(1)
    expect(load.mock.calls.filter(call => call[0].key === first.key)).toHaveLength(1)
    cache.update([])
    expect(cache.status().phase).toBe('outside')
    expect(cache.ready().every(entry => !entry.visible)).toBe(true)
    pending[2].resolve(second.key)
    cache.dispose()
  })
  it('never begins a request cancelled before its loader microtask', async () => {
    const load = vi.fn(async () => 1), cache = createGlobeTileCache(load, vi.fn(), vi.fn())
    cache.update([globeTileAt(layer(), 0, 0, 0)!])
    cache.update([])
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(load).not.toHaveBeenCalled()
    expect(cache.status().phase).toBe('outside')
    cache.dispose()
  })
  it('deduplicates, caps concurrent requests, aborts obsolete work and disposes late results', async () => {
    const pending: { signal: AbortSignal; resolve: (value: number) => void }[] = []
    const load = vi.fn((_tile, signal: AbortSignal) => new Promise<number>(resolve => pending.push({ signal, resolve })))
    const release = vi.fn(), cache = createGlobeTileCache(load, release, vi.fn(), { concurrency: 2, capacity: 8 })
    const tiles = [0, 1, 2].map(x => globeTileAt(layer(), 2, x, 0)!)
    cache.update(tiles); cache.update(tiles)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    expect(cache.status().pending).toBe(3)
    cache.update([tiles[2]])
    expect(pending[0].signal.aborted).toBe(true)
    pending[0].resolve(1); pending[1].resolve(2)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3))
    expect(release).toHaveBeenCalledWith(1)
    expect(release).toHaveBeenCalledWith(2)
    pending[2].resolve(3)
    await vi.waitFor(() => expect(cache.status().phase).toBe('ready'))
    cache.update([tiles[2]])
    expect(load).toHaveBeenCalledTimes(3)
    cache.dispose(); cache.dispose()
    expect(release).toHaveBeenCalledWith(3)
    expect(release).toHaveBeenCalledTimes(3)
  })
  it('separates missing tiles from failed requests and retries without fabricated data', async () => {
    const tile = globeTileAt(layer(), 0, 0, 0)!
    let attempt = 0
    const cache = createGlobeTileCache(async () => { attempt++; if (attempt === 1) throw new MissingGlobeTile('NoData'); if (attempt === 2) throw new Error('Offline'); return 7 }, vi.fn(), vi.fn())
    cache.update([tile])
    await vi.waitFor(() => expect(cache.status()).toEqual({ phase: 'error', pending: 0, loaded: 0, failed: 0, missing: 1 }))
    cache.retry()
    await vi.waitFor(() => expect(cache.status().failed).toBe(1))
    cache.retry()
    await vi.waitFor(() => expect(cache.status().loaded).toBe(1))
    cache.update([])
    expect(cache.status().phase).toBe('outside')
    cache.dispose()
  })
  it('evicts unneeded ready textures and releases every resource on disposal', async () => {
    const released = vi.fn(), cache = createGlobeTileCache(async tile => tile.key, released, vi.fn(), { capacity: 8, concurrency: 6 })
    for (let x = 0; x < 12; x++) {
      cache.update([globeTileAt(layer(), 4, x, 0)!])
      await vi.waitFor(() => expect(cache.status().loaded).toBe(1))
    }
    expect(cache.ready().length).toBeLessThanOrEqual(8)
    expect(released).toHaveBeenCalledTimes(4)
    cache.dispose()
    expect(released).toHaveBeenCalledTimes(12)
  })
  it('keeps the source overview when trimming an inactive cache for a later layer return', async () => {
    const overview = globeTileAt(layer(), 0, 0, 0)!
    const cache = createGlobeTileCache(async tile => tile.key, vi.fn(), vi.fn(), { capacity: 32, retainReady: true })
    const details = Array.from({ length: 12 }, (_, column) => globeTileAt(layer(), 4, column, 0)!)
    cache.update(details, [overview])
    await vi.waitFor(() => expect(cache.status().pending).toBe(0))
    cache.update([]); cache.trim(8, [overview])
    expect(cache.ready()).toHaveLength(8)
    expect(cache.ready().some(entry => entry.tile.key === overview.key)).toBe(true)
    cache.dispose()
  })
})
