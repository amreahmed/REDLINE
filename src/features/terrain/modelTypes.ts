/** A native numerical DEM. Model authorization is separate from physical accuracy. */
export type TerrainModelGrid = {
  readonly rows: number
  readonly columns: number
  readonly startRow: number
  readonly startColumn: number
  /** Upper-left edge of the crop in the source's zero-origin equirectangular CRS. */
  readonly originXM: number
  readonly originYM: number
  readonly pixelWidthM: number
  readonly pixelHeightM: number
  readonly referenceRadiusM: number
  readonly values: Float32Array
  readonly valid: Uint8Array
  readonly source: {
    readonly productId: string
    readonly gridHash: string
    readonly sourceHash: string
    readonly verticalReference: string
    readonly attribution: string
    readonly qualification: string
    readonly authorization: 'provider-dem-model' | 'synthetic-test'
  }
}

/** User-selected hypothetical assumptions, not instrument or rover safety ratings. */
export type TerrainProfile = {
  readonly maxUphillDeg: number
  readonly maxDownhillDeg: number
  readonly maxRoughnessM: number
  readonly roughnessRadiusM: number
  readonly highCostFraction: number
  readonly uphillWeight: number
  readonly downhillWeight: number
  readonly slopeWeight: number
  readonly roughnessWeight: number
  readonly unknownPolicy: 'block' | 'penalize'
  readonly unknownCostMultiplier: number
}

export type TerrainClassification = 'UNKNOWN' | 'TRAVERSABLE' | 'HIGH_COST' | 'BLOCKED'

export type TerrainAnalysis = {
  readonly grid: TerrainModelGrid
  readonly profile: TerrainProfile
  /** Sphere-relative DEM gradient angle; not an independently validated gravity slope. */
  readonly slopeDeg: Float32Array
  /** Population standard deviation of heights within the physical circular neighborhood. */
  readonly roughnessM: Float32Array
  readonly reliefM: Float32Array
  /** Center height minus neighborhood mean; a shape indicator, not curvature or a hazard. */
  readonly shapeM: Float32Array
  /** 0 UNKNOWN, 1 TRAVERSABLE, 2 HIGH_COST, 3 BLOCKED. */
  readonly states: Uint8Array
}

export type TerrainMovement = {
  readonly classification: TerrainClassification
  readonly distanceM: number
  readonly riseM: number | null
  readonly gradeDeg: number | null
  /** Hypothetical cost-equivalent metres; null means this movement is excluded. */
  readonly costM: number | null
  readonly reason?: string
}
