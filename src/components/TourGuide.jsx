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

    // Torso
    const torsoGeo = track(new THREE.CapsuleGeometry(0.42, 0.5, 2, 8))
    const torso = new THREE.Mesh(torsoGeo, shirtMat)
    torso.position.y = -0.28
    guide.add(torso)

    // Head
    const headGeo = track(new THREE.IcosahedronGeometry(0.36, 1))
    const head = new THREE.Mesh(headGeo, skinMat)
    head.scale.set(0.9, 1.05, 0.95)
    head.position.y = 0.42
    guide.add(head)

    // Curly hair — a cluster of small bumpy spheres over the top/sides.
    const hairBumpGeo = track(new THREE.IcosahedronGeometry(0.12, 0))
    const hairPositions = [
      [0, 0.66, 0], [-0.2, 0.6, 0.1], [0.2, 0.6, 0.1], [-0.28, 0.5, -0.1],
      [0.28, 0.5, -0.1], [0, 0.62, -0.22], [-0.1, 0.58, 0.22], [0.1, 0.58, 0.22],
    ]
    hairPositions.forEach(([x, y, z]) => {
      const bump = new THREE.Mesh(hairBumpGeo, hairMat)
      bump.position.set(x, y, z)
      guide.add(bump)
    })

    // Light beard — a small, subtle patch on the lower face, lighter
    // than the hair rather than a full dark wedge.
    const beardGeo = track(new THREE.ConeGeometry(0.19, 0.19, 6))
    const beard = new THREE.Mesh(beardGeo, beardMat)
    beard.position.set(0, 0.22, 0.17)
    beard.rotation.x = Math.PI
    guide.add(beard)

    // Raised arm holding a small tour flag.
    const armGeo = track(new THREE.CylinderGeometry(0.075, 0.09, 0.55, 6))
    const armR = new THREE.Mesh(armGeo, skinMat)
    armR.position.set(0.42, 0.05, 0)
    armR.rotation.z = -0.9
    guide.add(armR)

    const poleGeo = track(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5))
    const pole = new THREE.Mesh(poleGeo, poleMat)
    pole.position.set(0.68, 0.55, 0)
    guide.add(pole)

    const flagGeo = track(new THREE.ConeGeometry(0.14, 0.2, 3))
    const flag = new THREE.Mesh(flagGeo, flagMat)
    flag.position.set(0.76, 0.72, 0)
    flag.rotation.z = -Math.PI / 2
    guide.add(flag)

    // Relaxed arm at side.
    const armL = new THREE.Mesh(armGeo, skinMat)
    armL.position.set(-0.42, -0.2, 0)
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
