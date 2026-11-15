/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import manifestText from '../../../public/data/hrsc-terrain-model.json?raw'
import { decodeHrscModel, HRSC_MODEL_SOURCE_HASH, parseHrscModelManifest } from './hrscModel'

const samples = Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.i16', import.meta.url)))
const validity = Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.u8', import.meta.url)))
const document = () => JSON.parse(manifestText) as Record<string, unknown>
const manifest = () => parseHrscModelManifest(document())

describe('separate native HRSC model source contract', () => {
  it('retains every original signed native height and validity cell, without CTX resampling', () => {
    const original = Uint8Array.from(readFileSync(new URL('../../../docs/evidence/scientific-gate-resolution/hrsc/hrsc-dt5-native.i16', import.meta.url)))
    const originalValidity = Uint8Array.from(readFileSync(new URL('../../../docs/evidence/scientific-gate-resolution/hrsc/hrsc-dt5-validity.u8', import.meta.url)))
    expect(samples).toEqual(original)
    expect(validity).toEqual(originalValidity)
    const grid = decodeHrscModel(manifest(), samples.buffer, validity.buffer)
    expect(grid.values).toHaveLength(10609)
    expect(grid.valid).toEqual(originalValidity)
    const raw = new DataView(original.buffer)
    for (let index = 0; index < 10609; index += 1) expect(grid.values[index]).toBe(raw.getInt16(index * 2, true))
    expect(grid.values[51 * 103 + 51]).toBe(-3921)
    expect(grid).toMatchObject({ rows: 103, columns: 103, startRow: 13605, startColumn: 11661,
      originXM: 4583825, originYM: 1097925.0000000002, pixelWidthM: 50, pixelHeightM: -50, referenceRadiusM: 3396000 })
    expect(grid.source).toMatchObject({ productId: 'HMC_13E10_DT5', sourceHash: HRSC_MODEL_SOURCE_HASH, authorization: 'provider-dem-model' })
    expect(grid.source.qualification).toContain('Physical slope accuracy')
    expect(grid.source.qualification).toContain('remain unverified')
    expect(grid.source.attribution).toContain('ESA/DLR/FU Berlin')
    expect(manifest().source.fullResourceSha256).toBeNull()
    expect(manifest().source.sourceHashDefinition).toContain('not a full-TIFF checksum')
  })

  it.each([
    ['source', 'productId', 'JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0'],
    ['source', 'sourceHash', '0'.repeat(64)],
    ['source', 'verticalReference', 'Verified physical altitude'],
    ['source', 'authorization', 'verified-physical-terrain'],
    ['source', 'qualification', 'Fully scientifically verified'],
    ['projection', 'radiusM', 3396190],
    ['projection', 'latitudeConvention', 'planetographic-ellipsoid'],
    ['grid', 'originXM', 4583875],
    ['grid', 'rows', 256],
    ['encoding', 'scale', 10],
    ['encoding', 'sha256', '0'.repeat(64)],
    ['validity', 'noDataValue', 1],
  ])('rejects an unknown or relabelled %s.%s', (section, key, replacement) => {
    const changed = document()
    const part = changed[section] as Record<string, unknown>
    part[key] = replacement
    expect(() => parseHrscModelManifest(changed)).toThrow(/native HRSC contract/)
  })

  it('rejects malformed and extra claims rather than importing untrusted status text', () => {
    for (const value of [null, [], 1, { ...document(), physicalSlopeVerified: true }]) expect(() => parseHrscModelManifest(value)).toThrow(/native HRSC contract/)
    const changed = document()
    const part = changed.source as Record<string, unknown>
    part.safetyProbability = 1
    expect(() => parseHrscModelManifest(changed)).toThrow(/native HRSC contract/)
  })

  it('rejects truncated or oversized arrays before reading cells', () => {
    for (const size of [21216, 21220]) expect(() => decodeHrscModel(manifest(), new ArrayBuffer(size), validity.buffer)).toThrow(/byte size/)
    for (const size of [10608, 10610]) expect(() => decodeHrscModel(manifest(), samples.buffer, new ArrayBuffer(size))).toThrow(/byte size/)
  })

  it('rejects malformed masks and never turns missing heights into flat terrain', () => {
    const badMask = validity.slice()
    badMask[0] = 2
    expect(() => decodeHrscModel(manifest(), samples.buffer, badMask.buffer)).toThrow(/mask/)
    badMask[0] = 0
    expect(() => decodeHrscModel(manifest(), samples.buffer, badMask.buffer)).toThrow(/mask/)
    const missing = samples.slice()
    new DataView(missing.buffer).setInt16(0, -32768, true)
    expect(() => decodeHrscModel(manifest(), missing.buffer, validity.buffer)).toThrow(/mask/)
    expect(() => decodeHrscModel(manifest(), missing.buffer, badMask.buffer)).toThrow(/summary/)
  })

  it('revalidates the manifest before decoding and checks the pinned summary', () => {
    const changedManifest = structuredClone(manifest())
    Object.assign(changedManifest.grid, { pixelHeightM: 50 })
    expect(() => decodeHrscModel(changedManifest, samples.buffer, validity.buffer)).toThrow(/native HRSC contract/)
    const altered = samples.slice()
    new DataView(altered.buffer).setInt16(0, 0, true)
    expect(() => decodeHrscModel(manifest(), altered.buffer, validity.buffer)).toThrow(/summary/)
  })
})
