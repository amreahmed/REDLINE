import TileState from 'ol/TileState'
import type { Bounds } from './types'

export type ViewFrame = { center: [number, number]; resolution: number; size: [number, number] }
export type AlphaMask = { width: number; height: number; rowWords: number; bits: Uint32Array }
export type ImageSupport = { hasPixels: boolean; alphaMask?: AlphaMask }
export type RenderedImage = { state: number; level: number; extent: Bounds } & ImageSupport

export function frameMatches(rendered: ViewFrame | null, current: ViewFrame) {
  return !!rendered && rendered.resolution === current.resolution && rendered.center.every((value, i) => value === current.center[i]) && rendered.size.every((value, i) => value === current.size[i])
}

/** Only a display-readiness gate. This does not establish complete valid-pixel coverage. */
export function isCurrentImageTile(tile: RenderedImage, viewport: Bounds, coverage: Bounds, targetLevel: number) {
  if (tile.state !== TileState.LOADED || tile.level !== targetLevel || !tile.hasPixels) return false
  const west = Math.max(tile.extent[0], viewport[0], coverage[0])
  const south = Math.max(tile.extent[1], viewport[1], coverage[1])
  const east = Math.min(tile.extent[2], viewport[2], coverage[2])
  const north = Math.min(tile.extent[3], viewport[3], coverage[3])
  if (!(west < east && south < north)) return false
  // A JPEG is opaque. PNG readiness also needs alpha inside the actually visible crop.
  if (!tile.alphaMask) return true
  const { width, height, rowWords, bits } = tile.alphaMask
  const spanX = tile.extent[2] - tile.extent[0]
  const spanY = tile.extent[3] - tile.extent[1]
  if (spanX <= 0 || spanY <= 0) return false
  const left = Math.max(0, Math.floor((west - tile.extent[0]) / spanX * width))
  const right = Math.min(width, Math.ceil((east - tile.extent[0]) / spanX * width))
  // Geographic latitude increases northward; image rows increase southward.
  const top = Math.max(0, Math.floor((tile.extent[3] - north) / spanY * height))
  const bottom = Math.min(height, Math.ceil((tile.extent[3] - south) / spanY * height))
  if (left >= right || top >= bottom) return false
  const firstWord = left >>> 5
  const lastWord = (right - 1) >>> 5
  const firstMask = 0xffffffff << (left & 31)
  const lastMask = 0xffffffff >>> (31 - ((right - 1) & 31))
  for (let row = top; row < bottom; row++) {
    for (let word = firstWord; word <= lastWord; word++) {
      const mask = (word === firstWord ? firstMask : 0xffffffff) & (word === lastWord ? lastMask : 0xffffffff)
      if ((bits[row * rowWords + word] & mask) !== 0) return true
    }
  }
  return false
}

/** Decode once: 8 KB for a 256x256 alpha mask; no RGBA copies or allocation during a frame check. */
export function createAlphaSupport(rgba: Uint8ClampedArray, width: number, height: number): ImageSupport {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || rgba.length !== width * height * 4) return { hasPixels: false }
  const rowWords = Math.ceil(width / 32)
  const bits = new Uint32Array(rowWords * height)
  let hasPixels = false
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (rgba[(row * width + column) * 4 + 3] === 0) continue
      bits[row * rowWords + (column >>> 5)] |= 1 << (column & 31)
      hasPixels = true
    }
  }
  return hasPixels ? { hasPixels, alphaMask: { width, height, rowWords, bits } } : { hasPixels: false }
}

export function hasVisibleAlpha(rgba: Uint8ClampedArray) {
  for (let index = 3; index < rgba.length; index += 4) if (rgba[index] > 0) return true
  return false
}
