/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { SCIENTIFIC_CONTROL_EVIDENCE } from './scientificEvidence'
import { TERRAIN_SCIENTIFIC_REVIEW } from './terrainScience'

const readEvidence = (file: string) => readFileSync(new URL(`../../docs/evidence/scientific-resolution-2026-11-14/${file}`, import.meta.url), 'utf8')
type Site = { coordinateAccuracy: string; nativeMapping: { insidePreservedCrop: boolean } }
type HeightProbe = { hrscMeanings: { ctxMinusAreoidHeightM: number; ctxMinusHeightAbove3396190SphereM: number } }

describe('qualified independent scientific controls', () => {
  it('binds rover candidate counts to archived controls without claiming empirical registration', () => {
    const controls = JSON.parse(readEvidence('registration/spice-control-candidates.json')) as { sites: Site[]; sourceTiffSha256: string; manifestSha256: string; landing: { nativeMapping: { insidePreservedCrop: boolean } } }
    expect(SCIENTIFIC_CONTROL_EVIDENCE.sourceHash).toBe(controls.sourceTiffSha256)
    expect(SCIENTIFIC_CONTROL_EVIDENCE.registration.totalSiteDefinitions).toBe(controls.sites.length)
    expect(SCIENTIFIC_CONTROL_EVIDENCE.registration.insideCropCandidates).toBe(controls.sites.filter(site => site.nativeMapping.insidePreservedCrop).length)
    expect(controls.sites.every(site => site.coordinateAccuracy === 'no per-site uncertainty supplied')).toBe(true)
    expect(controls.landing.nativeMapping.insidePreservedCrop).toBe(false)
    expect(controls.manifestSha256).toBe(createHash('sha256').update(readFileSync(new URL('../../public/data/jezero-terrain-grid.json', import.meta.url))).digest('hex'))
    expect(TERRAIN_SCIENTIFIC_REVIEW.featureRegistration.status).toBe('unresolved')
  })

  it('reports outward-rounded HRSC differences with a separate reference contract', () => {
    const controls = JSON.parse(readEvidence('height/hrsc-control-comparison.json')) as { probes: HeightProbe[]; hrscHorizontalSphereRadiusM: number; sourceHorizontalSphereRadiusM: number }
    const evidence = SCIENTIFIC_CONTROL_EVIDENCE.height
    expect(evidence.probeCount).toBe(controls.probes.length)
    expect(evidence.referenceSphereRadiusM).toBe(controls.hrscHorizontalSphereRadiusM)
    expect(controls.sourceHorizontalSphereRadiusM).toBe(3396190)
    for (const [key, range] of [['ctxMinusAreoidHeightM', evidence.ctxMinusAreoidM], ['ctxMinusHeightAbove3396190SphereM', evidence.ctxMinusAppSphereM]] as const) {
      const values = controls.probes.map(probe => probe.hrscMeanings[key])
      expect(range).toEqual([Math.floor(Math.min(...values)), Math.ceil(Math.max(...values))])
    }
    expect(TERRAIN_SCIENTIFIC_REVIEW.heightReference.status).toBe('unresolved')
    expect(TERRAIN_SCIENTIFIC_REVIEW.heightDifferences.status).toBe('unresolved')
  })

  it('links to actually retrieved authoritative source documents', () => {
    const receipts = JSON.parse(readEvidence('registration/http-receipts.json')) as { requestedUrl: string; status: number }[]
    expect(receipts.some(receipt => receipt.requestedUrl === SCIENTIFIC_CONTROL_EVIDENCE.registration.sourceUrl && receipt.status === 200)).toBe(true)
    const heightReceipts = JSON.parse(readEvidence('height/http-receipts.json')) as { requestedUrl: string; status: number }[]
    expect(heightReceipts.some(receipt => receipt.requestedUrl === SCIENTIFIC_CONTROL_EVIDENCE.height.sourceUrl && receipt.status === 200)).toBe(true)
    expect(SCIENTIFIC_CONTROL_EVIDENCE.sourceHash).toBe(TERRAIN_SCIENTIFIC_REVIEW.sourceHash)
  })
})
