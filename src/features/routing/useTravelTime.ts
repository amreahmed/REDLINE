import { useMemo, useState } from 'react'
import type { TerrainAnalysis } from '../terrain/modelTypes'
import type { TerrainComparison } from './terrainRoutes'
import { estimateRouteTravelTime, MOBILITY_PROFILES, parseDepartureUtc, validateMobilityProfile } from './travelTime'
import type { MobilityProfile } from './travelTime'

/** Postprocesses existing paths. Mobility edits never request a new A* search. */
export function useTravelTime(analysis: TerrainAnalysis | null, comparison: TerrainComparison | null) {
  const [configuration, setConfiguration] = useState({ profile: MOBILITY_PROFILES[0], departureInput: '', plannedDelayMinutes: 0 })
  const departureUtc = useMemo(() => parseDepartureUtc(configuration.departureInput), [configuration.departureInput])
  const estimates = useMemo(() => analysis && comparison ? {
    distance: estimateRouteTravelTime(analysis, comparison.distance, configuration.profile, { departureUtc, plannedDelaySeconds: configuration.plannedDelayMinutes * 60 }),
    terrain: estimateRouteTravelTime(analysis, comparison.terrain, configuration.profile, { departureUtc, plannedDelaySeconds: configuration.plannedDelayMinutes * 60 }),
  } : null, [analysis, comparison, configuration.profile, configuration.plannedDelayMinutes, departureUtc])
  const apply = (profile: MobilityProfile, departureInput: string, plannedDelayMinutes: number) => {
    validateMobilityProfile(profile)
    parseDepartureUtc(departureInput)
    if (!Number.isFinite(plannedDelayMinutes) || plannedDelayMinutes < 0 || plannedDelayMinutes > 10080) throw new Error('Planned hold must be between zero and 10,080 minutes (7 Earth days). It is an explicit mission assumption.')
    setConfiguration({ profile: { ...profile }, departureInput, plannedDelayMinutes })
  }
  return { ...configuration, estimates, apply }
}
