import { toDisplayCoordinate } from './coordinates'
import type { EndpointRole, MissionSelection, ScienceTarget } from './types'

export const initialMissionSelection: MissionSelection = { origin: null, destination: null }

export function assignEndpoint(
  selection: MissionSelection,
  role: EndpointRole,
  id: string | null,
  targets: readonly ScienceTarget[],
): { selection: MissionSelection; error: string | null } {
  if (role !== 'origin' && role !== 'destination') return { selection, error: 'Choose origin or destination.' }
  if (id === null) return { selection: { ...selection, [role]: null }, error: null }
  const target = targets.find((reference) => reference.id === id)
  if (!target) return { selection, error: 'Choose a known feature reference.' }
  if (!toDisplayCoordinate(target.coordinate)) return { selection, error: 'This reference has unsupported or invalid coordinates.' }
  const otherRole: EndpointRole = role === 'origin' ? 'destination' : 'origin'
  if (selection[otherRole] === target.id) return { selection, error: 'Origin and destination must be different references.' }
  return { selection: { ...selection, [role]: target.id }, error: null }
}

export function swapEndpoints(selection: MissionSelection): MissionSelection {
  return { origin: selection.destination, destination: selection.origin }
}
