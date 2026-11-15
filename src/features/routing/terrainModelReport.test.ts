/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import nativeManifest from '../../../public/data/hrsc-terrain-model.json'
import { decodeHrscModel, parseHrscModelManifest } from '../terrain/hrscModel'
import type { TerrainAnalysis, TerrainModelGrid } from '../terrain/modelTypes'
import { analyzeTerrainModel, DEFAULT_TERRAIN_PROFILE } from '../terrain/terrainModel'
import { calculateTerrainComparison } from './terrainRoutes'
import type { TerrainComparison } from './terrainRoutes'
import { terrainModelReport } from './terrainModelReport'

const grid = decodeHrscModel(parseHrscModelManifest(nativeManifest),
  Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.i16', import.meta.url))).buffer,
  Uint8Array.from(readFileSync(new URL('../../../public/data/hrsc-terrain-model.u8', import.meta.url))).buffer)
const analysis = analyzeTerrainModel(grid, DEFAULT_TERRAIN_PROFILE)
function routes(input: TerrainAnalysis, from: number, to: number): TerrainComparison {
  const result = calculateTerrainComparison(input, from, to)
  if (result.status !== 'available') throw new Error(result.reason)
  return result.value
}
const comparison = routes(analysis, 30 * 103 + 30, 70 * 103 + 70)

/** Independent haversine using native crop edges, not application distance helpers. */
function baseline(input: TerrainModelGrid, from: number, to: number): number {
  const coordinate = (node: number) => [
    (input.originXM + (node % input.columns + 0.5) * input.pixelWidthM) / input.referenceRadiusM,
    (input.originYM + (Math.floor(node / input.columns) + 0.5) * input.pixelHeightM) / input.referenceRadiusM,
  ]
  const [lonA, latA] = coordinate(from)
  const [lonB, latB] = coordinate(to)
  const haversine = Math.sin((latB - latA) / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin((lonB - lonA) / 2) ** 2
  return 2 * input.referenceRadiusM * Math.asin(Math.sqrt(haversine))
}

describe('qualified DEM mission report', () => {
  it('retains the actual source, grid transform, profile, every path cell and measured model totals', () => {
    const report = terrainModelReport(analysis, comparison)
    expect(report.reportType).toBe('REDLINE qualified HRSC DEM model')
    expect(report.scientificStatus).toBe('physical-terrain-unverified')
    expect(report.source).toEqual(grid.source)
    expect(report.grid).toEqual({ rows: 103, columns: 103, startRow: 13605, startColumn: 11661,
      originXM: 4583825, originYM: 1097925.0000000002, pixelWidthM: 50, pixelHeightM: -50, referenceRadiusM: 3396000 })
    expect(report.profile).toEqual(DEFAULT_TERRAIN_PROFILE)
    expect(report.routes).toEqual(comparison)
    expect(report.routes?.terrain.nodes.length).toBeGreaterThan(2)
    expect(report.source.productId).toBe('HMC_13E10_DT5')
    expect(report.source.gridHash).toBe(nativeManifest.encoding.sha256)
    expect(report.source.sourceHash).toBe(nativeManifest.source.sourceHash)
    expect(report.source.verticalReference).toBe(nativeManifest.source.verticalReference)
    expect(report.source.attribution).toContain('ESA/DLR/FU Berlin')
    expect(report.model.costUnit).toMatch(/hypothetical.*not energy or travel time/)
    const exported = JSON.parse(JSON.stringify(report)) as ReturnType<typeof terrainModelReport>
    expect(exported.routes?.terrain.points).toEqual(comparison.terrain.points)
    expect(exported.routes?.terrain.nodes).toEqual(comparison.terrain.nodes)
    expect(exported.routes?.distance.source).toEqual(grid.source)
    expect(exported.routes?.terrain.accumulatedCostM).toBe(comparison.terrain.accumulatedCostM)
  })

  it('exports full pinned provenance including source-hash scope, URLs, licence, masks and unknown dates', () => {
    const exported = JSON.parse(JSON.stringify(terrainModelReport(analysis, comparison))) as ReturnType<typeof terrainModelReport>
    expect(exported.provenance).toEqual(nativeManifest)
    const provenance = exported.provenance
    if (!('encoding' in provenance)) throw new Error('HRSC provenance was replaced with a synthetic source')
    expect(provenance.source.url).toBe('https://hrscteam.dlr.de/public/data/HMC30/MC13E/HMC_13E10_dt5.tif')
    expect(provenance.source.units).toBe('m')
    expect(provenance.source.sourceHashDefinition).toMatch(/preserved hrsc-native-reference.json.*not a full-TIFF checksum/)
    expect(provenance.source.fullResourceSha256).toBeNull()
    expect(provenance.source.scientificReleaseVersion).toBeNull()
    expect(provenance.source.acquisitionDates).toBeNull()
    expect(provenance.source.licenceUrl).toBe('https://creativecommons.org/licenses/by-sa/3.0/igo/')
    expect(provenance.source.providerTermsUrl).toBe('https://hrscteam.dlr.de/imprint_hrsc_en.php')
    expect(provenance.encoding.noData).toBe(-32768)
    expect(provenance.encoding.sha256).toBe(nativeManifest.encoding.sha256)
    expect(provenance.validity.sha256).toBe(nativeManifest.validity.sha256)
  })

  it('reproduces reported HRSC route costs from the shipped formula text and independent distances', () => {
    const report = terrainModelReport(analysis, comparison)
    expect(report.model.edgeCost).toMatch(/max\(0,\s*gradeDeg\)/)
    expect(report.model.edgeCost).toMatch(/max\(0,\s*-gradeDeg\)/)
    // Evaluating the actual exported expression catches documentation drift,
    // independently of terrainMovement and its implementation of the formula.
    for (const route of [comparison.distance, comparison.terrain]) {
      let totalDistance = 0
      let totalCost = 0
      let gradeTotal = 0
      let maximumGrade = 0
      let roughnessTotal = 0
      let maximumRoughness = 0
      let gradientTotal = 0
      let maximumGradient = 0
      for (const node of route.nodes) {
        roughnessTotal += analysis.roughnessM[node]
        maximumRoughness = Math.max(maximumRoughness, analysis.roughnessM[node])
        gradientTotal += analysis.slopeDeg[node]
        maximumGradient = Math.max(maximumGradient, analysis.slopeDeg[node])
      }
      for (let index = 1; index < route.nodes.length; index++) {
        const from = route.nodes[index - 1]
        const to = route.nodes[index]
        const d = baseline(grid, from, to)
        const gradeDeg = Math.atan2(grid.values[to] - grid.values[from], d) * 180 / Math.PI
        const variables = { d, gradeDeg, ...analysis.profile,
          maxEndpointGradient: Math.max(analysis.slopeDeg[from], analysis.slopeDeg[to]),
          maxEndpointRoughness: Math.max(analysis.roughnessM[from], analysis.roughnessM[to]) }
        const evaluate = new Function(...Object.keys(variables), 'max', `"use strict"; return (${report.model.edgeCost});`)
        totalDistance += d
        totalCost += Number(evaluate(...Object.values(variables), Math.max))
        gradeTotal += Math.abs(gradeDeg)
        maximumGrade = Math.max(maximumGrade, Math.abs(gradeDeg))
      }
      expect(route.horizontalDistanceM).toBeCloseTo(totalDistance, 5)
      expect(route.accumulatedCostM).toBeCloseTo(totalCost, 5)
      expect(route.maxGradeDeg).toBeCloseTo(maximumGrade, 5)
      expect(route.meanAbsGradeDeg).toBeCloseTo(gradeTotal / (route.nodes.length - 1), 5)
      expect(route.meanRoughnessM).toBeCloseTo(roughnessTotal / route.nodes.length, 5)
      expect(route.maxRoughnessM).toBeCloseTo(maximumRoughness, 5)
      expect(route.meanSlopeDeg).toBeCloseTo(gradientTotal / route.nodes.length, 5)
      expect(route.maxSlopeDeg).toBeCloseTo(maximumGradient, 5)
    }
  })

  it('retains unresolved physical/registration/height/support limitations and evidence in JSON export', () => {
    const exported = JSON.parse(JSON.stringify(terrainModelReport(analysis, comparison))) as ReturnType<typeof terrainModelReport>
    expect(exported.limitations).toContain(grid.source.qualification)
    const limitations = exported.limitations.join('\n')
    for (const qualification of [
      /Physical Mars slopes.*remain unverified/, /precise named-feature routing.*unverified/,
      /1 m quantization.*do not establish/, /Step heights, rocks, sand traps and hazards are not detected/,
      /No original per-cell stereo\/support-quality mask/, /not independent ground truth/,
      /CTX final vertical equation/, /spatially varying transformation/, /not empirical imagery\/DEM co-registration/,
      /not obstacles proven avoided/, /scientific release version remain unknown/, /not NASA endorsed/,
    ]) expect(limitations).toMatch(qualification)
    expect(exported.evidence).toContain('docs/evidence/terrain-model/source-authorization.md')
    expect(exported.evidence).toContain('docs/evidence/scientific-gate-resolution/hrsc/hrsc-native-reference.json')
    expect(exported.evidence).toContain('docs/science-routing-audit.md')
    expect(exported.model.slope).toMatch(/sphere-relative.*source-reference-sphere.*degrees/)
    expect(exported.model.roughness).toMatch(/Population standard deviation.*complete circular.*not rock-scale/)
    expect(exported.model.shape).toMatch(/Not curvature or obstacle detection/)
  })

  it('exports loaded terrain with no fabricated route comparison before calculation', () => {
    const report = terrainModelReport(analysis, null)
    expect(report.routes).toBeNull()
    expect(report.source).toEqual(grid.source)
    expect(report.scientificStatus).toBe('physical-terrain-unverified')
    expect(report.limitations).toContain(grid.source.qualification)
  })

  it('keeps explicitly penalized unknown terrain statistics null through JSON serialization', () => {
    const unknownAnalysis = analyzeTerrainModel(grid, { ...DEFAULT_TERRAIN_PROFILE, unknownPolicy: 'penalize', unknownCostMultiplier: 7 })
    const unknownRoutes = routes(unknownAnalysis, 0, 2)
    const exported = JSON.parse(JSON.stringify(terrainModelReport(unknownAnalysis, unknownRoutes))) as ReturnType<typeof terrainModelReport>
    expect(exported.profile.unknownPolicy).toBe('penalize')
    expect(exported.profile.unknownCostMultiplier).toBe(7)
    expect(exported.model.unknownPolicy).toMatch(/Missing\/nonfinite heights always excluded/)
    for (const route of [exported.routes!.distance, exported.routes!.terrain]) {
      expect(route.unknownSegments).toBeGreaterThan(0)
      expect(route.maxGradeDeg).toBeNull()
      expect(route.meanAbsGradeDeg).toBeNull()
      expect(route.maxSlopeDeg).toBeNull()
      expect(route.meanSlopeDeg).toBeNull()
      expect(route.maxRoughnessM).toBeNull()
      expect(route.meanRoughnessM).toBeNull()
      expect(route.accumulatedCostM).toBeCloseTo(route.horizontalDistanceM * 7, 6)
      expect(route.scientificStatus).toBe('physical-terrain-unverified')
    }
  })

  it('retains a synthetic fixture identity instead of labelling it as sourced HRSC data', () => {
    const synthetic: TerrainModelGrid = { rows: 5, columns: 5, startRow: 0, startColumn: 0,
      originXM: -25, originYM: 25, pixelWidthM: 10, pixelHeightM: -10, referenceRadiusM: 3396000,
      values: new Float32Array(25), valid: new Uint8Array(25).fill(1),
      source: { productId: 'synthetic-report-test', sourceHash: 'test', gridHash: 'test',
        verticalReference: 'Synthetic sphere-relative metres', authorization: 'synthetic-test',
        attribution: 'Synthetic fixture', qualification: 'Synthetic, not Mars observations' } }
    const report = terrainModelReport(analyzeTerrainModel(synthetic, { ...DEFAULT_TERRAIN_PROFILE, roughnessRadiusM: 11 }), null)
    expect(report.reportType).toMatch(/synthetic/i)
    expect(report.source.authorization).toBe('synthetic-test')
    expect(report.source.qualification).toContain('Synthetic')
    expect(report.limitations).toContain(synthetic.source.qualification)
    expect(report.scientificStatus).toBe('physical-terrain-unverified')
  })
})
