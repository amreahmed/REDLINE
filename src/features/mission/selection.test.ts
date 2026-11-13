import { describe, expect, it } from 'vitest'
import { SCIENCE_TARGETS } from '../../data/scienceTargets'
import { assignEndpoint, initialMissionSelection, swapEndpoints } from './selection'
import type { EndpointRole, MissionSelection, ScienceTarget } from './types'

describe('hypothetical mission endpoints', () => {
  it('starts without silently selected endpoints', () => {
    expect(initialMissionSelection).toEqual({ origin: null, destination: null })
  })

  it('assigns known distinct references to origin and destination', () => {
    const origin = assignEndpoint(initialMissionSelection, 'origin', 'jezero', SCIENCE_TARGETS)
    expect(origin).toEqual({ selection: { origin: 'jezero', destination: null }, error: null })
    const destination = assignEndpoint(origin.selection, 'destination', 'belva', SCIENCE_TARGETS)
    expect(destination).toEqual({ selection: { origin: 'jezero', destination: 'belva' }, error: null })
    expect(initialMissionSelection).toEqual({ origin: null, destination: null })
  })

  it.each(['origin', 'destination'] as const)('rejects an unknown %s reference without replacing existing endpoints', (role) => {
    const selection = Object.freeze<MissionSelection>({ origin: 'jezero', destination: 'belva' })
    const result = assignEndpoint(selection, role, 'unverified-target', SCIENCE_TARGETS)
    expect(result.selection).toBe(selection)
    expect(result.error).toMatch(/known feature/i)
  })

  it.each(['origin', 'destination'] as const)('rejects a duplicate %s while retaining the prior selection', (role) => {
    const selection = Object.freeze<MissionSelection>({ origin: 'jezero', destination: 'belva' })
    const duplicate = role === 'origin' ? 'belva' : 'jezero'
    const result = assignEndpoint(selection, role, duplicate, SCIENCE_TARGETS)
    expect(result.selection).toBe(selection)
    expect(result.error).toMatch(/different references/i)
  })

  it.each(['origin', 'destination'] as const)('clears only the requested %s endpoint', (role) => {
    const selection: MissionSelection = { origin: 'jezero', destination: 'belva' }
    expect(assignEndpoint(selection, role, null, SCIENCE_TARGETS)).toEqual({
      selection: { ...selection, [role]: null },
      error: null,
    })
    expect(selection).toEqual({ origin: 'jezero', destination: 'belva' })
  })

  it('rejects a reference whose coordinate convention cannot be supported', () => {
    const target = SCIENCE_TARGETS[0]
    const invalidTargets: readonly ScienceTarget[] = [{ ...target, coordinate: { ...target.coordinate, latitudeConvention: 'planetographic' } }]
    const result = assignEndpoint(initialMissionSelection, 'origin', target.id, invalidTargets)
    expect(result.selection).toBe(initialMissionSelection)
    expect(result.error).toMatch(/coordinates/i)
  })

  it('rejects a reference with invalid numerical coordinates', () => {
    const target = SCIENCE_TARGETS[0]
    const invalidTargets: readonly ScienceTarget[] = [{ ...target, coordinate: { ...target.coordinate, lat: Number.NaN } }]
    expect(assignEndpoint(initialMissionSelection, 'destination', target.id, invalidTargets).error).toMatch(/coordinates/i)
  })

  it('does not assign a role outside the public endpoint contract', () => {
    const result = assignEndpoint(initialMissionSelection, 'other' as EndpointRole, 'jezero', SCIENCE_TARGETS)
    expect(result.selection).toBe(initialMissionSelection)
    expect(result.error).toMatch(/origin or destination/i)
  })

  it.each<MissionSelection>([
    { origin: null, destination: null },
    { origin: 'jezero', destination: null },
    { origin: null, destination: 'belva' },
    { origin: 'jezero', destination: 'neretva' },
  ])('swaps partial or complete selections without mutating them: %j', (selection) => {
    const source = Object.freeze({ ...selection })
    expect(swapEndpoints(source)).toEqual({ origin: selection.destination, destination: selection.origin })
    expect(source).toEqual(selection)
    expect(swapEndpoints(swapEndpoints(source))).toEqual(selection)
  })
})
