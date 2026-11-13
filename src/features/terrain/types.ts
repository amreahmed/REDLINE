import type { TargetId } from '../mission/types'

export type TerrainWindow = {
  readonly id: TargetId
  readonly center: readonly [number, number]
  readonly halfWidthDeg: 0.005
  readonly startColumn: number
  readonly startRow: number
  readonly columns: number
  readonly rows: number
  /** Native row-major float32 samples; null preserves a missing source cell. */
  readonly values: readonly (number | null)[]
}

export type TerrainWindows = {
  readonly schemaVersion: 1
  readonly source: {
    readonly productId: string
    readonly sha256: string
    readonly url: string
    readonly units: 'm'
    readonly heightReference: 'provider-declared-iau-sphere-unvalidated'
  }
  readonly projection: {
    readonly kind: 'equirectangular'
    readonly radiusM: 3396190
    readonly standardParallelDeg: 0
    readonly centralMeridianDeg: 0
    readonly latitudeConvention: 'planetocentric'
    readonly longitudeDirection: 'east-positive'
  }
  readonly grid: {
    readonly columns: 1596
    readonly rows: 1512
    readonly originX: 4573663.250853
    readonly originY: 1109693.140188
    readonly pixelSizeM: 20
    readonly noData: number
  }
  readonly windows: readonly TerrainWindow[]
}

export type TerrainSample = {
  status: 'valid'
  elevationM: number
  row: number
  column: number
  sourceId: string
} | {
  status: 'nodata' | 'outside' | 'invalid'
  reason: string
}

export type TerrainWindowSummary = {
  validCount: number
  missingCount: number
  min: number | null
  max: number | null
}
