import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FloatingLayerMenu } from './FloatingLayerMenu'
import type { LayerStatuses, LayerVisibility } from '../../features/map/types'
import { initialLayerStatus } from '../../features/map/types'

const defaultVisibility: LayerVisibility = { mola: true, ctx: true, controlledCtx: false }
const defaultStatuses: LayerStatuses = {
  mola: { ...initialLayerStatus(), phase: 'available', coverage: 'inside' },
  ctx: { ...initialLayerStatus(), phase: 'available', coverage: 'inside' },
  controlledCtx: { ...initialLayerStatus(), phase: 'available', coverage: 'inside' },
}

const render = (overrides = {}) =>
  renderToStaticMarkup(
    <FloatingLayerMenu
      mapShown={true}
      globeMode="imagery"
      globeLayerId="viking"
      visibility={defaultVisibility}
      statuses={defaultStatuses}
      onSelectGlobeLayer={vi.fn()}
      onToggleLayer={vi.fn()}
      {...overrides}
    />
  )

describe('FloatingLayerMenu', () => {
  it('renders the floating trigger button with accessible name and collapsed state', () => {
    const markup = render()
    expect(markup).toContain('aria-label="Map layers"')
    expect(markup).toContain('title="Map layers"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('class="floating-layer-trigger')
    expect(markup).toContain('Layers</span>')
  })

  it('renders layers when open or supports state toggling', () => {
    const markup = render()
    expect(markup).not.toContain('floating-layer-menu')
  })
})
