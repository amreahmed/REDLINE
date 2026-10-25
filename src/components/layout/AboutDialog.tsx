import { useRef } from 'react'
import { Icon } from '../shared/Icon'

export function AboutDialog() {
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
          <h3>Regional map preview</h3>
          <p>Explore NASA Mars Trek’s MOLA shaded relief and preliminary Jezero CTX imagery. Service-grid coordinates are for image orientation; native CTX registration is not independently validated. No elevation, slope, hazard, or route calculations are included.</p>
        </div>
        <p className="helper">REDLINE is an independent prototype, not an official NASA product or a certified human-safety system.</p>
      </dialog>
    </>
  )
}
