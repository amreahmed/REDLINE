import { useRef } from 'react'
import { Icon } from '../shared/Icon'

export function AboutDialog({ onOpenScientificDetails }: { onOpenScientificDetails: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button className="quiet-button flex items-center gap-2" type="button" aria-label="About REDLINE" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        <Icon name="info" size={17} /><span>About</span>
      </button>
      <dialog ref={dialogRef} className="about-dialog" aria-labelledby="about-heading" aria-describedby="about-description">
        <div className="flex items-center justify-between gap-4">
          <h2 id="about-heading">About REDLINE</h2>
          <button className="icon-button" type="button" aria-label="Close about" onClick={() => dialogRef.current?.close()} autoFocus><Icon name="close" size={20} /></button>
        </div>
        <p id="about-description">A workspace for exploring Mars and understanding the evidence behind hypothetical surface-route planning.</p>
        <div className="dialog-scope">
          <h3>Mars exploration preview</h3>
          <p>Explore NASA’s visual Mars model and sourced MOLA / CTX imagery. Plan compares distance-only hypothetical paths between native grid cells, with an optional waypoint. Scientific validation is Partial; details separate verified geometry and mathematical search from unresolved terrain and feature accuracy.</p>
          <button type="button" className="scientific-inline-link" onClick={() => { dialogRef.current?.close(); onOpenScientificDetails() }}>View scientific details</button>
        </div>
        <p className="helper">REDLINE is an independent prototype, not an official NASA product or a certified human-safety system.</p>
      </dialog>
    </>
  )
}
