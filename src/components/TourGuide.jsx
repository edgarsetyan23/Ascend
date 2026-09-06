import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createEdgarHead, EDGAR_LIKENESS } from './miniEdgarModel.js'
export function TourGuide({ accentColor = '#4f7a63', size = 128, walkKey, celebrateKey, likeness = EDGAR_LIKENESS, portrait = false, facing = -0.15, paused = false }) {
  const [unavailable, setUnavailable] = useState(false)
  const containerRef = useRef(null)
  const walkUntilRef = useRef(0)
  const isFirstWalkKeyRef = useRef(true)
  const isFirstCelebrateKeyRef = useRef(true)
  const clickStartRef = useRef(-Infinity)
  useEffect(() => {
    if (isFirstWalkKeyRef.current) { isFirstWalkKeyRef.current = false; return }
    walkUntilRef.current = performance.now() + 1100
  }, [walkKey])

  useEffect(() => {
    if (isFirstCelebrateKeyRef.current) { isFirstCelebrateKeyRef.current = false; return }
    clickStartRef.current = performance.now()
  }, [celebrateKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setUnavailable(true)
      return
    }
    setUnavailable(false)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(size, size)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 0.35, 5.4)
    camera.lookAt(0, 0.2, 0)
    if (portrait) {
      camera.position.set(0, 0.47, 2.25)
      camera.lookAt(0, 0.47, 0)
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const key = new THREE.DirectionalLight(0xfff4e6, 1.1)
    key.position.set(2, 3, 2.5)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xcfe8ff, 0.3)
    fill.position.set(-2, -1, 1.5)
    scene.add(fill)

    const disposables = []
    const track = (obj) => { disposables.push(obj); return obj }
    const skinMat  = track(new THREE.MeshStandardMaterial({ color: likeness.skin, roughness: 0.55, flatShading: false }))
    const shirtMat = track(new THREE.MeshStandardMaterial({ color: 0x202226, roughness: 0.75, flatShading: true }))
    const lensMat  = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(accentColor), roughness: 0.25, flatShading: true, transparent: true, opacity: 0.45 }))
    const metalMat = track(new THREE.MeshStandardMaterial({ color: 0x8a8d78, roughness: 0.4, metalness: 0.3, flatShading: true }))

    const guide = new THREE.Group()
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
    const torsoGeo = track(new THREE.CylinderGeometry(0.32, 0.27, 0.5, 12))
    const torso = new THREE.Mesh(torsoGeo, shirtMat)
    torso.position.y = -0.28
    guide.add(torso)
    const neckGeo = track(new THREE.CylinderGeometry(0.13, 0.16, 0.14, 6))
    const neck = new THREE.Mesh(neckGeo, skinMat)
    neck.position.y = 0.02
    guide.add(neck)

    guide.add(createEdgarHead(track, likeness))
    const armGeo = track(new THREE.CylinderGeometry(0.06, 0.075, 0.42, 6))
    const armR = new THREE.Mesh(armGeo, skinMat)
    armR.position.set(0.32, -0.02, 0)
    armR.rotation.z = -0.9
    guide.add(armR)
    const handGeo = track(new THREE.SphereGeometry(0.075, 7, 5))
    const hand = new THREE.Mesh(handGeo, skinMat)
    hand.position.set(0, 0.23, 0)
    armR.add(hand)
    const handleGeo = track(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 5))
    const handle = new THREE.Mesh(handleGeo, metalMat)
    handle.position.set(0, 0.34, 0)
    armR.add(handle)
    const gripGeo = track(new THREE.TorusGeometry(0.05, 0.016, 6, 10))
    const grip = new THREE.Mesh(gripGeo, skinMat)
    grip.position.set(0, 0.23, 0)
    grip.rotation.x = Math.PI / 2
    armR.add(grip)
    const magHead = new THREE.Group()
    const ringGeo = track(new THREE.TorusGeometry(0.09, 0.018, 6, 12))
    const ring = new THREE.Mesh(ringGeo, metalMat)
    magHead.add(ring)
    const lensGeo = track(new THREE.CircleGeometry(0.078, 10))
    const lens = new THREE.Mesh(lensGeo, lensMat)
    lens.position.z = -0.006
    magHead.add(lens)
    magHead.position.set(0, 0.6, 0)
    magHead.rotation.z = 0.9
    armR.add(magHead)
    const armL = new THREE.Mesh(armGeo, skinMat)
    armL.position.set(-0.32, -0.28, 0)
    armL.rotation.z = 0.15
    guide.add(armL)

    guide.rotation.y = facing
    scene.add(guide)

    renderer.render(scene, camera)

    const cleanup = () => {
      renderer.dispose()
      disposables.forEach((d) => d.dispose())
      container.removeChild(renderer.domElement)
    }

    if (prefersReducedMotion || paused) {
      return cleanup
    }

    let frameId
    const clock = new THREE.Clock()
    const WALK_FADE_MS = 300
    const CLICK_DURATION_MS = 750
    const animate = () => {
      const t = clock.getElapsedTime()
      const remaining = walkUntilRef.current - performance.now()
      const intensity = remaining > 0 ? Math.min(1, remaining / WALK_FADE_MS) : 0

      const walkPhase = t * 9
      const swing = Math.sin(walkPhase) * 0.5 * intensity
      legPivotL.rotation.x = swing
      legPivotR.rotation.x = -swing
      armL.rotation.x = -swing * 0.7

      const walkBob = Math.abs(Math.sin(walkPhase)) * 0.045 * intensity
      const idleBob = Math.sin(t * 1.1) * 0.03 * (1 - intensity)

      const idleFacing = -0.15 + Math.sin(t * 0.5) * 0.12
      const walkFacing = -0.15
      let facing = idleFacing * (1 - intensity) + walkFacing * intensity
      let bob = walkBob + idleBob
      let magSpeed = 2.2
      const clickP = (performance.now() - clickStartRef.current) / CLICK_DURATION_MS
      if (clickP >= 0 && clickP < 1) {
        const hop = Math.sin(clickP * Math.PI) * 0.28
        bob += hop
        facing += clickP * Math.PI * 2
        magSpeed = 8
      }

      guide.position.y = bob
      guide.rotation.y = facing
      magHead.rotation.y = Math.sin(t * magSpeed) * 0.18

      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
      cleanup()
    }
  }, [accentColor, size, likeness, portrait, facing, paused])

  return (
    <div
      ref={containerRef}
      className="exh-guide-canvas"
      style={{ width: size, height: size, cursor: 'pointer' }}
      onClick={() => { clickStartRef.current = performance.now() }}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          clickStartRef.current = performance.now()
        }
      }}
      role="button"
      aria-label="Say hi to Mini Edgar"
    >
      {unavailable && <span role="status">Mini Edgar needs WebGL to display.</span>}
    </div>
  )
}
