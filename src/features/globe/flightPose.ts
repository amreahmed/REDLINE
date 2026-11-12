/** Spherical camera coordinates in arbitrary graphics units, never Mars coordinates. */
export type GlobeOrbitPose = { azimuth: number; polar: number; radius: number }

const progress = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
const ease = (value: number) => { const t = progress(value); return t * t * t * (t * (t * 6 - 15) + 10) }

export function overviewDistanceForAspect(aspect: number) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  return Math.min(7, Math.max(3.8, 1.35 / Math.sin(Math.atan(Math.tan(20 * Math.PI / 180) * Math.min(safeAspect, 1)))))
}

/** Restore full-globe framing from a close view without changing the captured direction. */
export function sampleOverviewPose(start: GlobeOrbitPose, overviewRadius: number, value: number): GlobeOrbitPose {
  const t = progress(value)
  if (t === 0) return { ...start }
  const amount = ease(t)
  return { ...start, radius: t === 1 ? overviewRadius : Math.exp(Math.log(start.radius) * (1 - amount) + Math.log(overviewRadius) * amount) }
}

/** A scripted visual approach, with rotation leading the eased logarithmic dolly. */
export function sampleApproachPose(start: GlobeOrbitPose, value: number): GlobeOrbitPose {
  const t = progress(value)
  if (t === 0) return { ...start }
  const rotation = ease(t / 0.72)
  const dolly = ease((t - 0.08) / 0.92)
  const targetPolar = Math.max(0.05, Math.min(Math.PI - 0.05, start.polar - 0.12))
  return {
    azimuth: start.azimuth + 0.65 * rotation,
    polar: start.polar + (targetPolar - start.polar) * rotation,
    radius: t === 1 ? 1.9 : Math.exp(Math.log(start.radius) * (1 - dolly) + Math.log(1.9) * dolly),
  }
}
