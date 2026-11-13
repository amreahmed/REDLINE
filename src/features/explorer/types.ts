import type { GlobeStatus } from '../globe/createMarsGlobe'
import type { ExplorerPhase } from './transition'

export type ExplorerSummary = { phase: ExplorerPhase; mapShown: boolean; localDetail: boolean; controlledImageryReady: boolean; globe: GlobeStatus }
export const initialExplorerSummary: ExplorerSummary = { phase: 'overview', mapShown: false, localDetail: false, controlledImageryReady: false, globe: { phase: 'loading', message: 'Starting NASA overview…' } }
