import { describe, expect, it } from 'vitest'
import { formatTravelArrival, formatTravelDuration, formatTravelSpeed } from './travelTimeDisplay'

describe('provisional travel time presentation', () => {
  it('rounds duration to minutes while preserving stationary and sub-minute states', () => {
    expect(formatTravelDuration(0)).toBe('0 min')
    expect(formatTravelDuration(0.1)).toBe('<1 min')
    expect(formatTravelDuration(59.9)).toBe('<1 min')
    expect(formatTravelDuration(60)).toBe('1 min')
    expect(formatTravelDuration(89)).toBe('1 min')
    expect(formatTravelDuration(90)).toBe('2 min')
    expect(formatTravelDuration(3599)).toBe('1 h')
    expect(formatTravelDuration(3660)).toBe('1 h 1 min')
    expect(formatTravelDuration(26 * 3600)).toBe('26 h')
  })

  it.each([-1, NaN, Infinity])('does not render invalid duration %s as a result', value => {
    expect(formatTravelDuration(value)).toBe('Unavailable')
  })

  it('shows a rounded Earth UTC arrival with date rollover independent of local time', () => {
    expect(formatTravelArrival('2026-11-15T12:30:29.999Z')).toBe('15 Nov 2026, 12:30 UTC')
    expect(formatTravelArrival('2026-11-15T23:59:30.000Z')).toBe('16 Nov 2026, 00:00 UTC')
    expect(formatTravelArrival('2026-11-15T14:30:00+02:00')).toBe('15 Nov 2026, 12:30 UTC')
    expect(formatTravelArrival('invalid')).toBe('Unavailable')
  })

  it('limits speed precision without turning missing or stationary values into zero', () => {
    expect(formatTravelSpeed(0.123456)).toBe('0.123 m/s')
    expect(formatTravelSpeed(1)).toBe('1 m/s')
    expect(formatTravelSpeed(12.3456)).toBe('12.3 m/s')
    for (const value of [null, 0, -1, NaN, Infinity]) expect(formatTravelSpeed(value)).toBe('Unavailable')
  })
})
