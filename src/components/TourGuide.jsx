import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// A small, persistent low-poly guide — stylized after a real photo (dark
// curly hair, beard, warm skin tone, dark top), holding a little tour flag.
// Built entirely from primitive geometry: no external 3D asset, no
// attempt at a literal photorealistic likeness, just a friendly low-poly
// nod to the reference. Mounted once and kept alive across navigation —
// only the caption text changes per section — so it never tears down and
// rebuilds its WebGL scene on every click.
export function TourGuide({ accentColor = '#4f7a63', size = 128 }) {
  const containerRef = useRef(null)

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

    // Legs
    const legGeo = track(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6))
    const legL = new THREE.Mesh(legGeo, shirtMat); legL.position.set(-0.16, -0.9, 0); guide.add(legL)
    const legR = new THREE.Mesh(legGeo, shirtMat); legR.position.set(0.16, -0.9, 0); guide.add(legR)

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

    // Hair — one simple low-poly cap over the top/back of the head,
    // not a second noisy sculpted shell.
    const hairGeo = track(new THREE.IcosahedronGeometry(0.39, 0))
    const hair = new THREE.Mesh(hairGeo, hairMat)
    hair.scale.set(0.95, 0.6, 0.98)
    hair.position.set(0, 0.56, -0.02)
    guide.add(hair)

    // Light beard — a handful of chunky, deliberately placed facets
    // along the jaw/chin, not dozens of thin strands. Reads as "a
    // beard" from the silhouette without becoming visual noise.
    const beardGeo = track(new THREE.IcosahedronGeometry(0.09, 0))
    const beardSpots = [
      [0, 0.16, 0.33, 1.1],   // chin
      [-0.14, 0.22, 0.29, 0.85],
      [0.14, 0.22, 0.29, 0.85],
      [-0.22, 0.3, 0.2, 0.7],
      [0.22, 0.3, 0.2, 0.7],
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
    const animate = () => {
      const t = clock.getElapsedTime()
      // Gentle idle sway — scanning the room, not spinning like an
      // exhibit. A small flag-wave motion on the raised arm.
      guide.rotation.y = -0.3 + Math.sin(t * 0.5) * 0.35
      guide.position.y = Math.sin(t * 1.1) * 0.03
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
