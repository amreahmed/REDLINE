import type { Bounds, TileContract } from '../map/types'
import { globeAngularViewRadius, wrapGlobeLongitude } from './geographicMath'
import type { GeographicCoordinate } from './geographicMath'

export type GlobeTileLayer = { id: string; name: string; coverage: readonly [number, number, number, number]; minZoom: number; maxZoom: number; tileSource: TileContract }
export type GlobeTile = { key: string; level: number; column: number; row: number; bounds: Bounds; clippedBounds: Bounds }
export type GlobeImageryStatus = { phase: 'loading' | 'ready' | 'error' | 'outside'; pending: number; loaded: number; failed: number; missing: number }

const overlaps = (a: readonly number[], b: readonly number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
const clip = (a: Bounds, b: readonly number[]): Bounds => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]

/** Current-center availability is separate from a footprint visible near the horizon. */
export function globeLayerCoversCoordinate(layer: Pick<GlobeTileLayer, 'coverage'>, [longitude, latitude]: GeographicCoordinate): boolean {
  const [west, south, east, north] = layer.coverage
  const roundoff = Number.EPSILON * 360 * 32
  if (![longitude, latitude, west, south, east, north].every(Number.isFinite) || latitude < -90 || latitude > 90 || latitude < south - roundoff || latitude > north + roundoff || east < west) return false
  const signedLongitude = wrapGlobeLongitude(longitude)
  return [signedLongitude, signedLongitude - 360, signedLongitude + 360].some(value => value >= west - roundoff && value <= east + roundoff)
}

export function globeTileAt(layer: GlobeTileLayer, level: number, column: number, row: number): GlobeTile | null {
  const source = layer.tileSource
  const size = source.sizes[level]
  if (!size || !Number.isInteger(level) || level < layer.minZoom || level > layer.maxZoom || !Number.isInteger(column) || !Number.isInteger(row) || row < 0 || row >= size[1]) return null
  const x = ((column % size[0]) + size[0]) % size[0]
  const span = source.resolutions[level] * source.tileSize
  const bounds: Bounds = [source.origin[0] + x * span, source.origin[1] - (row + 1) * span, source.origin[0] + (x + 1) * span, source.origin[1] - row * span]
  if (!overlaps(bounds, layer.coverage)) return null
  return { key: `${level}/${x}/${row}`, level, column: x, row, bounds, clippedBounds: clip(bounds, layer.coverage) }
}

export function globeTileUrl(layer: GlobeTileLayer, tile: GlobeTile): string {
  const source = layer.tileSource
  return source.template.replaceAll('{Style}', source.style).replaceAll('{TileMatrixSet}', source.matrixSet).replaceAll('{TileMatrix}', source.matrixIds[tile.level]).replaceAll('{TileRow}', String(tile.row)).replaceAll('{TileCol}', String(tile.column))
}

/** Complete low-resolution source footprint, retained underneath view refinements. */
export function globeOverviewTiles(layer: GlobeTileLayer): GlobeTile[] {
  const level = layer.minZoom, size = layer.tileSource.sizes[level]
  if (!size || size[0] * size[1] > 64) return []
  const tiles: GlobeTile[] = []
  for (let row = 0; row < size[1]; row++) for (let column = 0; column < size[0]; column++) {
    const tile = globeTileAt(layer, level, column, row)
    if (tile) tiles.push(tile)
  }
  return tiles
}

export function selectGlobeTiles(layer: GlobeTileLayer, coordinate: GeographicCoordinate, distance: number, viewportHeight: number, aspect: number, fov = 40, maximumTiles = 64, previousLevel?: number): { level: number; tiles: GlobeTile[] } {
  const lon = wrapGlobeLongitude(coordinate[0]), lat = coordinate[1]
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(viewportHeight) || viewportHeight <= 0) throw new RangeError('Invalid globe tile view.')
  const radius = globeAngularViewRadius(distance, fov, aspect)
  const latitudeLow = Math.max(-90, lat - radius), latitudeHigh = Math.min(90, lat + radius)
  const touchesPole = latitudeLow <= -90 || latitudeHigh >= 90
  const longitudeRadius = touchesPole ? 180 : Math.asin(Math.min(1, Math.sin(radius * Math.PI / 180) / Math.cos(lat * Math.PI / 180))) * 180 / Math.PI
  const baseSpan = layer.tileSource.resolutions[0] * layer.tileSource.tileSize
  const desiredLevel = Math.log2(baseSpan / Math.max(radius * 2, 1e-8)) + Math.log2(viewportHeight / layer.tileSource.tileSize)
  let level = Math.max(layer.minZoom, Math.min(layer.maxZoom, Math.ceil(desiredLevel)))
  if (previousLevel !== undefined && previousLevel >= layer.minZoom && previousLevel <= layer.maxZoom && Math.abs(level - previousLevel) <= 1 && desiredLevel >= previousLevel - 1.25 && desiredLevel <= previousLevel + 0.25) level = previousLevel
  if (latitudeHigh <= layer.coverage[1] || latitudeLow >= layer.coverage[3]) return { level, tiles: [] }
  let selected: GlobeTile[] = []
  for (;;) {
    const span = layer.tileSource.resolutions[level] * layer.tileSource.tileSize
    const size = layer.tileSource.sizes[level]
    const west = touchesPole ? layer.tileSource.origin[0] : lon - longitudeRadius
    const east = touchesPole ? layer.tileSource.origin[0] + size[0] * span : lon + longitudeRadius
    const firstColumn = Math.floor((west - layer.tileSource.origin[0]) / span)
    const lastColumn = Math.min(firstColumn + size[0] - 1, Math.floor((east - layer.tileSource.origin[0] - 1e-10) / span))
    const firstRow = Math.max(0, Math.floor((layer.tileSource.origin[1] - latitudeHigh) / span))
    const lastRow = Math.min(size[1] - 1, Math.floor((layer.tileSource.origin[1] - latitudeLow - 1e-10) / span))
    // Bound enumeration before allocating at polar or very high-resolution views.
    // Longitude convergence can otherwise produce hundreds of thousands of tiles.
    if ((lastColumn - firstColumn + 1) * (lastRow - firstRow + 1) > maximumTiles && level > layer.minZoom) { level--; continue }
    const tiles = new Map<string, GlobeTile>()
    for (let row = firstRow; row <= lastRow; row++) for (let column = firstColumn; column <= lastColumn; column++) {
      const tile = globeTileAt(layer, level, column, row)
      if (tile) tiles.set(tile.key, tile)
    }
    // Ancestors retain the same dataset during detailed tile loading or failures.
    for (const tile of [...tiles.values()]) for (let parentLevel = level - 1; parentLevel >= layer.minZoom; parentLevel--) {
      const factor = 2 ** (level - parentLevel)
      const parent = globeTileAt(layer, parentLevel, Math.floor(tile.column / factor), Math.floor(tile.row / factor))
      if (parent) tiles.set(parent.key, parent)
    }
    selected = [...tiles.values()].sort((a, b) => a.level - b.level || a.row - b.row || a.column - b.column)
    if (selected.length <= maximumTiles || level === layer.minZoom) break
    level--
  }
  return { level, tiles: selected }
}

export class MissingGlobeTile extends Error {}

type Entry<T> = { tile: GlobeTile; state: 'queued' | 'loading' | 'ready' | 'failed' | 'missing'; resource?: T; abort?: AbortController; touch: number }

/** Bounded, abortable cache; it contains only tiles of one explicit source layer. */
export function createGlobeTileCache<T>(load: (tile: GlobeTile, signal: AbortSignal) => Promise<T>, release: (resource: T) => void, changed: () => void, options: { concurrency?: number; capacity?: number; retainReady?: boolean } = {}) {
  const concurrency = Number.isFinite(options.concurrency) ? Math.max(1, Math.min(6, Math.trunc(options.concurrency!))) : 4
  const capacity = Number.isFinite(options.capacity) ? Math.max(8, Math.min(96, Math.trunc(options.capacity!))) : 64
  const entries = new Map<string, Entry<T>>()
  let wanted = new Set<string>(), pinned = new Set<string>(), desired = new Set<string>(), busy = 0, serial = 0, disposed = false
  const notify = () => { if (!disposed) changed() }
  const evict = (limit = capacity, keep = new Set<string>()) => {
    for (const [key, entry] of [...entries].sort((a, b) => a[1].touch - b[1].touch)) {
      if (entries.size <= limit) break
      if (desired.has(key) || keep.has(key) || entry.state === 'loading') continue
      if (entry.resource !== undefined) release(entry.resource)
      entries.delete(key)
    }
  }
  const pump = () => {
    if (disposed) return
    const queued = [...entries.values()].filter(entry => entry.state === 'queued' && desired.has(entry.tile.key)).sort((a, b) => Number(pinned.has(b.tile.key)) - Number(pinned.has(a.tile.key)) || a.tile.level - b.tile.level || a.touch - b.touch)
    for (const entry of queued) {
      if (busy >= concurrency) break
      const abort = new AbortController()
      entry.abort = abort
      entry.state = 'loading'
      busy++
      void Promise.resolve().then(() => { abort.signal.throwIfAborted(); return load(entry.tile, abort.signal) }).then(resource => {
        if (disposed || abort.signal.aborted || entries.get(entry.tile.key) !== entry) { release(resource); return }
        entry.resource = resource
        entry.state = 'ready'
      }).catch(error => {
        if (disposed || abort.signal.aborted || entries.get(entry.tile.key) !== entry) return
        entry.state = error instanceof MissingGlobeTile ? 'missing' : 'failed'
      }).finally(() => { busy--; entry.abort = undefined; evict(); notify(); pump() })
    }
    notify()
  }
  return {
    update(tiles: readonly GlobeTile[], overview: readonly GlobeTile[] = []) {
      if (disposed) return
      wanted = new Set(tiles.map(tile => tile.key))
      pinned = new Set(overview.map(tile => tile.key))
      desired = new Set([...wanted, ...pinned])
      for (const [key, entry] of entries) if (!desired.has(key) && (entry.state === 'loading' || entry.state === 'queued')) { entry.abort?.abort(); entries.delete(key) }
      for (const tile of [...overview, ...tiles]) {
        const entry = entries.get(tile.key)
        if (entry) entry.touch = ++serial
        else entries.set(tile.key, { tile, state: 'queued', touch: ++serial })
      }
      evict()
      pump()
    },
    ready(): readonly { tile: GlobeTile; resource: T; visible: boolean }[] {
      return [...entries.values()].flatMap(entry => entry.state === 'ready' && entry.resource !== undefined ? [{ tile: entry.tile, resource: entry.resource, visible: wanted.size > 0 && (options.retainReady || desired.has(entry.tile.key)) }] : [])
    },
    status(): GlobeImageryStatus {
      const counts = { pending: 0, loaded: 0, failed: 0, missing: 0 }
      for (const key of wanted) {
        const entry = entries.get(key)
        if (entry?.state === 'ready') counts.loaded++
        else if (entry?.state === 'failed') counts.failed++
        else if (entry?.state === 'missing') counts.missing++
        else counts.pending++
      }
      return { phase: !wanted.size ? 'outside' : counts.pending ? 'loading' : counts.loaded ? 'ready' : 'error', ...counts }
    },
    retry() {
      if (disposed) return
      for (const key of desired) {
        const entry = entries.get(key)
        if (entry?.state === 'failed' || entry?.state === 'missing') entry.state = 'queued'
      }
      pump()
    },
    trim(limit: number, keep: readonly GlobeTile[] = []) { if (!disposed && Number.isFinite(limit)) evict(Math.max(8, Math.trunc(limit)), new Set(keep.map(tile => tile.key))) },
    dispose() {
      if (disposed) return
      disposed = true
      for (const entry of entries.values()) { entry.abort?.abort(); if (entry.resource !== undefined) release(entry.resource) }
      entries.clear()
      wanted.clear(); pinned.clear(); desired.clear()
    },
  }
}
