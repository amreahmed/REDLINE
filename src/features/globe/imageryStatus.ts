import type { GlobeImageryStatus } from './globeTileLod'

/** Presentation only: received tiles are not a completeness or accuracy claim. */
export function imageryStatusText(status: GlobeImageryStatus, level?: number): string {
  if (status.phase === 'outside') return 'Selected source has no coverage at this location.'
  const gaps = status.failed || status.missing ? ` · ${status.failed} failed · ${status.missing} missing` : ''
  if (status.phase === 'error') return `Selected imagery unavailable${gaps}. Retry this source.`
  if (status.pending) return `Loading selected imagery${level === undefined ? '' : ` · level ${level}`}${gaps}`
  return `${status.loaded} source tiles loaded${level === undefined ? '' : ` · tile level ${level}`}${gaps}`
}
