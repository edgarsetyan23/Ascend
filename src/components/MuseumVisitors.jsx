import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// A handful of other museum-goers standing along the bottom of every
// exhibit page, seen from behind — as if we're looking over their
// shoulders at the exhibit above. Deliberately much simpler than the
// main guide (no face needed at all, since we only ever see their
// backs): legs, torso, arms, a plain head. Shares one canvas for all
// figures rather than a WebGL context each. Sized and framed to match
// the guide's own corner presence — same FOV and camera distance as
// TourGuide.jsx — so they read as the same scale as him, not tiny
// background props.
export function MuseumVisitors({ size = 260 }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const width = container.clientWidth || 900
    const height = size

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100)
    camera.position.set(0, 0.3, 5.6)
    camera.lookAt(0, -0.1, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xfff4e6, 0.9)
    key.position.set(2, 4, 3)
    scene.add(key)

    const disposables = []
    const track = (obj) => { disposables.push(obj); return obj }

    const legGeo = track(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 6))
    const torsoGeo = track(new THREE.CylinderGeometry(0.2, 0.27, 0.5, 6))
    const armGeo = track(new THREE.CylinderGeometry(0.06, 0.075, 0.42, 6))
    const headGeo = track(new THREE.IcosahedronGeometry(0.27, 1))

    function buildVisitor(color, armUp) {
      const mat = track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }))
      const group = new THREE.Group()

      const legL = new THREE.Mesh(legGeo, mat); legL.position.set(-0.14, -0.85, 0); group.add(legL)
      const legR = new THREE.Mesh(legGeo, mat); legR.position.set(0.14, -0.85, 0); group.add(legR)

      const torso = new THREE.Mesh(torsoGeo, mat)
      torso.position.y = -0.32
      group.add(torso)

      const armL = new THREE.Mesh(armGeo, mat)
      armL.position.set(-0.28, -0.32, 0)
      armL.rotation.z = 0.12
      group.add(armL)

      const armR = new THREE.Mesh(armGeo, mat)
      if (armUp) {
        // One figure gestures toward the exhibits, for variety.
        armR.position.set(0.28, -0.1, 0)
        armR.rotation.z = -0.9
      } else {
        armR.position.set(0.28, -0.32, 0)
        armR.rotation.z = -0.12
      }
      group.add(armR)

      const head = new THREE.Mesh(headGeo, mat)
      head.scale.set(0.9, 1.05, 0.95)
      head.position.y = 0.16
      // Base tilt is animated (see animate() below) — this is just
      // the resting pose between "look" beats.
      head.rotation.x = -0.15
      group.add(head)

      // Facing away from the camera — we see their backs, as if
      // they're looking up at the content above them on the page.
      group.rotation.y = Math.PI
      return { group, head }
    }

    // x values are wide because the canvas is a short, wide strip —
    // the resulting horizontal frustum is far wider than the vertical
    // FOV alone suggests, so a modest world-space spread reads as
    // tightly clustered dead-center unless the spread accounts for it.
    // Scale is close to 1 (same order as the un-scaled main guide) so
    // they read as comparably sized, not miniature.
    // `phase` staggers each visitor's bob/step/look cycle so the row
    // doesn't move in unison like one synced animation.
    const baseY = -0.35
    const visitors = [
      { ...buildVisitor(0x7d8570, false), baseX: -3.7, baseZ: -1.0, scale: 1.0,  phase: 0.4 },
      { ...buildVisitor(0x8a7d6a, false), baseX: -2.2, baseZ: -0.5, scale: 1.2,  phase: 1.3 },
      { ...buildVisitor(0x6f7a82, true),  baseX: -0.5, baseZ: -0.9, scale: 1.1,  phase: 2.1 },
      { ...buildVisitor(0x7a6f82, false), baseX: 1.1,  baseZ: -0.6, scale: 1.25, phase: 2.7 },
      { ...buildVisitor(0x82755f, true),  baseX: 2.7,  baseZ: -1.0, scale: 1.05, phase: 3.5 },
      { ...buildVisitor(0x6f8275, false), baseX: 4.1,  baseZ: -0.7, scale: 1.15, phase: 4.1 },
    ]
    visitors.forEach(({ group, baseX, baseZ, scale }) => {
      group.position.set(baseX, baseY, baseZ)
      group.scale.setScalar(scale)
      scene.add(group)
    })

    renderer.render(scene, camera)

    const cleanup = () => {
      renderer.dispose()
      disposables.forEach((d) => d.dispose())
      container.removeChild(renderer.domElement)
    }

    if (prefersReducedMotion) {
      return cleanup
    }

    let frameId
    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      visitors.forEach(({ group, head, baseX, baseZ, phase }) => {
        // A slow shuffling drift + weight-shift bounce — reads as
        // restless standing rather than a locked-in-place prop.
        group.position.x = baseX + Math.sin(t * 0.18 + phase) * 0.14
        group.position.z = baseZ
        group.position.y = baseY + Math.abs(Math.sin(t * 1.1 + phase)) * 0.025
        group.rotation.y = Math.PI + Math.sin(t * 0.3 + phase) * 0.08

        // The actual "looking at the exhibit" motion lives on the
        // head: a slow upward-tilting nod (studying the text above
        // them) crossed with a gentle left-right scan, like reading
        // a line of text rather than staring at one fixed point.
        head.rotation.x = -0.22 + Math.sin(t * 0.45 + phase) * 0.16
        head.rotation.y = Math.sin(t * 0.32 + phase * 1.4) * 0.22
      })
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
      cleanup()
    }
  }, [size])

  return <div ref={containerRef} className="exh-museum-visitors" style={{ height: size }} aria-hidden="true" />
}
