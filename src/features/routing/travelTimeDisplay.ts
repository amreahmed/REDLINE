/** Minute-level display avoids implying measured or second-accurate performance. */
export function formatTravelDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unavailable'
  if (seconds === 0) return '0 min'
  if (seconds < 60) return '<1 min'
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${minutes} min`
}

/** UTC is explicit even when the browser/device uses another time zone. */
export function formatTravelArrival(iso: string): string {
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return 'Unavailable'
  const date = new Date(Math.round(timestamp / 60000) * 60000)
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(date)
  return `${day}, ${time} UTC`
}

export function formatTravelSpeed(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return 'Unavailable'
  return `${new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 3 }).format(value)} m/s`
}
