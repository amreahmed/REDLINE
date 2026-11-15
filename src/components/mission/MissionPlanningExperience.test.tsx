import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MissionPlanningExperience } from './MissionPlanningExperience'
import { SCIENCE_TARGETS } from '../../data/scienceTargets'
import { DEFAULT_TERRAIN_PROFILE } from '../../features/terrain/terrainModel'

const mockTerrain = { phase: 'idle' as const }
const mockSelection = { origin: null, destination: null }
const mockDistanceRouting = {
  state: { phase: 'idle' as const },
  blocker: null,
  waypoint: null,
  waypointPoint: null,
  waypointNotice: null,
  assignWaypoint: vi.fn(),
  clearWaypoint: vi.fn(),
  calculate: vi.fn(),
  cancel: vi.fn(),
  routes: [],
  selectedId: 'shortest' as const,
  selectRoute: vi.fn(),
}
const mockTerrainRouting = {
  data: { phase: 'idle' as const },
  profile: DEFAULT_TERRAIN_PROFILE,
  analysis: null,
  state: { phase: 'idle' as const },
  blocker: null,
  load: vi.fn(),
  applyProfile: vi.fn(),
  calculate: vi.fn(),
  cancel: vi.fn(),
  selected: 'terrain' as const,
  selectRoute: vi.fn(),
  overlay: 'traversability' as const,
  setOverlay: vi.fn(),
  visible: true,
  setVisible: vi.fn(),
  display: null,
  originPoint: null,
  destinationPoint: null,
}

describe('MissionPlanningExperience', () => {
  it('renders guided workflow navigation with all 4 stages', () => {
    const markup = renderToStaticMarkup(
      <MissionPlanningExperience
        terrain={mockTerrain}
        gridSelection={mockSelection}
        pickRole={null}
        gridNotice={null}
        canPick={false}
        onOpenPlanning={vi.fn()}
        onAssignGridCell={vi.fn()}
        onBeginPickRole={vi.fn()}
        onUseCenter={vi.fn()}
        onCancelPick={vi.fn()}
        onSwapGridEndpoints={vi.fn()}
        onClearGridEndpoints={vi.fn()}
        distanceRouting={mockDistanceRouting}
        terrainRouting={mockTerrainRouting}
        targets={SCIENCE_TARGETS}
        missionSelection={{ origin: null, destination: null }}
        selectedTargetId={null}
        selectionError={null}
        onInspectTarget={vi.fn()}
        onAssignTarget={vi.fn()}
        onSwapTargets={vi.fn()}
        onClearTargets={vi.fn()}
      />
    )

    // Navigation stages
    expect(markup).toContain('Endpoints')
    expect(markup).toContain('Rover Profile')
    expect(markup).toContain('Calculate')
    expect(markup).toContain('Results')

    // Quick presets
    expect(markup).toContain('Quick mission presets')
    expect(markup).toContain('Belva Rim to Floor')
    expect(markup).toContain('Neretva Delta Traverse')
  })

  it('renders origin and destination endpoint cards with picking actions', () => {
    const markup = renderToStaticMarkup(
      <MissionPlanningExperience
        terrain={mockTerrain}
        gridSelection={mockSelection}
        pickRole={null}
        gridNotice={null}
        canPick={false}
        onOpenPlanning={vi.fn()}
        onAssignGridCell={vi.fn()}
        onBeginPickRole={vi.fn()}
        onUseCenter={vi.fn()}
        onCancelPick={vi.fn()}
        onSwapGridEndpoints={vi.fn()}
        onClearGridEndpoints={vi.fn()}
        distanceRouting={mockDistanceRouting}
        terrainRouting={mockTerrainRouting}
        targets={SCIENCE_TARGETS}
        missionSelection={{ origin: null, destination: null }}
        selectedTargetId={null}
        selectionError={null}
        onInspectTarget={vi.fn()}
        onAssignTarget={vi.fn()}
        onSwapTargets={vi.fn()}
        onClearTargets={vi.fn()}
      />
    )

    expect(markup).toContain('Grid origin · G-O')
    expect(markup).toContain('Grid destination · G-D')
    expect(markup).toContain('Pick origin on map')
    expect(markup).toContain('Pick destination on map')
  })
})
