import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createEdgarHead, EDGAR_LIKENESS } from './miniEdgarModel.js'
import { prefersReducedMotion as osPrefersReducedMotion } from '../utils/motion.js'
export function TourGuide({ accentColor = '#4f7a63', size = 128, walkKey, celebrateKey, likeness = EDGAR_LIKENESS, portrait = false, facing = -0.15, paused = false }) {
  const [unavailable, setUnavailable] = useState(false)
  const containerRef = useRef(null)
  const walkUntilRef = useRef(0)
  const isFirstWalkKeyRef = useRef(true)
  const isFirstCelebrateKeyRef = useRef(true)
  const clickStartRef = useRef(-Infinity)
  // Only the studio tool (src/studio/main.jsx) ever varies these after
  // mount, to freeze-and-inspect the model — read via refs inside the
  // scene effect below instead of listing them as deps, so dragging the
  // angle slider or toggling pause doesn't tear down and rebuild the
  // whole WebGL scene (materials + procedural head geometry) on every
  // change. RecruiterView never varies either prop.
  const facingRef = useRef(facing)
  const pausedRef = useRef(paused)
  useEffect(() => { facingRef.current = facing }, [facing])
  useEffect(() => { pausedRef.current = paused }, [paused])

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

    const prefersReducedMotion = osPrefersReducedMotion()

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setUnavailable(true)
      return
    }

    const disposables = []

    // Scene/geometry construction and the first render are wrapped too:
    // errors thrown here happen inside this effect callback, so the
    // <ErrorBoundary compact> RecruiterView wraps this component in can't
    // catch them — React boundaries only catch render/lifecycle errors,
    // never ones thrown asynchronously inside an effect. A bad likeness
    // object or a driver-specific WebGL failure would otherwise become
    // an unhandled error with no fallback UI at all.
    try {
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

      const track = (obj) => { disposables.push(obj); return obj }
      const skinMat  = track(new THREE.MeshStandardMaterial({ color: likeness.skin, roughness: 0.55, flatShading: false }))
      const shirtMat = track(new THREE.MeshStandardMaterial({ color: 0x637b69, roughness: 0.88 }))
      const pantsMat = track(new THREE.MeshStandardMaterial({ color: 0x282e38, roughness: 0.9 }))
      const teeMat = track(new THREE.MeshStandardMaterial({ color: 0xeee5d2, roughness: 0.9 }))
      const trimMat = track(new THREE.MeshStandardMaterial({ color: 0x40584b, roughness: 0.85 }))
      const soleMat = track(new THREE.MeshStandardMaterial({ color: 0xc8bfaa, roughness: 0.8 }))
      const lensMat  = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(accentColor), roughness: 0.25, flatShading: true, transparent: true, opacity: 0.45 }))
      const metalMat = track(new THREE.MeshStandardMaterial({ color: 0x8a8d78, roughness: 0.4, metalness: 0.3, flatShading: true }))

      const guide = new THREE.Group()
      const legGeo = track(new THREE.CylinderGeometry(0.115, 0.085, 0.52, 12))
      const legPivotL = new THREE.Group()
      legPivotL.position.set(-0.16, -0.6, 0)
      const legMeshL = new THREE.Mesh(legGeo, pantsMat)
      legMeshL.position.y = -0.26
      legPivotL.add(legMeshL)
      guide.add(legPivotL)

      const legPivotR = new THREE.Group()
      legPivotR.position.set(0.16, -0.6, 0)
      const legMeshR = new THREE.Mesh(legGeo, pantsMat)
      legMeshR.position.y = -0.26
      legPivotR.add(legMeshR)
      guide.add(legPivotR)
      const clothingSphere = track(new THREE.SphereGeometry(1, 20, 12))
      function clothingBox(parent, material, x, y, z, w, h, d) {
        const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), material)
        mesh.position.set(x, y, z)
        parent.add(mesh)
        return mesh
      }
      for (const leg of [legPivotL, legPivotR]) {
        const shoe = new THREE.Mesh(clothingSphere, teeMat)
        shoe.position.set(0, -0.535, 0.048)
        shoe.scale.set(0.105, 0.062, 0.165)
        leg.add(shoe)
        const sole = new THREE.Mesh(clothingSphere, soleMat)
        sole.position.set(0, -0.577, 0.05)
        sole.scale.set(0.108, 0.022, 0.169)
        leg.add(sole)
        clothingBox(leg, trimMat, 0, -0.53, 0.181, 0.15, 0.028, 0.012)
        for (let lace = 0; lace < 3; lace++) {
          clothingBox(leg, soleMat, 0, -0.476 - lace * 0.005, 0.055 + lace * 0.027, 0.08, 0.008, 0.009)
        }
      }
      const tee = new THREE.Mesh(track(new THREE.CylinderGeometry(0.304, 0.258, 0.51, 32)), teeMat)
      tee.position.y = -0.285
      guide.add(tee)
      // Leave the front open so the cream tee reads as a separate layer.
      const torsoGeo = track(new THREE.CylinderGeometry(0.32, 0.27, 0.5, 32, 1, false, 0.32, Math.PI * 2 - 0.64))
      const torso = new THREE.Mesh(torsoGeo, shirtMat)
      torso.position.y = -0.28
      guide.add(torso)
      for (const side of [-1, 1]) {
        const collar = clothingBox(guide, trimMat, side * 0.105, -0.092, 0.287, 0.085, 0.14, 0.025)
        collar.rotation.z = side * -0.35
        const pocket = clothingBox(guide, shirtMat, side * 0.195, -0.25, 0.237, 0.10, 0.11, 0.026)
        pocket.rotation.y = side * 0.65
        const flap = clothingBox(guide, trimMat, side * 0.197, -0.205, 0.246, 0.105, 0.025, 0.018)
        flap.rotation.y = side * 0.65
        for (let button = 0; button < 3; button++) {
          const stud = new THREE.Mesh(clothingSphere, soleMat)
          stud.position.set(side * (0.103 - button * 0.009), -0.23 - button * 0.105, 0.299 - button * 0.01)
          stud.scale.setScalar(0.009)
          guide.add(stud)
        }
      }
      const waistband = new THREE.Mesh(track(new THREE.CylinderGeometry(0.256, 0.251, 0.095, 24)), pantsMat)
      waistband.position.y = -0.555
      guide.add(waistband)
      const neckGeo = track(new THREE.CylinderGeometry(0.13, 0.16, 0.14, 6))
      const neck = new THREE.Mesh(neckGeo, skinMat)
      neck.position.y = 0.02
      guide.add(neck)

      guide.add(createEdgarHead(track, likeness))
      // A relaxed upper arm and raised forearm make the elbow readable.
      // Build between joint positions so the sleeve, elbow and wrist meet.
      const shoulder = new THREE.Vector3(0.29, -0.105, 0)
      const elbow = new THREE.Vector3(0.47, -0.35, 0.055)
      const wrist = new THREE.Vector3(0.57, -0.045, 0.15)
      const jointGeo = track(new THREE.SphereGeometry(1, 16, 12))
      function armSegment(start, end, startRadius, endRadius, material, parent = guide) {
        const direction = new THREE.Vector3().subVectors(end, start)
        const mesh = new THREE.Mesh(track(new THREE.CylinderGeometry(endRadius, startRadius, direction.length(), 16)), material)
        mesh.position.copy(start).add(end).multiplyScalar(0.5)
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
        parent.add(mesh)
      }
      armSegment(shoulder, elbow, 0.078, 0.061, skinMat)
      armSegment(shoulder, shoulder.clone().lerp(elbow, 0.48), 0.105, 0.086, shirtMat)
      const elbowJoint = new THREE.Mesh(jointGeo, skinMat)
      elbowJoint.position.copy(elbow)
      elbowJoint.scale.set(0.064, 0.065, 0.064)
      guide.add(elbowJoint)
      armSegment(elbow, wrist, 0.061, 0.043, skinMat)

      // Fingers and glass share a wrist pivot; the lens never swivels
      // independently of its handle or slips out of the grip.
      const holdingHand = new THREE.Group()
      holdingHand.position.copy(wrist)
      holdingHand.rotation.z = -0.12
      guide.add(holdingHand)
      const palm = new THREE.Mesh(jointGeo, skinMat)
      palm.position.set(-0.008, 0.025, -0.008)
      palm.scale.set(0.052, 0.065, 0.035)
      holdingHand.add(palm)
      const handleGeo = track(new THREE.CylinderGeometry(0.019, 0.024, 0.23, 12))
      const handle = new THREE.Mesh(handleGeo, metalMat)
      handle.position.set(0.015, 0.065, 0.028)
      holdingHand.add(handle)
      for (let finger = 0; finger < 3; finger++) {
        const knuckle = new THREE.Mesh(jointGeo, skinMat)
        knuckle.position.set(0.02, -0.005 + finger * 0.028, 0.048)
        knuckle.scale.set(0.036, 0.017, 0.024)
        holdingHand.add(knuckle)
      }
      const thumb = new THREE.Mesh(jointGeo, skinMat)
      thumb.position.set(-0.018, 0.052, 0.05)
      thumb.scale.set(0.023, 0.041, 0.025)
      thumb.rotation.z = -0.5
      holdingHand.add(thumb)
      const magHead = new THREE.Group()
      const ringGeo = track(new THREE.TorusGeometry(0.12, 0.017, 10, 32))
      const ring = new THREE.Mesh(ringGeo, metalMat)
      magHead.add(ring)
      const lensGeo = track(new THREE.CircleGeometry(0.105, 32))
      const lens = new THREE.Mesh(lensGeo, lensMat)
      lens.position.z = -0.006
      magHead.add(lens)
      magHead.position.set(0.015, 0.292, 0.028)
      holdingHand.add(magHead)
      // The free arm hangs from a shoulder pivot, with a slight elbow
      // bend and a relaxed hand. Its full silhouette swings together.
      const armL = new THREE.Group()
      armL.position.set(-0.29, -0.105, 0)
      guide.add(armL)
      const freeShoulder = new THREE.Vector3(0, 0, 0)
      const freeElbow = new THREE.Vector3(-0.095, -0.245, 0.025)
      const freeWrist = new THREE.Vector3(-0.105, -0.465, 0.075)
      armSegment(freeShoulder, freeElbow, 0.078, 0.061, skinMat, armL)
      armSegment(freeShoulder, freeShoulder.clone().lerp(freeElbow, 0.48), 0.105, 0.086, shirtMat, armL)
      const freeElbowJoint = new THREE.Mesh(jointGeo, skinMat)
      freeElbowJoint.position.copy(freeElbow)
      freeElbowJoint.scale.set(0.062, 0.064, 0.062)
      armL.add(freeElbowJoint)
      armSegment(freeElbow, freeWrist, 0.061, 0.037, skinMat, armL)
      const freeHand = new THREE.Group()
      freeHand.position.copy(freeWrist)
      freeHand.rotation.x = -0.1
      armL.add(freeHand)
      const freePalm = new THREE.Mesh(jointGeo, skinMat)
      freePalm.position.set(0, -0.038, 0)
      freePalm.scale.set(0.045, 0.058, 0.028)
      freeHand.add(freePalm)
      for (let finger = 0; finger < 4; finger++) {
        const fingertip = new THREE.Mesh(jointGeo, skinMat)
        fingertip.position.set(-0.029 + finger * 0.019, -0.075 - Math.sin(finger * Math.PI / 3) * 0.01, 0.008)
        fingertip.scale.set(0.012, 0.032, 0.015)
        freeHand.add(fingertip)
      }
      const freeThumb = new THREE.Mesh(jointGeo, skinMat)
      freeThumb.position.set(0.042, -0.032, 0.014)
      freeThumb.scale.set(0.018, 0.033, 0.019)
      freeThumb.rotation.z = 0.35
      freeHand.add(freeThumb)

      guide.rotation.y = facingRef.current
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
      const CLICK_DURATION_MS = 750
      const animate = () => {
        // Paused (studio tool only): hold the pose, still honoring live
        // facing changes so the angle slider works while paused, but
        // skip the walk/idle motion math entirely.
        if (pausedRef.current) {
          guide.rotation.y = facingRef.current
          renderer.render(scene, camera)
          frameId = requestAnimationFrame(animate)
          return
        }

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
        holdingHand.rotation.y = Math.sin(t * magSpeed) * 0.1

        renderer.render(scene, camera)
        frameId = requestAnimationFrame(animate)
      }
      frameId = requestAnimationFrame(animate)

      return () => {
        cancelAnimationFrame(frameId)
        cleanup()
      }
    } catch (err) {
      console.error('Mini Edgar scene failed to build:', err)
      disposables.forEach((d) => { try { d.dispose() } catch { /* already gone */ } })
      try { renderer.dispose() } catch { /* already gone */ }
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement)
      setUnavailable(true)
      return
    }
  }, [accentColor, size, likeness, portrait])

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
