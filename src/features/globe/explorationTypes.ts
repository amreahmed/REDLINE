import type { GlobeLayerId } from '../../data/globeLayers'
import type { MarsPoi } from '../../data/marsPois'
import type { GeographicGlobeView } from './createGeographicMarsGlobe'
import type { GlobeMapImageryStatus } from '../map/globeMapImagery'

export type GlobeMode = 'imagery' | 'model'
export type PoiCategory = 'all' | MarsPoi['category']
export type GlobePreferences = { mode: GlobeMode; layerId: GlobeLayerId; selectedPoiId: string | null; category: PoiCategory }
export type GlobeFlyRequest = { coordinate: readonly [number, number]; sequence: number }
export type GlobeWorkspace = { preferences: GlobePreferences; view: GeographicGlobeView | null; mapImagery?: GlobeMapImageryStatus | null }
