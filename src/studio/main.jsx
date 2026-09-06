import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import GUI from 'lil-gui'
import { TourGuide } from '../components/TourGuide.jsx'
import { EDGAR_LIKENESS } from '../components/miniEdgarModel.js'
import './studio.css'

function Studio() {
  const [likeness, setLikeness] = useState({ ...EDGAR_LIKENESS })
  const [photo, setPhoto] = useState(null)
  const [portrait, setPortrait] = useState(true)
  const [facing, setFacing] = useState(0)
  const [paused, setPaused] = useState(true)
  const [size, setSize] = useState(Math.min(480, window.innerWidth - 48))
  const controls = useRef(null)
  useEffect(() => {
    const resize = () => setSize(Math.min(480, window.innerWidth - 48))
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo) }, [photo])
  useEffect(() => {
    const params = { ...EDGAR_LIKENESS }
    const gui = new GUI({ container: controls.current, title: 'Likeness controls' })
    const names = { faceWidth: 'Face width', faceHeight: 'Face height', jawWidth: 'Jaw width', eyeSpacing: 'Eye spacing', noseWidth: 'Nose width', hairHeight: 'Hair height' }
    for (const [key, name] of Object.entries(names)) {
      gui.add(params, key, 0.85, 1.15, 0.01).name(name).onFinishChange(() => setLikeness({ ...params }))
    }
    gui.addColor(params, 'skin').name('Skin tone').onFinishChange(() => setLikeness({ ...params }))
    gui.addColor(params, 'hair').name('Hair color').onFinishChange(() => setLikeness({ ...params }))
    gui.add(params, 'beardDensity', 0, 1, 0.01).name('Beard fullness').onFinishChange(() => setLikeness({ ...params }))
    gui.add({ reset() {
      Object.assign(params, EDGAR_LIKENESS)
      gui.controllers.forEach(controller => controller.updateDisplay())
      setLikeness({ ...params })
    } }, 'reset').name('Reset likeness')
    return () => gui.destroy()
  }, [])
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(likeness, null, 2) + '\n'], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'edgar-likeness.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <main>
    <header><p className="eyebrow">ASCEND / CHARACTER WORKSHOP</p><h1>Mini Edgar Studio</h1><p>Compare the reference. Refine the likeness.</p></header>
    <div className="workspace">
      <section className="panel reference"><h2>Your reference</h2>
        <div className="photo">{photo ? <img src={photo} alt="Selected likeness reference" /> : <p>Choose your portrait to compare it beside Mini Edgar.</p>}</div>
        <label className="file">Choose reference photo<input type="file" accept="image/*" onChange={event => {
          const file = event.target.files?.[0]
          if (file) setPhoto(URL.createObjectURL(file))
        }} /></label>
        <p className="note">The photo stays in this browser. It is not uploaded.</p>
      </section>
      <section className="panel model"><h2>Character preview</h2>
        <div className="stage"><TourGuide size={size} likeness={likeness} portrait={portrait} facing={facing} paused={paused} /></div>
        <div className="toolbar">
          <button onClick={() => setPortrait(v => !v)}>{portrait ? 'Show full character' : 'Show face'}</button>
          <button onClick={() => setPaused(v => !v)}>{paused ? 'Play animation' : 'Pause animation'}</button>
        </div>
        <label className="angle">Viewing angle<input aria-label="Viewing angle" type="range" min={-3.14} max={3.14} step={0.01} value={facing} onChange={e => { setPaused(true); setFacing(Number(e.target.value)) }} /></label>
      </section>
      <aside className="panel"><div ref={controls} /><button className="export" onClick={download}>Export likeness</button>
        <p className="note">To apply your settings to the portfolio, replace <code>src/components/edgar-likeness.json</code> with the exported file and rebuild.</p>
        <p className="note">A stylized interpretation of the photos. Side and back views are approximate.</p>
      </aside>
    </div>
  </main>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Studio /></React.StrictMode>)
