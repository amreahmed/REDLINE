import { describe, expect, it } from 'vitest'
import { Ray, Sphere, Vector3 } from 'three'
import { cartesianToGeographic, geographicToCartesian, globeAngularViewRadius, globePointVisible, interpolateGlobeDirection, wrapGlobeLongitude } from './geographicMath'

describe('explicit Mars globe angular display frame', () => {
  it('pins independent cardinal landmarks to the documented right-handed sphere axes', () => {
    for (const [coordinate, expected] of [[[0, 0], [0, 0, 1]], [[90, 0], [1, 0, 0]], [[-90, 0], [-1, 0, 0]], [[0, 90], [0, 1, 0]], [[0, -90], [0, -1, 0]], [[180, 0], [0, 0, -1]]] as const) {
      geographicToCartesian(coordinate).forEach((value, index) => expect(value).toBeCloseTo(expected[index], 12))
    }
  })
  it('preserves known approximate Jezero geometry and explicit east-west conventions', () => {
    const point = geographicToCartesian([77.58, 18.38])
    expect(point[0]).toBeGreaterThan(0.9)
    expect(point[1]).toBeCloseTo(Math.sin(18.38 * Math.PI / 180), 12)
    expect(point[2]).toBeGreaterThan(0)
    const coordinate = cartesianToGeographic(point)
    expect(coordinate[0]).toBeCloseTo(77.58, 12)
    expect(coordinate[1]).toBeCloseTo(18.38, 12)
  })
  it('wraps the discontinuity and rejects nonfinite/out-of-range angular data', () => {
    expect(wrapGlobeLongitude(540)).toBe(-180)
    expect(wrapGlobeLongitude(-541)).toBe(179)
    expect(geographicToCartesian([360, 0])).toEqual(geographicToCartesian([0, 0]))
    expect(() => geographicToCartesian([0, 90.01])).toThrow()
    expect(() => geographicToCartesian([NaN, 0])).toThrow()
    expect(() => cartesianToGeographic([0, 0, 0])).toThrow()
  })
  it('hides far-side and tangent markers while keeping near-side markers attached', () => {
    expect(globePointVisible([0, 0, 1], [0, 0, 4])).toBe(true)
    expect(globePointVisible([0, 0, -1], [0, 0, 4])).toBe(false)
    expect(globePointVisible([1, 0, 0], [0, 0, 4])).toBe(false)
    expect(globePointVisible([Math.sqrt(15) / 4, 0, 0.25], [0, 0, 4])).toBe(false)
    expect(globePointVisible([0, 0, 1], [0, 0, 0.5])).toBe(false)
  })
  it('increases imagery detail footprint continuously as the camera approaches', () => {
    const far = globeAngularViewRadius(4, 40, 1)
    const near = globeAngularViewRadius(1.01, 40, 1)
    expect(far).toBeCloseTo(Math.acos(0.25) * 180 / Math.PI, 10)
    expect(near).toBeGreaterThan(0)
    expect(near).toBeLessThan(1)
    expect(() => globeAngularViewRadius(1, 40, 1)).toThrow()
  })
  it('includes the rectangular viewport corners in close-view imagery bounds', () => {
    const distance = 1.1, fov = 40, aspect = 1.8
    const halfHeight = Math.tan(fov * Math.PI / 360)
    const direction = new Vector3(aspect * halfHeight, halfHeight, -1).normalize()
    const corner = new Ray(new Vector3(0, 0, distance), direction).intersectSphere(new Sphere(new Vector3(), 1), new Vector3())!
    expect(corner).not.toBeNull()
    const cornerAngle = Math.acos(corner.z) * 180 / Math.PI
    expect(globeAngularViewRadius(distance, fov, aspect)).toBeCloseTo(cornerAngle, 10)
  })
  it('uses an attached shortest-arc flight including antipodal and seam cases', () => {
    const start = geographicToCartesian([179, 0]), end = geographicToCartesian([-179, 0])
    const middle = interpolateGlobeDirection(start, end, 0.5)
    expect(Math.abs(cartesianToGeographic(middle)[0])).toBeCloseTo(180, 10)
    expect(Math.hypot(...middle)).toBeCloseTo(1, 12)
    const antipodal = interpolateGlobeDirection([0, 0, 1], [0, 0, -1], 0.5)
    expect(Math.hypot(...antipodal)).toBeCloseTo(1, 12)
    expect(antipodal[1]).toBeCloseTo(1, 12)
  })
})
