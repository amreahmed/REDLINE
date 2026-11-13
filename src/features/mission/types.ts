export type TargetId = 'jezero' | 'belva' | 'neretva'
export type EndpointRole = 'origin' | 'destination'

export type MarsCoordinate = {
  lon: number
  lat: number
  latitudeConvention: 'planetocentric' | 'planetographic'
  longitudeDirection: 'east-positive' | 'west-positive'
  longitudeDomain: '0-360' | '-180-180'
}

export type ScienceTarget = {
  id: TargetId
  name: string
  coordinate: MarsCoordinate
  scientificRationale: string
  coordinateSourceUrl: string
  scienceSourceUrl: string
  missionContext: string
  controlNetwork: string
  coordinateAttribution: string
  scienceAttribution: string
  limitations: readonly string[]
}

export type MissionSelection = {
  origin: TargetId | null
  destination: TargetId | null
}
