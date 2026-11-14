import type { LayerId } from '../../features/map/types'

/** Presentation copy only; no scientific authorization or calculation uses it. */
export const DISTANCE_ONLY_QUALIFICATION = 'Distance-only hypothetical route. Terrain and human safety are not validated.'

export const LAYER_QUALIFICATIONS: Readonly<Record<LayerId, string>> = {
  mola: 'Rendered shaded-relief imagery, not numerical elevation.',
  ctx: 'Preliminary CTX imagery. Absolute registration is unverified.',
  controlledCtx: 'Controlled CTX imagery. Absolute feature registration is unverified.',
}
