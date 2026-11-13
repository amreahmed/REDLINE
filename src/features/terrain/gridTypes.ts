export type GridCorner = {
  readonly name: 'north-west' | 'north-east' | 'south-east' | 'south-west'
  readonly sourceRowEdge: number
  readonly sourceColumnEdge: number
  readonly projectedM: readonly [number, number]
  readonly coordinate: readonly [number, number]
}

export type GridFixture = {
  readonly row: number
  readonly column: number
  readonly pixelCenterM: readonly [number, number]
  readonly coordinate: readonly [number, number]
  readonly elevationM: number | null
}

export type TerrainGridManifest = {
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
    readonly longitudeRange: 'signed-180'
  }
  readonly sourceGrid: {
    readonly columns: 1596
    readonly rows: 1512
    readonly originX: 4573663.250853
    readonly originY: 1109693.140188
    readonly pixelSizeM: 20
    readonly noData: number
  }
  readonly grid: {
    readonly startColumn: 522
    readonly startRow: 586
    readonly columns: 256
    readonly rows: 256
  }
  readonly encoding: {
    readonly url: '/data/jezero-terrain-grid.f32'
    readonly sampleType: 'float32'
    readonly byteOrder: 'little-endian'
    readonly layout: 'row-major'
    readonly bytes: 262144
    readonly sha256: string
  }
  readonly processing: string
  readonly boundaryPolicy: string
  readonly summary: {
    readonly validCount: number
    readonly missingCount: number
    readonly minM: number | null
    readonly maxM: number | null
  }
  readonly outerCorners: readonly GridCorner[]
  readonly fixtures: readonly GridFixture[]
}

export type TerrainGrid = {
  readonly manifest: TerrainGridManifest
  /** Native little-endian float32 samples decoded into host values, row-major. */
  readonly values: Float32Array
}

export type GridCell = {
  /** Global source-grid indices, not local crop offsets. */
  readonly row: number
  readonly column: number
  /** Exact native-cell center in signed east-positive planetocentric degrees. */
  readonly lon: number
  readonly lat: number
  /** Provider-declared Mars IAU sphere heights; vertical reference unvalidated. */
  readonly elevationM: number
  readonly sourceId: string
}

export type GridCellResult = {
  readonly status: 'valid'
  readonly cell: GridCell
} | {
  readonly status: 'missing' | 'outside' | 'invalid'
  readonly reason: string
}
