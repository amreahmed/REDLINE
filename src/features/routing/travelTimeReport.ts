import type { MobilityProfile, TravelTimeResult } from './travelTime'

export type TravelTimeReport = ReturnType<typeof travelTimeReport>

export function travelTimeReport(configuration: { profile: MobilityProfile; departureInput: string; plannedDelayMinutes: number; estimates: { distance: TravelTimeResult; terrain: TravelTimeResult } | null }) {
  return {
    model: 'hypothetical-terrain-eta',
    scientificStatus: 'provisional',
    qualification: 'Provisional hypothetical vehicle ETA from provider DEM model estimates. Not measured rover performance, a real NASA mission prediction, human travel guidance or a safety assessment.',
    mobilityProfile: configuration.profile,
    departureInputUtc: configuration.departureInput || null,
    plannedHoldMinutes: configuration.plannedDelayMinutes,
    estimates: configuration.estimates,
    speedModel: 'v = clamp(nominalSpeedMps / (1 + uphillSensitivity*max(0,gradeDeg)/maxUphillDeg + downhillSensitivity*max(0,-gradeDeg)/maxDownhillDeg + gradientSensitivity*maxEndpointGradient/max(maxUphillDeg,maxDownhillDeg) + roughnessSensitivity*maxEndpointRoughness/maxRoughnessM + highCostPenalty*isHighCost), minSpeedMps, maxSpeedMps)',
    timingModel: 'Each actual adjacent route segment takes horizontal ground distance / modeled speed. Total duration is the sum of segment times plus the explicit user-defined stationary hold. Cost-equivalent metres are never converted to time.',
    scenarioModel: 'For each segment: lower duration uses min(maxSpeedMps, estimatedSpeed*(1+speedUncertaintyFraction)); upper duration uses max(minSpeedMps, estimatedSpeed*(1-speedUncertaintyFraction)). Bounds are user-selected sensitivity scenarios, not statistical confidence intervals or validated physical limits.',
    unknownPolicy: 'Missing heights and blocked movements never yield ETA. The existing terrain policy must explicitly permit incomplete support; such segments use the configured hypothetical unknown speed and retain null unavailable terrain metrics.',
    timeReference: 'Earth UTC timestamp and SI seconds. No Mars local civil time, sol calendar or live mission clock is inferred.',
    delayModel: 'Only the explicitly supplied user-defined stationary hold is applied, once after terrain travel. Default is zero. No automatic stops, charging, maintenance, weather or rest schedule.',
    environmentalDelaySecondsApplied: 0,
    environmentalDelayQualification: 'No environmental delay model is available; zero applied delay is not evidence of absent environmental effects.',
    measuredRoverPerformance: null,
    humanExplorationModel: null,
    limitations: [
      'All presets and vehicle speeds/sensitivities are hypothetical user assumptions; no NASA rover specifications are asserted.',
      'HRSC local physical slope accuracy, terrain uncertainty, precise feature registration and actual traversability remain unverified. ETA is provisional even when all numerical cells are supported.',
      'The existing distance and terrain-cost paths are not optimized for minimum ETA. Faster, shorter or lower cost are distinct objectives.',
      'CTX distance-only routes have no authorized terrain-dependent ETA. No direct-line or constant-speed CTX fallback is supplied.',
      'Step heights, rocks, sand, traction, visibility, weather, thermal and operational limits are not modeled without validated inputs.',
      'The scalar planned hold changes arrival and total duration, not baseline movement speed or segment terrain metrics.',
    ],
  }
}
