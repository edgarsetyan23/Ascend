import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// A small, genuinely 3D piece — a stylized low-poly bust wearing a laurel
// wreath, slowly turning like something on a plinth in a gallery. Built
// entirely from primitive geometry (no downloaded/licensed 3D asset, so
// nothing to attribute or worry about the rights to). The laurel wreath
// picks up the page's accent color; the bust itself reads as pale stone.
export function ExhibitPiece({ accentColor = '#4f7a63', stoneColor = '#ece6d6', size = 240 }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      // No WebGL available — skip silently rather than break the page.
      return
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(size, size)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(0, 0.55, 4.6)
    camera.lookAt(0, 0.35, 0)

    // Soft "gallery spotlight" lighting — one warm key light, one cool
    // fill, and ambient so facets read clearly without harsh shadows.
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xfff4e6, 1.15)
    key.position.set(2.5, 3, 2)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xcfe8ff, 0.35)
    fill.position.set(-2, -1, 1.5)
    scene.add(fill)

    const disposables = []
    const track = (obj) => { disposables.push(obj); return obj }

    const stoneMat = track(new THREE.MeshStandardMaterial({
      color: new THREE.Color(stoneColor), roughness: 0.7, metalness: 0.04, flatShading: true,
    }))
    const baseMat = track(new THREE.MeshStandardMaterial({
      color: new THREE.Color(stoneColor).multiplyScalar(0.85), roughness: 0.8, metalness: 0.02, flatShading: true,
    }))
    const leafMat = track(new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor), roughness: 0.5, metalness: 0.1, flatShading: true,
    }))

    const bust = new THREE.Group()

    // Plinth
    const baseGeo = track(new THREE.CylinderGeometry(0.62, 0.68, 0.16, 16))
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = -0.72
    bust.add(base)

    // Shoulders / chest — a classical bust cutoff, wide at the base,
    // tapering up toward the neck.
    const chestGeo = track(new THREE.CylinderGeometry(0.5, 0.82, 0.95, 8, 1))
    const chest = new THREE.Mesh(chestGeo, stoneMat)
    chest.position.y = -0.15
    bust.add(chest)

    // Neck
    const neckGeo = track(new THREE.CylinderGeometry(0.22, 0.28, 0.32, 8))
    const neck = new THREE.Mesh(neckGeo, stoneMat)
    neck.position.y = 0.42
    bust.add(neck)

    // Head — low-poly, flat-shaded, matches the faceted aesthetic
    // used throughout the rest of the page.
    const headGeo = track(new THREE.IcosahedronGeometry(0.52, 1))
    const head = new THREE.Mesh(headGeo, stoneMat)
    head.scale.set(0.92, 1.08, 0.98)
    head.position.y = 1.02
    bust.add(head)

    // Laurel wreath — a ring of small flat leaf blades around the head.
    const leafGeo = track(new THREE.ConeGeometry(0.045, 0.22, 4))
    leafGeo.scale(1, 1, 0.3)
    const leafCount = 18
    const wreathY = 1.05
    const wreathRadius = 0.56
    for (let i = 0; i < leafCount; i++) {
      const angle = (i / leafCount) * Math.PI * 2
      const leaf = new THREE.Mesh(leafGeo, leafMat)
      leaf.position.set(
        Math.cos(angle) * wreathRadius,
        wreathY + Math.sin(angle * 3) * 0.03,
        Math.sin(angle) * wreathRadius
      )
      leaf.rotation.y = -angle + Math.PI / 2
      leaf.rotation.z = Math.PI / 2.3
      leaf.rotation.x = 0.3
      bust.add(leaf)
    }

    bust.rotation.y = 0.5
    scene.add(bust)

    renderer.render(scene, camera)

    const cleanup = () => {
      renderer.dispose()
      disposables.forEach((d) => d.dispose())
      container.removeChild(renderer.domElement)
    }

    if (prefersReducedMotion) {
      // Static piece — one rendered frame, no rotation loop.
      return cleanup
    }

    let frameId
    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      bust.rotation.y = 0.5 + t * 0.26
      bust.position.y = Math.sin(t * 0.7) * 0.04
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
      cleanup()
    }
  }, [accentColor, stoneColor, size])

  return <div ref={containerRef} className="exh-piece" style={{ width: size, height: size }} aria-hidden="true" />
}
