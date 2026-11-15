import { useEffect, useRef, useState } from 'react'
import { Icon } from '../shared/Icon'
import { GLOBE_LAYERS } from '../../data/globeLayers'
import type { GlobeLayerId } from '../../data/globeLayers'
import { MARS_LAYERS } from '../../data/marsLayers'
import type { LayerId, LayerStatuses, LayerVisibility } from '../../features/map/types'
import type { GlobeMode } from '../../features/globe/explorationTypes'
import type { TerrainOverlayMode } from '../../features/map/terrainModelOverlay'

export type FloatingLayerMenuProps = {
  mapShown: boolean
  globeMode: GlobeMode
  globeLayerId: GlobeLayerId
  visibility: LayerVisibility
  statuses: LayerStatuses
  onSelectGlobeLayer: (mode: GlobeMode, id: GlobeLayerId) => void
  onToggleLayer: (id: LayerId) => void
  onRetryLayer?: (id: LayerId) => void
  terrainVisible?: boolean
  onToggleTerrain?: () => void
  terrainOverlay?: TerrainOverlayMode
  onSelectTerrainOverlay?: (mode: TerrainOverlayMode) => void
}

export function FloatingLayerMenu({
  mapShown,
  globeMode,
  globeLayerId,
  visibility,
  statuses,
  onSelectGlobeLayer,
  onToggleLayer,
  onRetryLayer,
  terrainVisible,
  onToggleTerrain,
  terrainOverlay,
  onSelectTerrainOverlay,
}: FloatingLayerMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Global basemaps: Viking, Global CTX, MOLA
  const isGlobal = (coverage: readonly number[]) => coverage[0] <= -179 && coverage[2] >= 179 && coverage[1] <= -89 && coverage[3] >= 89
  const globalBasemaps = GLOBE_LAYERS.filter(layer => isGlobal(layer.coverage))

  // Regional Jezero layers
  const regionalOverlays = MARS_LAYERS

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current && !menuRef.current.contains(target) && triggerRef.current && !triggerRef.current.contains(target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="floating-layer-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className="floating-layer-trigger grid-button"
        aria-label="Map layers"
        title="Map layers"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <Icon name="layers" size={18} />
        <span>Layers</span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="floating-layer-menu"
          role="dialog"
          aria-label="Map layers menu"
        >
          <div className="floating-layer-header">
            <div>
              <h3 className="floating-layer-title">Map layers</h3>
              <p className="floating-layer-subtitle">{mapShown ? 'Regional map active' : 'Planetary overview'}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close layers menu"
              onClick={() => setIsOpen(false)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          <div className="floating-layer-content">
            {/* Global Basemaps Section */}
            <section className="floating-layer-section">
              <h4 className="floating-section-heading">Planet basemaps</h4>
              <p className="helper floating-section-desc">Single-source global coverage</p>
              <div className="floating-basemap-list">
                {globalBasemaps.map(source => {
                  const active = globeMode === 'imagery' && globeLayerId === source.id
                  return (
                    <button
                      key={source.id}
                      type="button"
                      className={`floating-basemap-item ${active ? 'is-active' : ''}`}
                      onClick={() => onSelectGlobeLayer('imagery', source.id)}
                      aria-pressed={active}
                    >
                      <div className="floating-basemap-info">
                        <span className="floating-item-name">{source.name}</span>
                        <span className="floating-item-meta">{source.resolution.split(';')[0]}</span>
                      </div>
                      {active && <span className="floating-active-badge">Active</span>}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Regional Jezero Overlays Section */}
            <section className="floating-layer-section">
              <h4 className="floating-section-heading">Regional Jezero imagery</h4>
              <p className="helper floating-section-desc">High-resolution local observations</p>
              <div className="floating-overlay-list">
                {regionalOverlays.map(layer => {
                  const isVisible = visibility[layer.id]
                  const status = statuses[layer.id]
                  const hasError = status.phase === 'unavailable' || status.failed > 0 || status.missing > 0
                  return (
                    <div key={layer.id} className="floating-overlay-item">
                      <label className="floating-overlay-label">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => onToggleLayer(layer.id)}
                          aria-label={layer.name}
                        />
                        <div className="floating-overlay-text">
                          <span className="floating-item-name">{layer.name}</span>
                          <span className="floating-item-meta">{layer.description}</span>
                        </div>
                      </label>
                      <div className="floating-overlay-status">
                        <span className={`status-indicator ${isVisible ? 'is-active' : 'is-inactive'}`} />
                        <span className="status-text">
                          {!isVisible ? 'Hidden' : status.phase === 'checking' ? 'Checking…' : hasError ? 'Error' : 'Visible'}
                        </span>
                        {hasError && onRetryLayer && (
                          <button
                            type="button"
                            className="floating-retry-btn"
                            onClick={() => onRetryLayer(layer.id)}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Topography & Terrain Section */}
            {onToggleTerrain && (
              <section className="floating-layer-section">
                <h4 className="floating-section-heading">Topography &amp; DEM</h4>
                <div className="floating-overlay-item">
                  <label className="floating-overlay-label">
                    <input
                      type="checkbox"
                      checked={!!terrainVisible}
                      onChange={onToggleTerrain}
                      aria-label="HRSC DEM model overlay"
                    />
                    <div className="floating-overlay-text">
                      <span className="floating-item-name">HRSC terrain model</span>
                      <span className="floating-item-meta">Mars Express 50m digital elevation</span>
                    </div>
                  </label>
                </div>
                {terrainVisible && onSelectTerrainOverlay && (
                  <div className="floating-terrain-mode">
                    <label className="field-label" htmlFor="floating-dem-mode">Terrain overlay mode</label>
                    <select
                      id="floating-dem-mode"
                      value={terrainOverlay ?? 'traversability'}
                      onChange={e => onSelectTerrainOverlay(e.target.value as TerrainOverlayMode)}
                    >
                      <option value="none">Imagery only</option>
                      <option value="elevation">Elevation</option>
                      <option value="slope">Slope gradient (°)</option>
                      <option value="roughness">Roughness (m)</option>
                      <option value="traversability">Traversability map</option>
                    </select>
                  </div>
                )}
              </section>
            )}

            {/* Scientific Attribution Footnote */}
            <div className="floating-layer-footnote">
              <p>Rendered NASA/JPL/ESA Mars Trek imagery. RGB display pixels are not numerical elevation.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
