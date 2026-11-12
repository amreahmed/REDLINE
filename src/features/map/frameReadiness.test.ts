import { describe, expect, it } from 'vitest'
import TileState from 'ol/TileState'
import { createAlphaSupport, frameMatches, hasVisibleAlpha, isCurrentImageTile } from './frameReadiness'
import type { RenderedImage, ViewFrame } from './frameReadiness'

// Synthetic display fixtures only; these are not Mars observations or measurements.
const frame: ViewFrame = { center: [77.69, 18.41], resolution: 0.0006866455078125, size: [960, 600] }
const tile: RenderedImage = { state: TileState.LOADED, level: 10, extent: [77.5, 18.3, 77.8, 18.6], hasPixels: true }
const viewport: [number, number, number, number] = [77.6, 18.35, 77.75, 18.5]

describe('current rendered imagery readiness', () => {
  it('rejects unrendered, resized, panned and zoomed stale frames', () => {
    expect(frameMatches(null, frame)).toBe(false)
    expect(frameMatches(frame, { ...frame })).toBe(true)
    expect(frameMatches(frame, { ...frame, size: [390, 430] })).toBe(false)
    expect(frameMatches(frame, { ...frame, center: [77.69, 18.42] })).toBe(false)
    expect(frameMatches(frame, { ...frame, resolution: frame.resolution / 2 })).toBe(false)
  })

  it('counts only a loaded target-level tile overlapping the view and clipped layer', () => {
    expect(isCurrentImageTile(tile, viewport, viewport, 10)).toBe(true)
    expect(isCurrentImageTile({ ...tile, level: 9 }, viewport, viewport, 10)).toBe(false)
    expect(isCurrentImageTile({ ...tile, state: TileState.LOADING }, viewport, viewport, 10)).toBe(false)
    expect(isCurrentImageTile({ ...tile, state: TileState.ERROR }, viewport, viewport, 10)).toBe(false)
    expect(isCurrentImageTile({ ...tile, state: TileState.EMPTY }, viewport, viewport, 10)).toBe(false)
    expect(isCurrentImageTile({ ...tile, extent: [70, 10, 71, 11] }, viewport, viewport, 10)).toBe(false)
    expect(isCurrentImageTile(tile, viewport, [78, 19, 79, 20], 10)).toBe(false)
    expect(isCurrentImageTile({ ...tile, hasPixels: false }, viewport, viewport, 10)).toBe(false)
  })

  it('does not count a tile merely touching the visible footprint boundary', () => {
    expect(isCurrentImageTile({ ...tile, extent: [77, 18, 77.6, 18.35] }, viewport, viewport, 10)).toBe(false)
    expect(isCurrentImageTile(tile, [NaN, 18, 78, 19], viewport, 10)).toBe(false)
  })

  it('uses alpha rather than grayscale brightness for image support', () => {
    expect(hasVisibleAlpha(new Uint8ClampedArray([0, 0, 0, 255]))).toBe(true)
    expect(hasVisibleAlpha(new Uint8ClampedArray([100, 100, 100, 0]))).toBe(false)
    expect(hasVisibleAlpha(new Uint8ClampedArray([0, 0, 0, 0, 50, 50, 50, 1]))).toBe(true)
  })

  it('rejects opaque pixels outside the visible crop of a partially transparent tile', () => {
    // Synthetic 4x4 image: only the northwest pixel has nonzero alpha.
    const image = { ...tile, extent: [0, 0, 4, 4] as [number, number, number, number], alphaMask: { width: 4, height: 4, rowWords: 1, bits: new Uint32Array([1, 0, 0, 0]) } }
    expect(isCurrentImageTile(image, [2, 0, 4, 2], image.extent, 10)).toBe(false)
    expect(isCurrentImageTile(image, [0, 3, 1, 4], image.extent, 10)).toBe(true)
  })

  it('uses north-down raster rows and excludes pixels touching only a crop boundary', () => {
    const image = { ...tile, extent: [0, 0, 4, 4] as [number, number, number, number], alphaMask: { width: 4, height: 4, rowWords: 1, bits: new Uint32Array([1, 0, 0, 0]) } }
    expect(isCurrentImageTile(image, [0, 0, 1, 1], image.extent, 10)).toBe(false)
    expect(isCurrentImageTile(image, [1, 3, 2, 4], image.extent, 10)).toBe(false)
    expect(isCurrentImageTile(image, [0, 2, 1, 3], image.extent, 10)).toBe(false)
    expect(isCurrentImageTile(image, image.extent, [2, 0, 4, 4], 10)).toBe(false)
  })

  it('clips alpha support across mask-word boundaries without counting adjacent pixels', () => {
    // Only x=31 and x=32 have alpha, on either side of a 32-bit word boundary.
    const image = { ...tile, extent: [0, 0, 64, 1] as [number, number, number, number], alphaMask: { width: 64, height: 1, rowWords: 2, bits: new Uint32Array([0x80000000, 1]) } }
    expect(isCurrentImageTile(image, [0, 0, 31, 1], image.extent, 10)).toBe(false)
    expect(isCurrentImageTile(image, [33, 0, 64, 1], image.extent, 10)).toBe(false)
    expect(isCurrentImageTile(image, [31, 0, 32, 1], image.extent, 10)).toBe(true)
    expect(isCurrentImageTile(image, [32, 0, 33, 1], image.extent, 10)).toBe(true)
  })

  it('caches decoded alpha support without using grayscale values or unknown image dimensions', () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4)
    // Valid black northwest pixel with faint alpha; valid southeast pixel with full alpha.
    rgba[3] = 1
    rgba[63] = 255
    const support = createAlphaSupport(rgba, 4, 4)
    const image = { ...tile, ...support, extent: [0, 0, 4, 4] as [number, number, number, number] }
    expect(isCurrentImageTile(image, [0, 3, 1, 4], image.extent, 10)).toBe(true)
    expect(isCurrentImageTile(image, [3, 0, 4, 1], image.extent, 10)).toBe(true)
    expect(isCurrentImageTile(image, [1, 1, 3, 3], image.extent, 10)).toBe(false)
    expect(createAlphaSupport(new Uint8ClampedArray([200, 200, 200, 0]), 1, 1).hasPixels).toBe(false)
    expect(createAlphaSupport(rgba, 3, 4).hasPixels).toBe(false)
    expect(createAlphaSupport(rgba, 0, 4).hasPixels).toBe(false)
    expect(createAlphaSupport(rgba, NaN, 4).hasPixels).toBe(false)
  })
})
