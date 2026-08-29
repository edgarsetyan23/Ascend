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
      // A slight forward tilt, as though looking at something ahead
      // and a little up — the "examining the exhibit" pose.
      head.rotation.x = -0.15
      group.add(head)

      // Facing away from the camera — we see their backs, as if
      // they're looking up at the content above them on the page.
      group.rotation.y = Math.PI
      return group
    }

    // x values are wide because the canvas is a short, wide strip —
    // the resulting horizontal frustum is far wider than the vertical
    // FOV alone suggests, so a modest world-space spread reads as
    // tightly clustered dead-center unless the spread accounts for it.
    // Scale is close to 1 (same order as the un-scaled main guide) so
    // they read as comparably sized, not miniature.
    const visitors = [
      { g: buildVisitor(0x7d8570, false), x: -2.6, z: -0.6, scale: 1.15, sway: 1.3 },
      { g: buildVisitor(0x8a7d6a, true),  x: 0.15, z: -0.9, scale: 1.3,  sway: 2.7 },
      { g: buildVisitor(0x6f7a82, false), x: 2.75, z: -0.7, scale: 1.1,  sway: 4.1 },
    ]
    visitors.forEach(({ g, x, z, scale }) => {
      g.position.set(x, -0.35, z)
      g.scale.setScalar(scale)
      scene.add(g)
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
      visitors.forEach(({ g, sway }) => {
        g.rotation.y = Math.PI + Math.sin(t * 0.3 + sway) * 0.15
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
