import { useEffect, useRef, useState } from 'react'
import type { GlobeController, GlobeStatus } from '../../features/globe/createMarsGlobe'
import { MARS_GLOBE } from '../../data/marsGlobe'
import { Icon } from '../shared/Icon'

const loading: GlobeStatus = { phase: 'loading', message: 'Starting 3D Mars…' }

export function MarsGlobe({ onOpenJezero }: { onOpenJezero: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<GlobeController | null>(null)
  const [status, setStatus] = useState<GlobeStatus>(loading)
  const [attempt, setAttempt] = useState(0)
  const ready = status.phase === 'ready'

  useEffect(() => {
    let active = true
    // Three.js and its loaders are fetched only when the user opens this view.
    void import('../../features/globe/createMarsGlobe').then(({ createMarsGlobe }) => {
      if (active && hostRef.current) controllerRef.current = createMarsGlobe(hostRef.current, (next) => { if (active) setStatus(next) })
    }).catch(() => {
      if (active) setStatus({ phase: 'error', message: 'The 3D viewer could not start. WebGL 2 and a working connection are required. Retry or use the regional map.' })
    })
    return () => { active = false; controllerRef.current?.dispose(); controllerRef.current = null }
  }, [attempt])

  return (
    <section className="map-viewport globe-viewport" aria-labelledby="globe-heading" data-grid="false">
      <div className="viewport-top map-toolbar flex items-center justify-between gap-3">
        <div className="viewport-label flex items-center gap-2"><Icon name="orbit" size={17} /><h1 id="globe-heading">3D Mars overview</h1></div>
        <button className="grid-button" type="button" disabled={!ready} onClick={() => controllerRef.current?.reset()}>Reset globe</button>
      </div>
      <div className="globe-surface">
        <div id="globe-workspace" ref={hostRef} className="globe-host" role="region" tabIndex={0} aria-label="Interactive visual Mars globe" aria-describedby="globe-help globe-limit" onKeyDown={(event) => {
          if (!ready || event.altKey || event.ctrlKey || event.metaKey) return
          const rotations: Record<string, [number, number]> = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }
          if (rotations[event.key]) { event.preventDefault(); controllerRef.current?.rotate(...rotations[event.key]) }
          if (['+', '=', '-', 'Home'].includes(event.key)) {
            event.preventDefault()
            if (event.key === 'Home') controllerRef.current?.reset()
            else controllerRef.current?.zoom(event.key === '-' ? 1.2 : 1 / 1.2)
          }
        }} />
        {status.phase !== 'ready' && <div className="globe-message" role="status">
          <Icon name="orbit" size={30} />
          <p>{status.message}</p>
          {status.phase === 'error' && <button className="grid-button" type="button" onClick={() => { setStatus(loading); setAttempt((value) => value + 1) }}>Retry globe</button>}
          <button className="grid-button" type="button" onClick={onOpenJezero}>Open Jezero regional map</button>
        </div>}
        <div className="map-credit">Visual model: {MARS_GLOBE.attribution}</div>
      </div>
      <div className="globe-actions" role="group" aria-label="Globe navigation">
        <button type="button" disabled={!ready} onClick={() => controllerRef.current?.rotate(-0.25, 0)} aria-label="Rotate globe left">←</button>
        <button type="button" disabled={!ready} onClick={() => controllerRef.current?.rotate(0.25, 0)} aria-label="Rotate globe right">→</button>
        <button type="button" disabled={!ready} onClick={() => controllerRef.current?.rotate(0, -0.25)} aria-label="Rotate globe up">↑</button>
        <button type="button" disabled={!ready} onClick={() => controllerRef.current?.rotate(0, 0.25)} aria-label="Rotate globe down">↓</button>
        <button type="button" disabled={!ready} onClick={() => controllerRef.current?.zoom(1 / 1.2)} aria-label="Zoom into globe">+</button>
        <button type="button" disabled={!ready} onClick={() => controllerRef.current?.zoom(1.2)} aria-label="Zoom out of globe">−</button>
      </div>
      <div className="viewport-bottom map-help">
        <p role="status">{status.phase === 'ready' ? status.message : 'Globe unavailable until loading completes.'}</p>
        <p id="globe-help">Drag to rotate; scroll or pinch to zoom. With focus here, use arrow keys, + / −, or Home to reset.</p>
        <p id="globe-limit">Visual orientation only. Geometry and textures are not elevation data or precise target coordinates.</p>
      </div>
    </section>
  )
}
