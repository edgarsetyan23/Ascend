import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Deterministic PRNG (mulberry32) so the sculpted noise on the head/hair
// and the beard-strand layout are stable across remounts instead of
// reshuffling every time the page reloads.
function seededRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Displaces every vertex of a geometry outward/inward along its own
// direction from the origin by a small random amount — turns a clean
// icosahedron into an irregular, hand-chiseled-looking faceted lump,
// closer to a sculpted low-poly bust than a perfect gemstone.
function roughen(geometry, amount, seed) {
  const pos = geometry.attributes.position
  const rand = seededRandom(seed)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const dir = v.clone().normalize()
    v.addScaledVector(dir, (rand() - 0.5) * amount)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

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

    // Torso — kept short enough that its top sits at the collar, not
    // the chin, so the neck/jaw/beard actually stay visible above it.
    const torsoGeo = track(new THREE.CapsuleGeometry(0.32, 0.1, 2, 8))
    const torso = new THREE.Mesh(torsoGeo, shirtMat)
    torso.position.y = -0.35
    guide.add(torso)

    // Neck — a short bridge between the collar and the head.
    const neckGeo = track(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 6))
    const neck = new THREE.Mesh(neckGeo, skinMat)
    neck.position.y = 0.02
    guide.add(neck)

    // Head — a chiselled, irregular faceted form rather than a clean
    // gemstone: more subdivision than the rest of the body, then every
    // vertex nudged along its own normal so the facets read as sculpted,
    // not procedural-perfect.
    const headGeo = track(roughen(new THREE.IcosahedronGeometry(0.36, 2), 0.05, 11))
    const head = new THREE.Mesh(headGeo, skinMat)
    head.scale.set(0.9, 1.08, 0.95)
    head.position.y = 0.42
    guide.add(head)

    // Curly hair — a slightly larger, similarly roughened shell capping
    // the top/back of the head (not the face), so it reads as one
    // continuous sculpted mass instead of pom-poms stuck on top.
    const hairGeo = track(roughen(new THREE.IcosahedronGeometry(0.39, 2), 0.06, 23))
    const hair = new THREE.Mesh(hairGeo, hairMat)
    hair.scale.set(0.94, 0.62, 0.98)
    hair.position.set(0, 0.55, -0.03)
    guide.add(hair)

    // Beard — dozens of thin angular blades anchored along the jaw/chin
    // arc, longer and lower at the chin, shorter toward the ears, each
    // with a little rotational jitter for an organic, cascading look.
    const beardGroup = new THREE.Group()
    const strandGeo = track(new THREE.ConeGeometry(0.045, 1, 3))
    strandGeo.translate(0, 0.5, 0) // pivot at the base, tip points toward +Y
    strandGeo.scale(1, 1, 0.3)     // flatten into a blade
    const strandRand = seededRandom(31)
    const strandCount = 26
    for (let i = 0; i < strandCount; i++) {
      const t = i / (strandCount - 1)              // 0 (left ear) → 1 (right ear)
      const angle = -1.3 + t * 2.6                  // sweep across the front of the jaw
      const dip = Math.sin(t * Math.PI)              // 0 at the ears, 1 at the chin
      const jawRadius = 0.3
      const baseX = Math.sin(angle) * jawRadius
      const baseZ = Math.cos(angle) * jawRadius * 0.85 + 0.08
      const baseY = 0.14 - dip * 0.1
      const length = 0.14 + dip * 0.24 + strandRand() * 0.06

      const strand = new THREE.Mesh(strandGeo, beardMat)
      strand.position.set(baseX, baseY, baseZ)
      strand.scale.set(0.8 + strandRand() * 0.5, length, 0.8 + strandRand() * 0.5)
      // Point the blade outward-and-down from its jaw anchor, with a
      // little per-strand jitter so it doesn't look like a fan.
      strand.rotation.x = Math.PI - 0.35 + strandRand() * 0.3
      strand.rotation.y = angle + (strandRand() - 0.5) * 0.4
      strand.rotation.z = (strandRand() - 0.5) * 0.3
      beardGroup.add(strand)
    }
    guide.add(beardGroup)

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
