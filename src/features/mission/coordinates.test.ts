import { describe, expect, it } from 'vitest'
import sourceRecords from '../../../docs/evidence/phase-3-targets/target-records.json'
import { SCIENCE_TARGETS, targetById } from '../../data/scienceTargets'
import { toDisplayCoordinate } from './coordinates'
import type { MarsCoordinate } from './types'

const coordinate: MarsCoordinate = {
  lon: 77.69,
  lat: 18.41,
  latitudeConvention: 'planetocentric',
  longitudeDirection: 'east-positive',
  longitudeDomain: '0-360',
}

describe('Mars feature display coordinates', () => {
  it('keeps the verified Jezero reference unchanged and returns longitude first', () => {
    expect(toDisplayCoordinate(coordinate)).toEqual([77.69, 18.41])
  })

  it.each([
    { lon: 0, expected: 0 },
    { lon: 180, expected: -180 },
    { lon: 359, expected: -1 },
    { lon: 360, expected: 0 },
  ])('normalizes valid 0–360 longitude $lon to $expected', ({ lon, expected }) => {
    expect(toDisplayCoordinate({ ...coordinate, lon })).toEqual([expected, 18.41])
  })

  it.each([-180, -1, 0, 180])('retains longitude %s already in the signed display domain', (lon) => {
    expect(toDisplayCoordinate({ ...coordinate, longitudeDomain: '-180-180', lon })).toEqual([lon, 18.41])
  })

  it.each([-90, 90])('accepts latitude boundary %s without a physical-unit conversion', (lat) => {
    expect(toDisplayCoordinate({ ...coordinate, lat })).toEqual([77.69, lat])
  })

  it.each([
    { lon: -0.01 },
    { lon: 360.01 },
    { lon: Number.NaN },
    { lon: Number.POSITIVE_INFINITY },
    { lat: -90.01 },
    { lat: 90.01 },
    { lat: Number.NaN },
    { lat: Number.NEGATIVE_INFINITY },
  ])('rejects non-finite or out-of-range values %j', (invalid) => {
    expect(toDisplayCoordinate({ ...coordinate, ...invalid })).toBeNull()
  })

  it.each([-180.01, 180.01, 359])('rejects longitude %s outside its declared signed domain', (lon) => {
    expect(toDisplayCoordinate({ ...coordinate, longitudeDomain: '-180-180', lon })).toBeNull()
  })

  it('rejects planetographic latitude instead of assuming it matches the map', () => {
    expect(toDisplayCoordinate({ ...coordinate, latitudeConvention: 'planetographic' })).toBeNull()
  })

  it('rejects west-positive longitude instead of silently reflecting it', () => {
    expect(toDisplayCoordinate({ ...coordinate, longitudeDirection: 'west-positive' })).toBeNull()
  })

  it.each([
    null,
    undefined,
    {},
    { ...coordinate, lon: '77.69' },
    { ...coordinate, lat: '18.41' },
    { ...coordinate, longitudeDomain: 'EPSG:4326' },
    { ...coordinate, latitudeConvention: undefined },
    { ...coordinate, longitudeDirection: undefined },
    { lon: 77.69, lat: 18.41 },
  ])('rejects a malformed runtime coordinate contract %j', (invalid) => {
    // Deliberately exercise untrusted runtime input beyond the static TypeScript contract.
    expect(toDisplayCoordinate(invalid as unknown as MarsCoordinate)).toBeNull()
  })

  it('does not mutate a coordinate while normalizing its longitude', () => {
    const source = Object.freeze({ ...coordinate, lon: 359 })
    expect(toDisplayCoordinate(source)).toEqual([-1, 18.41])
    expect(source.lon).toBe(359)
  })
})

describe('verified local feature references', () => {
  it('retains the three directly verified source centers and their two-decimal precision', () => {
    expect(SCIENCE_TARGETS.map((target) => [target.id, target.coordinate.lon.toFixed(2), target.coordinate.lat.toFixed(2)])).toEqual([
      ['jezero', '77.69', '18.41'],
      ['belva', '77.38', '18.48'],
      ['neretva', '77.20', '18.55'],
    ])
    for (const target of SCIENCE_TARGETS) {
      const source = sourceRecords.find((record) => record.id === target.id)
      expect(source).toBeDefined()
      expect(toDisplayCoordinate(target.coordinate)).toEqual([source!.coordinate.lon, source!.coordinate.lat])
      expect(target.controlNetwork).toBe(source!.controlNetwork)
      expect(target.coordinateSourceUrl).toBe(source!.coordinateSourceUrl)
      expect(target.scienceSourceUrl).toBe(source!.scienceSourceUrl)
      expect(target.limitations).toContain('MDIM 2.1 feature geometry is not independently registered to the preliminary CTX mosaic.')
    }
  })

  it('finds only supported references and supplies no fallback for unknown or cleared IDs', () => {
    expect(targetById('belva')?.name).toBe('Belva crater')
    expect(targetById('unknown')).toBeUndefined()
    expect(targetById(null)).toBeUndefined()
  })
})
