export type GeographicCoordinate = readonly [longitude: number, latitude: number]
export type CartesianPoint = readonly [number, number, number]

const radians = Math.PI / 180
const degrees = 180 / Math.PI

export function wrapGlobeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) throw new RangeError('Longitude must be finite.')
  return ((longitude + 180) % 360 + 360) % 360 - 180
}

/** Unit-sphere display coordinates: north +Y, prime meridian +Z, 90° east +X.
 * This explicit angular placement is not a surveyed landmark registration or DEM transform.
 */
export function geographicToCartesian([longitude, latitude]: GeographicCoordinate, radius = 1): CartesianPoint {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(radius) || radius <= 0) throw new RangeError('Invalid globe coordinate or display radius.')
  const lon = wrapGlobeLongitude(longitude) * radians
  const lat = latitude * radians
  const parallel = Math.cos(lat) * radius
  return [parallel * Math.sin(lon), radius * Math.sin(lat), parallel * Math.cos(lon)]
}

export function cartesianToGeographic([x, y, z]: CartesianPoint): GeographicCoordinate {
  const radius = Math.hypot(x, y, z)
  if (![x, y, z].every(Number.isFinite) || radius === 0) throw new RangeError('A finite nonzero position is required.')
  return [wrapGlobeLongitude(Math.atan2(x, z) * degrees), Math.asin(Math.max(-1, Math.min(1, y / radius))) * degrees]
}

/** Exact unit-sphere horizon test: the tangent plane hides back-side POIs. */
export function globePointVisible(point: CartesianPoint, camera: CartesianPoint): boolean {
  const radius = Math.hypot(...point)
  const cameraRadius = Math.hypot(...camera)
  if (radius <= 0 || ![...point, ...camera].every(Number.isFinite) || cameraRadius <= radius) return false
  return point.reduce((sum, value, index) => sum + value * camera[index], 0) > radius * radius + 1e-10
}

/** Geographic radius enclosing the rectangular viewport, including its corners.
 * Camera distance and radius are graphical units, not physical Mars altitude.
 */
export function globeAngularViewRadius(distance: number, fovDegrees: number, aspect: number): number {
  if (!Number.isFinite(distance) || distance <= 1 || !Number.isFinite(fovDegrees) || fovDegrees <= 0 || fovDegrees >= 180 || !Number.isFinite(aspect) || aspect <= 0) throw new RangeError('Invalid globe camera view.')
  const halfAngle = Math.atan(Math.tan(fovDegrees * radians / 2) * Math.hypot(1, aspect))
  const discriminant = 1 - distance * distance * Math.sin(halfAngle) ** 2
  if (discriminant <= 0) return Math.acos(1 / distance) * degrees
  const hitDistance = distance * Math.cos(halfAngle) - Math.sqrt(discriminant)
  return Math.atan2(hitDistance * Math.sin(halfAngle), distance - hitDistance * Math.cos(halfAngle)) * degrees
}

/** Shortest spherical interpolation, including a deterministic antipodal path. */
export function interpolateGlobeDirection(start: CartesianPoint, end: CartesianPoint, amount: number): CartesianPoint {
  const lengthA = Math.hypot(...start), lengthB = Math.hypot(...end)
  if (lengthA === 0 || lengthB === 0 || ![...start, ...end, amount].every(Number.isFinite)) throw new RangeError('Invalid globe flight direction.')
  const a = start.map(value => value / lengthA), b = end.map(value => value / lengthB)
  const t = Math.max(0, Math.min(1, amount))
  const dot = Math.max(-1, Math.min(1, a.reduce((sum, value, index) => sum + value * b[index], 0)))
  if (dot > 0.999999) return geographicToCartesian(cartesianToGeographic(a.map((value, index) => value * (1 - t) + b[index] * t) as unknown as CartesianPoint))
  if (dot < -0.999999) {
    const axis = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const projection = axis.reduce((sum, value, index) => sum + value * a[index], 0)
    const tangent = axis.map((value, index) => value - projection * a[index])
    const tangentLength = Math.hypot(...tangent)
    return a.map((value, index) => value * Math.cos(Math.PI * t) + tangent[index] / tangentLength * Math.sin(Math.PI * t)) as unknown as CartesianPoint
  }
  const angle = Math.acos(dot), sine = Math.sin(angle)
  return a.map((value, index) => (value * Math.sin((1 - t) * angle) + b[index] * Math.sin(t * angle)) / sine) as unknown as CartesianPoint
}
