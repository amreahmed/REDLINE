/// <reference types="node" />
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import sourceManifest from '../../../public/data/jezero-terrain-grid.json'
import { calculateGrade, calculateTerrainCost, marsSurfaceDistance } from '../terrain/terrainMath'
import type { MarsCoordinate } from '../mission/types'
import { decodeTerrainGrid, getGridCell, parseTerrainGridManifest } from '../terrain/terrainGrid'
import { calculateDistanceRoutes, findShortestDistancePath } from './distanceRoutes'
import type { DistanceGraph } from './distanceRoutes'

// All weighted grids, planes, datum corrections and obstacles below are synthetic
// mathematical test fixtures. They are never loaded by the application.
type Edge = { node: number; costM: number }
type Fixture = { name: string; rows: number; columns: number; heights: readonly (number | null)[]; blocked: readonly number[] }
const coordinate = (lon: number, lat: number): MarsCoordinate => ({ lon, lat, latitudeConvention: 'planetocentric', longitudeDirection: 'east-positive', longitudeDomain: '-180-180' })
const binary = Uint8Array.from(readFileSync(new URL('../../../public/data/jezero-terrain-grid.f32', import.meta.url))).buffer
const grid = decodeTerrainGrid(parseTerrainGridManifest(sourceManifest), binary)
const report: Record<string, unknown> = {
  scope: 'mathematical audit only; synthetic costs are not Mars measurements',
  sourceGridSha256: createHash('sha256').update(new Uint8Array(binary)).digest('hex'),
  sourceCells: grid.values.length,
  syntheticWeightedComparisons: [] as unknown[],
  costSensitivity: [] as unknown[],
}

function weightedFixture(fixture: Fixture, weight: number) {
  const unavailable = new Set(fixture.blocked)
  fixture.heights.forEach((height, node) => { if (height === null || !Number.isFinite(height)) unavailable.add(node) })
  const edges: Edge[][] = Array.from({ length: fixture.heights.length }, () => [])
  const expectedEdges: Edge[][] = Array.from({ length: fixture.heights.length }, () => [])
  for (let from = 0; from < fixture.heights.length; from++) {
    if (unavailable.has(from)) continue
    const fromRow = Math.floor(from / fixture.columns)
    const fromColumn = from % fixture.columns
    for (let to = 0; to < fixture.heights.length; to++) {
      const toRow = Math.floor(to / fixture.columns)
      const toColumn = to % fixture.columns
      const dr = Math.abs(toRow - fromRow)
      const dc = Math.abs(toColumn - fromColumn)
      if (to === from || unavailable.has(to) || dr > 1 || dc > 1) continue
      if (dr && dc && (unavailable.has(fromRow * fixture.columns + toColumn) || unavailable.has(toRow * fixture.columns + fromColumn))) continue
      const run = 20 * Math.hypot(dr, dc)
      const rise = fixture.heights[to]! - fixture.heights[from]!
      const cost = calculateTerrainCost(run, rise / run, weight)
      if (cost.status !== 'available') throw new Error(cost.reason)
      edges[from].push({ node: to, costM: cost.value.totalCostM })
      // Closed-form oracle uses d + w*(rise^2/d), separately from the
      // implementation's balanced product of four factors.
      expectedEdges[from].push({ node: to, costM: run + weight * rise * rise / run })
    }
  }
  const graph: DistanceGraph = {
    nodeCount: fixture.heights.length,
    neighbors: node => edges[node],
    heuristicM: (node, goal) => 20 * Math.hypot(Math.floor(node / fixture.columns) - Math.floor(goal / fixture.columns), node % fixture.columns - goal % fixture.columns) * (1 - 1e-9),
  }
  return { graph, edges, expectedEdges, unavailable }
}

/** Independent linear-scan Dijkstra: no A* heap, heuristic or predecessor code. */
function oracleDistance(edges: readonly (readonly Edge[])[], from: number, to: number): number {
  const unsettled = new Set(edges.map((_, node) => node))
  const distances = edges.map(() => Infinity)
  distances[from] = 0
  while (unsettled.size) {
    let current = -1
    for (const node of unsettled) if (current === -1 || distances[node] < distances[current]) current = node
    if (current === -1 || !Number.isFinite(distances[current])) break
    if (current === to) return distances[current]
    unsettled.delete(current)
    for (const edge of edges[current]) distances[edge.node] = Math.min(distances[edge.node], distances[current] + edge.costM)
  }
  return Infinity
}

const fixtures: Fixture[] = [
  { name: 'open-flat', rows: 3, columns: 4, heights: Array(12).fill(0), blocked: [] },
  { name: 'obstacle-detour', rows: 4, columns: 4, heights: Array.from({ length: 16 }, (_, node) => node % 4), blocked: [5, 6] },
  { name: 'NoData-gaps', rows: 4, columns: 4, heights: Array.from({ length: 16 }, (_, node) => [5, 10].includes(node) ? null : (node % 4) * 2), blocked: [] },
  { name: 'disconnected-halves', rows: 3, columns: 5, heights: Array(15).fill(0), blocked: [2, 7, 12] },
  { name: 'analytical-plane', rows: 3, columns: 4, heights: Array.from({ length: 12 }, (_, node) => (node % 4) * 5 - Math.floor(node / 4) * 10), blocked: [] },
]

describe('existing A* against independent weighted synthetic-grid oracles', () => {
  it.each(fixtures)('solves every valid endpoint pair in $name for five nonnegative weights', fixture => {
    let comparisons = 0
    let disconnected = 0
    for (const weight of [0, 0.25, 1, 4, 16]) {
      const { graph, expectedEdges, unavailable } = weightedFixture(fixture, weight)
      for (let from = 0; from < graph.nodeCount; from++) for (let to = 0; to < graph.nodeCount; to++) {
        if (unavailable.has(from) || unavailable.has(to)) continue
        const expected = oracleDistance(expectedEdges, from, to)
        const result = findShortestDistancePath(graph, from, to)
        comparisons++
        if (!Number.isFinite(expected)) {
          expect(result.status).toBe('unavailable')
          disconnected++
          continue
        }
        if (result.status !== 'available') throw new Error(result.reason)
        expect(Math.abs(result.value.distanceM - expected)).toBeLessThan(1e-9)
        expect(result.value.nodes[0]).toBe(from)
        expect(result.value.nodes.at(-1)).toBe(to)
        let independentlyReconstructed = 0
        for (let index = 1; index < result.value.nodes.length; index++) {
          const edge = expectedEdges[result.value.nodes[index - 1]].find(edge => edge.node === result.value.nodes[index])
          expect(edge).toBeDefined()
          independentlyReconstructed += edge!.costM
        }
        expect(Math.abs(independentlyReconstructed - result.value.distanceM)).toBeLessThan(1e-9)
      }
    }
    ;(report.syntheticWeightedComparisons as unknown[]).push({ fixture: fixture.name, rows: fixture.rows, columns: fixture.columns, weights: [0, 0.25, 1, 4, 16], endpointPairs: comparisons, disconnectedPairs: disconnected })
  })

  it('retains a deterministic optimal choice between equal-cost alternatives', () => {
    const { graph } = weightedFixture(fixtures[0], 0)
    const first = findShortestDistancePath(graph, 0, 6)
    expect(first.status).toBe('available')
    if (first.status !== 'available') throw new Error(first.reason)
    expect(first.value.distanceM).toBeCloseTo(20 * (1 + Math.SQRT2), 12)
    for (let iteration = 0; iteration < 20; iteration++) expect(findShortestDistancePath(graph, 0, 6)).toEqual(first)
  })

  it('distinguishes the kernel zero-length path from product duplicate/blocked endpoint rejection', () => {
    const { graph } = weightedFixture(fixtures[0], 4)
    expect(findShortestDistancePath(graph, 0, 0)).toMatchObject({ status: 'available', value: { nodes: [0], distanceM: 0 } })
    const point = { row: 714, column: 650 }
    expect(calculateDistanceRoutes({ grid, origin: point, destination: point, waypoint: null })).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/distinct/) })
    const missingValues = grid.values.slice()
    missingValues[(714 - 586) * 256 + 650 - 522] = grid.manifest.sourceGrid.noData
    expect(calculateDistanceRoutes({ grid: { manifest: grid.manifest, values: missingValues }, origin: point, destination: { row: 714, column: 651 }, waypoint: null })).toMatchObject({ status: 'unavailable', reason: expect.stringMatching(/Origin.*NoData/) })
  })

  it('solves a directed nonnegative graph without assuming reverse-edge costs are equal', () => {
    const edges: Edge[][] = [[{ node: 1, costM: 9 }, { node: 2, costM: 1 }], [{ node: 0, costM: 2 }, { node: 2, costM: 3 }], [{ node: 0, costM: 5 }, { node: 1, costM: 1 }]]
    const graph: DistanceGraph = { nodeCount: 3, neighbors: node => edges[node], heuristicM: () => 0 }
    for (let from = 0; from < 3; from++) for (let to = 0; to < 3; to++) {
      const result = findShortestDistancePath(graph, from, to)
      expect(result.status).toBe('available')
      if (result.status !== 'available') throw new Error(result.reason)
      expect(result.value.distanceM).toBe(oracleDistance(edges, from, to))
    }
  })

  it('shows why an arbitrary discounted cost cannot inherit the geometric heuristic', () => {
    // A deliberately invalid heuristic in a synthetic graph: the node-2 lower
    // bound exceeds its true remaining cost 1. This is a caller-contract test,
    // not an application defect; native and squared-grade costs are not discounted.
    const edges: Edge[][] = [[{ node: 1, costM: 3 }, { node: 2, costM: 1 }], [], [{ node: 1, costM: 1 }]]
    const graph: DistanceGraph = { nodeCount: 3, neighbors: node => edges[node], heuristicM: node => node === 2 ? 10 : 0 }
    const result = findShortestDistancePath(graph, 0, 1)
    expect(result).toMatchObject({ status: 'available', value: { distanceM: 3 } })
    expect(oracleDistance(edges, 0, 1)).toBe(2)
    report.invalidHeuristicCounterexample = { kind: 'synthetic caller-contract violation', returnedCost: 3, actualOptimum: 2, node2Heuristic: 10, trueRemaining: 1 }
  })
})

describe('documented squared-grade model sensitivity, synthetic only', () => {
  it('changes the route preference at the independently derived hill-detour threshold', () => {
    const hill: Fixture = { name: 'one-cell-20m-hill', rows: 3, columns: 5, heights: Array.from({ length: 15 }, (_, node) => node === 7 ? 20 : 0), blocked: [] }
    const threshold = Math.SQRT2 - 1
    const flatDetourM = 40 + 40 * Math.SQRT2
    for (const weight of [0, 0.25, 0.5, 1, 4, 16]) {
      const { graph, expectedEdges } = weightedFixture(hill, weight)
      const result = findShortestDistancePath(graph, 5, 9)
      if (result.status !== 'available') throw new Error(result.reason)
      const directCost = 80 + 40 * weight
      expect(result.value.distanceM).toBeCloseTo(Math.min(directCost, flatDetourM), 10)
      expect(result.value.distanceM).toBeCloseTo(oracleDistance(expectedEdges, 5, 9), 10)
      expect(result.value.nodes.includes(7)).toBe(weight < threshold)
      ;(report.costSensitivity as unknown[]).push({ fixture: hill.name, weight, minimumCostEquivalentM: result.value.distanceM, nodes: result.value.nodes, visitsHill: result.value.nodes.includes(7), directCostEquivalentM: directCost, flatDetourCostEquivalentM: flatDetourM, threshold })
    }
  })

  it('checks analytical plane directions, constant-offset invariance and a varying-datum counterexample', () => {
    const a = 0.25
    const b = -0.5
    const shifts = [0, 1024, 3396190]
    const directions = [[20, 0], [0, 20], [20, 20], [-20, -20]]
    const receipts = []
    for (const [dx, dy] of directions) {
      const runM = Math.hypot(dx, dy)
      const expectedRatio = (a * dx + b * dy) / runM
      for (const shift of shifts) {
        const riseM = (a * dx + b * dy + shift) - shift
        const grade = calculateGrade(riseM, runM)
        if (grade.status !== 'available') throw new Error(grade.reason)
        expect(grade.value.ratio).toBeCloseTo(expectedRatio, 14)
        const cost = calculateTerrainCost(runM, grade.value.ratio, 4)
        if (cost.status !== 'available') throw new Error(cost.reason)
        expect(cost.value.totalCostM).toBeCloseTo(runM + 4 * riseM * riseM / runM, 12)
        receipts.push({ dx, dy, shift, runM, riseM, ratio: grade.value.ratio, degrees: grade.value.signedDegrees, costEquivalentM: cost.value.totalCostM })
      }
    }
    const original = calculateGrade(5, 20)
    const varyingDatum = calculateGrade(5 + 0.02 * 20, 20)
    if (original.status !== 'available' || varyingDatum.status !== 'available') throw new Error('Synthetic datum comparison failed')
    expect(original.value.ratio).toBe(0.25)
    expect(varyingDatum.value.ratio).toBe(0.27)
    expect(varyingDatum.value.signedDegrees).not.toBe(original.value.signedDegrees)
    report.syntheticPlane = { a, b, shifts, directions: receipts, varyingCorrection: { formula: 'N(x,y)=0.02*x', originalRatio: original.value.ratio, correctedRatio: varyingDatum.value.ratio }, qualification: 'No correction applied to any Mars sample; invariance assumes common exactly represented offsets, not arbitrary float32 requantization.' }
  })
})

describe('native-distance heuristic numerical audit, heights excluded', () => {
  it('checks consistency over every directed adjacent edge for five goals in the preserved crop', () => {
    const points = Array.from({ length: 65536 }, (_, node) => {
      const cell = getGridCell(grid, 586 + Math.floor(node / 256), 522 + node % 256)
      if (cell.status !== 'valid') throw new Error(cell.reason)
      return coordinate(cell.cell.lon, cell.cell.lat)
    })
    const goals = [0, 255, 65535, 65280, (714 - 586) * 256 + 650 - 522]
    let edgesChecked = 0
    let minimumSlackM = Infinity
    for (const goal of goals) {
      const heuristic = points.map(point => {
        const distance = marsSurfaceDistance(point, points[goal])
        if (distance.status !== 'available') throw new Error(distance.reason)
        return distance.value * (1 - 1e-9)
      })
      expect(heuristic[goal]).toBe(0)
      for (let node = 0; node < points.length; node++) {
        const row = Math.floor(node / 256)
        const column = node % 256
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          const nextRow = row + dr
          const nextColumn = column + dc
          if (nextRow >= 256 || nextColumn < 0 || nextColumn >= 256) continue
          const next = nextRow * 256 + nextColumn
          const edge = marsSurfaceDistance(points[node], points[next])
          if (edge.status !== 'available') throw new Error(edge.reason)
          const slackForward = edge.value + heuristic[next] - heuristic[node]
          const slackReverse = edge.value + heuristic[node] - heuristic[next]
          minimumSlackM = Math.min(minimumSlackM, slackForward, slackReverse)
          if (slackForward < 0 || slackReverse < 0) throw new Error(`Inconsistent sphere heuristic at goal ${goal}, edge ${node}/${next}: ${slackForward},${slackReverse}`)
          edgesChecked += 2
        }
      }
    }
    expect(minimumSlackM).toBeGreaterThanOrEqual(0)
    report.nativeHeuristic = { goals: goals.map(node => ({ row: 586 + Math.floor(node / 256), column: 522 + node % 256 })), directedEdgeGoalChecks: edgesChecked, minimumSlackM, multiplier: 1 - 1e-9, exactMath: 'Metric triangle inequality gives h(u)<=alpha*d(u,v)+h(v)<=d(u,v)+h(v) for alpha<=1; nonnegative squared-grade penalties preserve this bound.' }
  })
})

afterAll(() => {
  if (process.env.REDLINE_WRITE_ROUTING_AUDIT !== '1') return
  const directory = fileURLToPath(new URL('../../../docs/evidence/science-routing-audit/algorithm-cost/', import.meta.url))
  mkdirSync(directory, { recursive: true })
  writeFileSync(`${directory}/algorithm-cost-results.json`, `${JSON.stringify(report, null, 2)}\n`)
})
