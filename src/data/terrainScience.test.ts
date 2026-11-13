/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import sourceManifest from '../../public/data/jezero-terrain-grid.json'
import registration from '../../docs/evidence/scientific-validation/feature-registration/registration-checks.json'
import heightComparison from '../../docs/evidence/scientific-validation/height-reference/mola-reference-comparison.json'
import { parseTerrainGridManifest, decodeTerrainGrid } from '../features/terrain/terrainGrid'
import { SCIENCE_TARGETS } from './scienceTargets'
import { TERRAIN_SCIENTIFIC_REVIEW, terrainHeightDifferenceBlocker } from './terrainScience'

const binary = Uint8Array.from(readFileSync(new URL('../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
const grid = decodeTerrainGrid(parseTerrainGridManifest(sourceManifest), binary)

describe('scientific findings and fail-closed height authorization', () => {
  it('preserves source data and separates geometric verification from landmark registration', () => {
    expect(TERRAIN_SCIENTIFIC_REVIEW.geometry.status).toBe('verified')
    expect(TERRAIN_SCIENTIFIC_REVIEW.featureRegistration.status).toBe('unresolved')
    for (const record of registration.records) {
      const target = SCIENCE_TARGETS.find((item) => item.id === record.id)
      expect(target?.coordinate).toMatchObject({ lon: record.coordinate[0], lat: record.coordinate[1], latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive' })
      expect(target?.controlNetwork).toBe(record.controlNetwork.name)
      expect(record.empiricalRegistration).toMatch(/unavailable/)
    }
    expect(grid.values).toHaveLength(65536)
    expect(grid.manifest.source.heightReference).toBe('provider-declared-iau-sphere-unvalidated')
  })

  it('retains the independent datum conflict without inferring a conversion', () => {
    expect(heightComparison.sourceSha256).toBe(TERRAIN_SCIENTIFIC_REVIEW.sourceHash)
    expect(heightComparison.probes).toHaveLength(9)
    expect(heightComparison.probes.every((probe) => probe.ctxMinusMolaRadiusAboveIAUSphereM > 1500)).toBe(true)
    expect(heightComparison.purpose).toMatch(/not fine registration.*validated datum conversion/)
    expect(TERRAIN_SCIENTIFIC_REVIEW.heightReference.status).toBe('unresolved')
    expect(TERRAIN_SCIENTIFIC_REVIEW.heightDifferences.status).toBe('unresolved')
    expect(terrainHeightDifferenceBlocker(grid)).toMatch(/conflicted.*spatially varying/)
  })

  it('rejects a different source before considering height eligibility', () => {
    const unknown = { ...grid, manifest: { ...grid.manifest, source: { ...grid.manifest.source, sha256: '0'.repeat(64) } } }
    expect(terrainHeightDifferenceBlocker(unknown)).toMatch(/does not match/)
  })
})
