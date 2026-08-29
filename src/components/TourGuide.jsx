import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// A small, persistent low-poly guide — stylized after a real photo (dark
// curly hair, beard, warm skin tone, dark top), holding a little tour flag.
// Built entirely from primitive geometry: no external 3D asset, no
// attempt at a literal photorealistic likeness, just a friendly low-poly
// nod to the reference. Mounted once and kept alive across navigation —
// only the caption text (and, on the Introduction plate, its size and
// screen position) changes — so it never tears down and rebuilds its
// WebGL scene on every click. Passing a new `walkKey` (the caller
// changes it on navigation, and again when "Start the tour" is clicked)
// triggers a brief walk-cycle burst so the guide visibly moves instead
// of just idling in place.
export function TourGuide({ accentColor = '#4f7a63', size = 128, walkKey }) {
  const containerRef = useRef(null)
  const walkUntilRef = useRef(0)
  const isFirstWalkKeyRef = useRef(true)

  // Nothing to "walk to" on first mount — only trigger on real changes.
  useEffect(() => {
    if (isFirstWalkKeyRef.current) { isFirstWalkKeyRef.current = false; return }
    walkUntilRef.current = performance.now() + 1100
  }, [walkKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(size, size)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 0.35, 5.4)
    camera.lookAt(0, 0.2, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const key = new THREE.DirectionalLight(0xfff4e6, 1.1)
    key.position.set(2, 3, 2.5)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xcfe8ff, 0.3)
    fill.position.set(-2, -1, 1.5)
    scene.add(fill)

    const disposables = []
    const track = (obj) => { disposables.push(obj); return obj }

    const skinMat  = track(new THREE.MeshStandardMaterial({ color: 0xc99a72, roughness: 0.65, flatShading: true }))
    const hairMat  = track(new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.8, flatShading: true }))
    const beardMat = track(new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.85, flatShading: true }))
    const shirtMat = track(new THREE.MeshStandardMaterial({ color: 0x2e332f, roughness: 0.75, flatShading: true }))
    const flagMat  = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(accentColor), roughness: 0.5, flatShading: true }))
    const poleMat  = track(new THREE.MeshStandardMaterial({ color: 0x8a8d78, roughness: 0.6, flatShading: true }))

    const guide = new THREE.Group()

    // Legs — each wrapped in a hip pivot group so a walk-cycle swing
    // rotates from the hip, not the leg's own center (which would look
    // like sliding in place, not walking).
    const legGeo = track(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6))
    const legPivotL = new THREE.Group()
    legPivotL.position.set(-0.16, -0.6, 0)
    const legMeshL = new THREE.Mesh(legGeo, shirtMat)
    legMeshL.position.y = -0.3
    legPivotL.add(legMeshL)
    guide.add(legPivotL)

    const legPivotR = new THREE.Group()
    legPivotR.position.set(0.16, -0.6, 0)
    const legMeshR = new THREE.Mesh(legGeo, shirtMat)
    legMeshR.position.y = -0.3
    legPivotR.add(legMeshR)
    guide.add(legPivotR)

    // Torso — a simple tapered cylinder (narrower at the shoulders),
    // the shape most low-poly mascots actually use, instead of a
    // capsule whose rounded caps read as an odd, bulging waist. Kept
    // short enough that its top sits at the collar, not the chin.
    const torsoGeo = track(new THREE.CylinderGeometry(0.24, 0.32, 0.5, 6))
    const torso = new THREE.Mesh(torsoGeo, shirtMat)
    torso.position.y = -0.28
    guide.add(torso)

    // Neck — a short bridge between the collar and the head.
    const neckGeo = track(new THREE.CylinderGeometry(0.13, 0.16, 0.14, 6))
    const neck = new THREE.Mesh(neckGeo, skinMat)
    neck.position.y = 0.02
    guide.add(neck)

    // Head — plain, low-subdivision and clean. Low-poly characters read
    // best when the polygon budget goes into a clear silhouette, not
    // into noisy per-vertex detail — so no displacement here.
    const headGeo = track(new THREE.IcosahedronGeometry(0.36, 1))
    const head = new THREE.Mesh(headGeo, skinMat)
    head.scale.set(0.9, 1.05, 0.95)
    head.position.y = 0.42
    guide.add(head)

    // Face — exactly three deliberate shapes (two eyes, one nose),
    // the minimum that reads as "a face" without cluttering the head
    // with dozens of tiny pieces.
    const eyeGeo = track(new THREE.SphereGeometry(0.045, 6, 4))
    eyeGeo.scale(1, 1, 0.6)
    const eyeMat = track(new THREE.MeshStandardMaterial({ color: 0x211a14, roughness: 0.4, flatShading: true }))
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.13, 0.46, 0.32); guide.add(eyeL)
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.13, 0.46, 0.32); guide.add(eyeR)

    const noseGeo = track(new THREE.ConeGeometry(0.045, 0.11, 4))
    const nose = new THREE.Mesh(noseGeo, skinMat)
    nose.position.set(0, 0.38, 0.35)
    nose.rotation.x = Math.PI / 2.3
    guide.add(nose)

    // Hair — a small number of large, elongated angular chunks, not
    // small round tufts. Low-poly hair is conventionally built from a
    // few flat triangular planes with a directional sweep (real
    // technique, not a guess) — a handful of little spheres just
    // reads as a cluster of circles, which is what this replaces.
    const hairChunkGeo = track(new THREE.IcosahedronGeometry(0.22, 0))
    const hairChunks = [
      // [x, y, z, scaleX, scaleY, scaleZ, rotZ]
      [0, 0.62, -0.08, 1.35, 0.85, 1.15, 0],         // main crown/back mass
      [-0.29, 0.5, 0.06, 0.8, 1.15, 0.85, -0.35],    // left side, swept down
      [0.29, 0.5, 0.06, 0.8, 1.15, 0.85, 0.35],      // right side, swept down
      [0, 0.68, 0.13, 1.0, 0.7, 0.9, 0],             // front/top, slight forward sweep
      [-0.14, 0.72, -0.06, 0.75, 0.75, 0.8, -0.2],   // crown-left fill
      [0.14, 0.72, -0.06, 0.75, 0.75, 0.8, 0.2],     // crown-right fill
    ]
    hairChunks.forEach(([x, y, z, sx, sy, sz, rz]) => {
      const chunk = new THREE.Mesh(hairChunkGeo, hairMat)
      chunk.position.set(x, y, z)
      chunk.scale.set(sx, sy, sz)
      chunk.rotation.z = rz
      guide.add(chunk)
    })

    // Light beard — a small, tight cluster on the chin/jaw, kept well
    // below the mouth line. Earlier version climbed upward toward the
    // cheeks, which traced a grin-like curve — this stays low and
    // centered so it reads as a beard, not an expression.
    const beardGeo = track(new THREE.IcosahedronGeometry(0.075, 0))
    const beardSpots = [
      [0, 0.1, 0.34, 1.05],    // chin, lowest and most forward
      [-0.09, 0.13, 0.31, 0.8],
      [0.09, 0.13, 0.31, 0.8],
      [-0.16, 0.15, 0.24, 0.65], // jaw, tucked back toward the ear — not higher than the chin
      [0.16, 0.15, 0.24, 0.65],
    ]
    beardSpots.forEach(([x, y, z, s]) => {
      const spot = new THREE.Mesh(beardGeo, beardMat)
      spot.position.set(x, y, z)
      spot.scale.setScalar(s)
      guide.add(spot)
    })

    // Raised arm holding a small tour flag.
    const armGeo = track(new THREE.CylinderGeometry(0.06, 0.075, 0.42, 6))
    const armR = new THREE.Mesh(armGeo, skinMat)
    armR.position.set(0.32, -0.02, 0)
    armR.rotation.z = -0.9
    guide.add(armR)

    const poleGeo = track(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 5))
    const pole = new THREE.Mesh(poleGeo, poleMat)
    pole.position.set(0.52, 0.35, 0)
    guide.add(pole)

    const flagGeo = track(new THREE.ConeGeometry(0.12, 0.17, 3))
    const flag = new THREE.Mesh(flagGeo, flagMat)
    flag.position.set(0.58, 0.5, 0)
    flag.rotation.z = -Math.PI / 2
    guide.add(flag)

    // Relaxed arm at side.
    const armL = new THREE.Mesh(armGeo, skinMat)
    armL.position.set(-0.32, -0.28, 0)
    armL.rotation.z = 0.15
    guide.add(armL)

    guide.rotation.y = -0.3
    scene.add(guide)

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
    const WALK_FADE_MS = 300
    const animate = () => {
      const t = clock.getElapsedTime()

      // Blend smoothly between "walking to the next exhibit" and the
      // idle scanning sway — intensity fades out over the last 300ms
      // of the walk window instead of snapping back to idle.
      const remaining = walkUntilRef.current - performance.now()
      const intensity = remaining > 0 ? Math.min(1, remaining / WALK_FADE_MS) : 0

      const walkPhase = t * 9
      const swing = Math.sin(walkPhase) * 0.5 * intensity
      legPivotL.rotation.x = swing
      legPivotR.rotation.x = -swing
      armL.rotation.x = -swing * 0.7

      const walkBob = Math.abs(Math.sin(walkPhase)) * 0.045 * intensity
      const idleBob = Math.sin(t * 1.1) * 0.03 * (1 - intensity)
      guide.position.y = walkBob + idleBob

      const idleFacing = -0.3 + Math.sin(t * 0.5) * 0.35
      const walkFacing = -0.15
      guide.rotation.y = idleFacing * (1 - intensity) + walkFacing * intensity

      // A small flag-wave motion on the raised arm, always on.
      flag.rotation.y = Math.sin(t * 2.2) * 0.25

      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
      cleanup()
    }
  }, [accentColor, size])

  return <div ref={containerRef} className="exh-guide-canvas" style={{ width: size, height: size }} aria-hidden="true" />
}
