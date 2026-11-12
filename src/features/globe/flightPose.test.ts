import { describe, expect, it } from 'vitest'
import { overviewDistanceForAspect, sampleApproachPose, sampleOverviewPose } from './flightPose'

describe('scripted globe approach pose', () => {
  const start = { azimuth: 0.4, polar: 1.3, radius: 4.8 }

  it('starts at the captured overview direction and distance', () => {
    expect(sampleApproachPose(start, 0)).toEqual(start)
    expect(sampleApproachPose(start, -1)).toEqual(start)
  })

  it('finishes with a modest display rotation and close camera distance', () => {
    const end = sampleApproachPose(start, 1)
    expect(end.azimuth).toBeCloseTo(1.05)
    expect(end.polar).toBeCloseTo(1.18)
    expect(end.radius).toBeCloseTo(1.9)
    expect(sampleApproachPose(start, 2)).toEqual(end)
  })

  it('approaches monotonically without orbit or radius overshoot', () => {
    let previous = sampleApproachPose(start, 0)
    for (let frame = 1; frame <= 240; frame++) {
      const pose = sampleApproachPose(start, frame / 240)
      expect(pose.radius).toBeLessThanOrEqual(previous.radius)
      expect(pose.radius).toBeGreaterThanOrEqual(1.9 - 1e-12)
      expect(pose.azimuth).toBeGreaterThanOrEqual(previous.azimuth)
      expect(pose.polar).toBeLessThanOrEqual(previous.polar)
      previous = pose
    }
  })

  it('eases out of the overview and into the final pose without a hard velocity step', () => {
    const first = sampleApproachPose(start, 0.001)
    const last = sampleApproachPose(start, 0.999)
    const end = sampleApproachPose(start, 1)
    expect(first.azimuth - start.azimuth).toBeLessThan(0.00001)
    expect(first.radius).toBeCloseTo(start.radius)
    expect(last.radius - end.radius).toBeLessThan(0.00001)
    expect(last.azimuth).toBeCloseTo(end.azimuth)
  })

  it('reverses the same sampled path without an endpoint discontinuity', () => {
    const forward = Array.from({ length: 11 }, (_, index) => sampleApproachPose(start, index / 10))
    const backward = Array.from({ length: 11 }, (_, index) => sampleApproachPose(start, (10 - index) / 10))
    expect(backward.reverse()).toEqual(forward)
  })

  it('keeps camera framing finite for portrait, landscape and transient invalid sizes', () => {
    for (const aspect of [0, NaN, Infinity, 0.5, 1, 2]) {
      const radius = overviewDistanceForAspect(aspect)
      expect(Number.isFinite(radius)).toBe(true)
      expect(radius).toBeGreaterThanOrEqual(3.8)
      expect(radius).toBeLessThanOrEqual(7)
      expect(sampleApproachPose({ ...start, radius }, 1).radius).toBeCloseTo(1.9)
    }
    expect(overviewDistanceForAspect(0.5)).toBeGreaterThan(overviewDistanceForAspect(2))
  })

  it('uses a captured radius throughout the path rather than reading changing viewport dimensions', () => {
    const captured = { ...start, radius: overviewDistanceForAspect(1.5) }
    const beforeResize = sampleApproachPose(captured, 0.6)
    overviewDistanceForAspect(0.6)
    expect(sampleApproachPose(captured, 0.6)).toEqual(beforeResize)
  })

  it('handles invalid progress and stays away from polar singularities', () => {
    expect(sampleApproachPose(start, NaN)).toEqual(start)
    for (const polar of [0.05, Math.PI - 0.05]) {
      const pose = sampleApproachPose({ ...start, polar }, 1)
      expect(pose.polar).toBeGreaterThanOrEqual(0.05)
      expect(pose.polar).toBeLessThanOrEqual(Math.PI - 0.05)
      expect(Number.isFinite(pose.radius)).toBe(true)
    }
  })

  it('prepares the overview without changing direction and joins the approach exactly', () => {
    const close = { ...start, radius: 2.1 }
    const overviewRadius = overviewDistanceForAspect(0.8)
    expect(sampleOverviewPose(close, overviewRadius, 0)).toEqual(close)
    const middle = sampleOverviewPose(close, overviewRadius, 0.5)
    expect(middle.azimuth).toBe(close.azimuth)
    expect(middle.polar).toBe(close.polar)
    expect(middle.radius).toBeGreaterThan(close.radius)
    expect(middle.radius).toBeLessThan(overviewRadius)
    const overview = sampleOverviewPose(close, overviewRadius, 1)
    expect(overview).toEqual(sampleApproachPose({ ...close, radius: overviewRadius }, 0))
    expect(sampleOverviewPose(close, overviewRadius, 2)).toEqual(overview)
  })
})
