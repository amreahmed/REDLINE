import type { MarsCoordinate } from './types'

/**
 * Places qualified feature references on the angular image grid.
 * This validates convention and ranges, not registration or physical accuracy.
 */
export function toDisplayCoordinate(coordinate: MarsCoordinate): [number, number] | null {
  if (!coordinate || typeof coordinate !== 'object') return null
  const { lon, lat, latitudeConvention, longitudeDirection, longitudeDomain } = coordinate
  if (latitudeConvention !== 'planetocentric' || longitudeDirection !== 'east-positive') return null
  if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat) || lat < -90 || lat > 90) return null
  if (longitudeDomain === '0-360') {
    if (lon < 0 || lon > 360) return null
    return [lon >= 180 ? lon - 360 : lon, lat]
  }
  if (longitudeDomain === '-180-180') {
    if (lon < -180 || lon > 180) return null
    return [lon, lat]
  }
  return null
}
