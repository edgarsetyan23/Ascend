import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// A small, persistent low-poly guide — stylized after a real photo (dark
// curly hair, warm skin tone, dark top), holding a small magnifying glass —
// "let's take a closer look," which is what both a museum guide and a
// resume reviewer actually do. Read better here than the generic tour-
// group flag it replaced, and its lens tints with the current accent
// color instead of just being a random prop.
// Built entirely from primitive geometry: no external 3D asset, no
// attempt at a literal photorealistic likeness, just a friendly low-poly
// nod to the reference. Mounted once and kept alive across navigation —
// only the caption text (and, on the Introduction plate, its size and
// screen position) changes — so it never tears down and rebuilds its
// WebGL scene on every click. Passing a new `walkKey` (the caller
// changes it on navigation) triggers a brief walk-cycle burst so the
// guide visibly moves instead of just idling in place. Passing a new
// `celebrateKey` (the caller changes it when "Start the tour" is
// clicked) plays the same hop-and-spin as clicking him directly —
// reusing that flourish programmatically instead of a second one, so
// starting the tour reads as an event, not just a state flip.
export function TourGuide({ accentColor = '#4f7a63', size = 128, walkKey, celebrateKey }) {
  const containerRef = useRef(null)
  const walkUntilRef = useRef(0)
  const isFirstWalkKeyRef = useRef(true)
  const isFirstCelebrateKeyRef = useRef(true)
  const clickStartRef = useRef(-Infinity)

  // Nothing to "walk to" on first mount — only trigger on real changes.
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

    // Warmer and a touch more saturated than the old c99a72 — less of
    // a gray-brown, without leaning on the reference portrait's own
    // sunset-orange highlights (those are the light, not the skin).
    // roughness down slightly so the scene's existing warm key light
    // actually reads a highlight instead of going fully matte.
    // flatShading OFF specifically for skin (hair/beard/clothes/prop
    // stay faceted below) — IcosahedronGeometry/SphereGeometry/
    // ConeGeometry already compute smooth vertex normals by default,
    // so this needed no geometry changes, just letting the material
    // use those instead of the per-face flat normals flatShading
    // derives in the fragment shader. The harsh triangle-to-triangle
    // brightness jumps that caused a "dark sunken cheek" look next to
    // the nose were a shading artifact of flat-shading a curved
    // surface under a single strong key light, not a geometry
    // problem — smoothing the skin specifically (while keeping hair
    // and the rest of the body faceted for the low-poly look) fixes
    // that without touching the face's actual shape.
    const skinMat  = track(new THREE.MeshStandardMaterial({ color: 0xd9a06e, roughness: 0.55, flatShading: false }))
    // Darker, richer brown — shared by the hair AND the new beard
    // below, so the two read as one consistent hair color rather than
    // two separately-tinted systems.
    const hairMat  = track(new THREE.MeshStandardMaterial({ color: 0x4a3323, roughness: 0.82, flatShading: true }))
    const shirtMat = track(new THREE.MeshStandardMaterial({ color: 0x2e332f, roughness: 0.75, flatShading: true }))
    const lensMat  = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(accentColor), roughness: 0.25, flatShading: true, transparent: true, opacity: 0.45 }))
    const metalMat = track(new THREE.MeshStandardMaterial({ color: 0x8a8d78, roughness: 0.4, metalness: 0.3, flatShading: true }))

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
    //
    // The beard is a flat-colored region painted onto this surface via
    // a small generated texture, not built from separate overlapping
    // pieces or per-vertex/per-face colors. Two earlier approaches
    // didn't work: separate 3D pieces added silhouette bulk and read
    // as disconnected patches, and per-face vertex coloring on this
    // 80-face icosahedron was too coarse to draw a smooth boundary —
    // it came out as visible triangles no matter how the boundary math
    // was tuned. A texture has neither problem: resolution is decided
    // by the canvas, not the mesh, so the boundary can be as smooth a
    // curve as drawn.
    //
    // UV mapping is a simple orthographic front-projection from each
    // vertex's own LOCAL x/y (u ← x, v ← y) — not a proper spherical
    // unwrap, but this texture only needs to look right from roughly
    // the front, which is the only place the beard shows anyway.
    const headGeo = track(new THREE.IcosahedronGeometry(0.36, 1))
    const R = 0.36
    const posAttr = headGeo.attributes.position
    const headUVs = new Float32Array(posAttr.count * 2)
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i)
      const y = posAttr.getY(i)
      const z = posAttr.getZ(i)
      let u = 0.5 + x / (2 * R)
      let v = 0.5 - y / (2 * R)
      // Vertices on the back half of the head would otherwise get the
      // same (u, v) as a front vertex at the same x/y — which, at low
      // y, is exactly the beard's own texture coordinates. Snapping
      // anything not clearly front-facing to a fixed pixel that's
      // always skin (see the texture below) keeps the beard from
      // reappearing on the back of the head or the nape of the neck
      // when the guide turns during the celebration spin.
      if (z <= R * 0.05) { u = 0.02; v = 0.02 }
      headUVs[i * 2] = Math.min(1, Math.max(0, u))
      headUVs[i * 2 + 1] = Math.min(1, Math.max(0, v))
    }
    headGeo.setAttribute('uv', new THREE.BufferAttribute(headUVs, 2))

    // The texture itself: skin everywhere, with light stubble blended
    // in via translucent, blurred fills rather than an opaque shape —
    // a reference photo of actual short stubble (not a full beard)
    // called for this instead of a solid hair-colored region: real
    // stubble is skin showing through short hair, not a hair-colored
    // mask, and reads as see-through/soft-edged even close up.
    //
    // A diagnostic version of an earlier iteration of this texture
    // (bold solid-color rows and partial-opacity left/right tints, no
    // beard shape) was rendered onto the actual head to verify this UV
    // mapping empirically before trusting it — it caught a real bug:
    // colors meant for the top of the canvas were landing at the
    // bottom of the face. That was CanvasTexture's default
    // flipY=true fighting the V formula above; the fix is
    // `headTexture.flipY = false` below, not a change to this drawing
    // or to the UV math. That mapping is unchanged here — only what's
    // drawn onto the canvas is different.
    const texSize = 256
    const canvas = document.createElement('canvas')
    canvas.width = texSize
    canvas.height = texSize
    const tctx = canvas.getContext('2d')
    const px = (frac) => frac * texSize

    tctx.fillStyle = '#d9a06e' // matches skinMat
    tctx.fillRect(0, 0, texSize, texSize)

    // Same overall coverage area as before (sideburn → cheek → jaw →
    // chin, one curve, lowest at center so the mouth's neighborhood
    // stays clear) — only the fill itself changed, from opaque
    // hair-brown to a low-opacity, blurred wash so skin shows through.
    function stubbleRegionPath() {
      tctx.beginPath()
      tctx.moveTo(0, px(sideTop))
      for (let i = 0; i <= 48; i++) {
        const u = i / 48
        const d = Math.abs(u - 0.5) * 2
        const row = centerTop + (sideTop - centerTop) * Math.pow(d, 1.3)
        tctx.lineTo(px(u), px(row))
      }
      tctx.lineTo(texSize, texSize)
      tctx.lineTo(0, texSize)
      tctx.closePath()
    }
    const centerTop = 0.71
    const sideTop = 0.54

    // Base wash — the whole region (cheeks included), but faint enough
    // now to read as ambient shading rather than visible hair; the
    // jaw/chin/upper-lip passes below are what carry the actual
    // "this is short facial hair" definition.
    tctx.save()
    tctx.filter = 'blur(7px)'
    tctx.globalAlpha = 0.2
    tctx.fillStyle = '#8a5a3f' // between skinMat (d9a06e) and hairMat (4a3323)
    stubbleRegionPath()
    tctx.fill()
    tctx.restore()

    // A second pass restricted to the jaw/chin (the lower portion of
    // the same region) stacks on top of the base wash — raised from
    // the first version and with less blur, so this specific area
    // holds enough definition to read as stubble rather than lighting,
    // while the cheeks above stay in the faint base wash alone.
    tctx.save()
    tctx.filter = 'blur(4px)'
    tctx.globalAlpha = 0.56
    tctx.fillStyle = '#8a5a3f'
    tctx.beginPath()
    tctx.moveTo(px(0.08), px(0.86))
    tctx.quadraticCurveTo(px(0.5), px(1.02), px(0.92), px(0.86))
    tctx.lineTo(texSize, texSize)
    tctx.lineTo(0, texSize)
    tctx.closePath()
    tctx.fill()
    tctx.restore()

    // Mustache/upper lip — same treatment, also raised and slightly
    // less blurred than the base wash so it holds as a visible line of
    // stubble rather than fading into ambient shading, while staying a
    // soft-edged strip rather than a hard rectangle.
    tctx.save()
    tctx.filter = 'blur(4px)'
    tctx.globalAlpha = 0.6
    tctx.fillStyle = '#8a5a3f'
    tctx.beginPath()
    tctx.ellipse(px(0.5), px(0.615), px(0.16), px(0.028), 0, 0, Math.PI * 2)
    tctx.fill()
    tctx.restore()

    const headTexture = new THREE.CanvasTexture(canvas)
    headTexture.colorSpace = THREE.SRGBColorSpace
    // CanvasTexture defaults to flipY=true (WebGL's convention: v=0 is
    // the BOTTOM of the source image). The UV generation above assumed
    // the opposite — v=0 meaning the top row of the canvas as drawn —
    // which is what the diagnostic texture proved was backwards: the
    // color meant for the top of the canvas came out at the bottom of
    // the face. This is the one fix for that (not also inverting the
    // V formula above, which would just cancel this back out).
    headTexture.flipY = false
    // The projection only defines meaningful coordinates within [0,1]
    // for genuinely front-facing vertices; clamping (rather than
    // repeating) means anything at the very edge just holds that
    // edge's color instead of wrapping the texture onto itself.
    headTexture.wrapS = THREE.ClampToEdgeWrapping
    headTexture.wrapT = THREE.ClampToEdgeWrapping
    track({ dispose: () => headTexture.dispose() })

    const headMat = track(new THREE.MeshStandardMaterial({
      map: headTexture,
      roughness: 0.6,
      flatShading: false,
    }))
    const head = new THREE.Mesh(headGeo, headMat)
    // Slightly narrower (less round through the cheeks) and taller
    // (a longer face) than the old 0.9/1.05/0.95 — still one scaled
    // primitive, same stylized-proportions approach as before, just a
    // different scale.
    head.scale.set(0.83, 1.14, 0.92)
    head.position.y = 0.42
    guide.add(head)

    // Face — two eyes, a nose, and a mouth. A flat, slightly curved
    // sliver for the mouth (not a round shape, which reads as
    // surprise rather than a neutral/friendly expression) sitting in
    // the gap between the nose and where the beard starts, so it
    // stays clear of both instead of crowding either.
    // Slightly bigger and rounder (0.6 z-scale, up from a flatter
    // 0.6→0.72) than before — a more open, alert look rather than a
    // flattened/sleepy one.
    const eyeGeo = track(new THREE.SphereGeometry(0.048, 6, 4))
    eyeGeo.scale(1, 1, 0.72)
    const eyeMat = track(new THREE.MeshStandardMaterial({ color: 0x211a14, roughness: 0.4, flatShading: true }))
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.13, 0.46, 0.325); guide.add(eyeL)
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.13, 0.46, 0.325); guide.add(eyeR)

    // Thicker, darker brows — reuses hairMat (same dark brown as the
    // hair/beard). Kept perfectly level (no rotation): a small tilt
    // either way reads as an angle at this scale, and level is the
    // safest way to guarantee "relaxed" over "furrowed" or "sad."
    // The eye sphere's own top edge sits at eyeY + eyeRadius = 0.46 +
    // 0.048 = 0.508 — the previous brow position (also y=0.508) was
    // therefore touching the eyes, not just close to them, which is
    // what actually made them merge into one dark shape rather than
    // read as two separate features. Moved up to a real, checked gap.
    const browGeo = track(new THREE.BoxGeometry(0.1, 0.026, 0.026))
    const browL = new THREE.Mesh(browGeo, hairMat)
    browL.position.set(-0.13, 0.545, 0.332)
    guide.add(browL)
    const browR = new THREE.Mesh(browGeo, hairMat)
    browR.position.set(0.13, 0.545, 0.332)
    guide.add(browR)

    // Nose: a slimmer upper "bridge" between the eyes plus a bigger
    // tip cone — sized up from the first pass so the projection still
    // reads at the guide's actual on-page size (a couple hundred
    // pixels), not just in a close-up crop.
    const noseBridgeGeo = track(new THREE.ConeGeometry(0.035, 0.095, 4))
    const noseBridge = new THREE.Mesh(noseBridgeGeo, skinMat)
    noseBridge.position.set(0, 0.415, 0.325)
    noseBridge.rotation.x = Math.PI / 2.15
    guide.add(noseBridge)

    const noseGeo = track(new THREE.ConeGeometry(0.052, 0.125, 4))
    const nose = new THREE.Mesh(noseGeo, skinMat)
    nose.position.set(0, 0.372, 0.355)
    nose.rotation.x = Math.PI / 2.3
    guide.add(nose)

    // Two segments angled up at the OUTER ends for a slight closed-
    // mouth smile. An earlier attempt at this got the rotation signs
    // backwards — each segment's OUTER end (away from center) needs a
    // positive Y-offset for a smile; a segment at negative x needs a
    // NEGATIVE rotation.z to lift its outer (further-negative) end,
    // and a segment at positive x needs POSITIVE rotation.z for the
    // same reason (mirror image). Getting this backwards is exactly
    // what makes a smile render as a frown, so this time it's a
    // small, deliberately restrained angle (~9°) verified on the
    // actual character before treating it as done, not just reasoned
    // through on paper again.
    const mouthGeo = track(new THREE.BoxGeometry(0.044, 0.02, 0.02))
    const mouthMat = track(new THREE.MeshStandardMaterial({ color: 0x6b4632, roughness: 0.6, flatShading: true }))
    const mouthL = new THREE.Mesh(mouthGeo, mouthMat)
    mouthL.position.set(-0.021, 0.274, 0.345)
    mouthL.rotation.z = -0.16
    guide.add(mouthL)
    const mouthR = new THREE.Mesh(mouthGeo, mouthMat)
    mouthR.position.set(0.021, 0.274, 0.345)
    mouthR.rotation.z = 0.16
    guide.add(mouthR)

    // Hair — two layers, not one. Last round's "shorter cut" shrank
    // and spread out the individual angular chunks to pull the
    // silhouette in, but with nothing guaranteeing they still
    // overlapped, real gaps of bare scalp opened up between them.
    // Coverage and surface texture are two different jobs now:
    //
    // 1. A solid base cap — smoother (subdivision 1, not 0), sized
    //    and positioned to fully wrap the scalp from crown to ear
    //    level with margin to spare, checked against the head's own
    //    real geometry so there's no gap by construction, not by eye.
    const hairBaseGeo = track(new THREE.IcosahedronGeometry(0.34, 1))
    const hairBase = new THREE.Mesh(hairBaseGeo, hairMat)
    // Shifted up slightly and given a bit more vertical scale to match
    // the now-taller head (0.86/1.12/0.93, up from 0.9/1.05/0.95) —
    // this base's only job is guaranteed scalp coverage, so it just
    // needs to track the head's new size, not change shape.
    hairBase.position.set(0, 0.60, -0.04)
    hairBase.scale.set(1.0, 0.86, 0.92)
    guide.add(hairBase)

    // 2. Small angular chunks sitting proud of that base for the
    //    low-poly "chunky hair" texture. The first pass here still
    //    read as a fairly uniform dome from straight on — this one
    //    leans harder into asymmetry: a tall, forward-leaning crown
    //    mass and a distinct swept curl are the two BIGGEST pieces (so
    //    they actually dominate the silhouette instead of being a
    //    subtle addition to an otherwise-round base), sides are kept
    //    small and tucked close to the head, and no two pieces on
    //    opposite sides share a scale/position. Coverage still comes
    //    entirely from the base above, so none of this risks opening
    //    a bald patch.
    // Sized and spaced to genuinely overlap neighbor-to-neighbor (same
    // lesson as the beard below) rather than sit close enough to look
    // like separate clumps — this is what turns the silhouette into
    // one continuous swept wave instead of a bumpy cluster.
    const hairChunkGeo = track(new THREE.IcosahedronGeometry(0.15, 0))
    const hairChunks = [
      // [x, y, z, scaleX, scaleY, scaleZ, rotZ]
      [0.03, 0.79, 0.04, 1.1, 0.66, 0.85, 0.12],       // crown — off-center, not dead-center symmetric
      [-0.16, 0.72, 0.20, 0.8, 0.62, 0.68, -0.55],     // swept curl over the forehead — the dominant asymmetric feature
      [-0.21, 0.59, -0.06, 0.58, 0.5, 0.5, -0.15],     // left side — short
      [0.19, 0.57, -0.08, 0.5, 0.44, 0.46, 0.15],      // right side — short, smaller than the left (not a mirror)
      [0, 0.58, -0.24, 0.85, 0.6, 0.7, 0],             // back
    ]
    hairChunks.forEach(([x, y, z, sx, sy, sz, rz]) => {
      const chunk = new THREE.Mesh(hairChunkGeo, hairMat)
      chunk.position.set(x, y, z)
      chunk.scale.set(sx, sy, sz)
      chunk.rotation.z = rz
      guide.add(chunk)
    })

    // The beard and mustache are both part of the head texture painted
    // above now — no separate geometry at all, so neither can add
    // silhouette volume, bulge around the mouth, or read as a
    // disconnected piece stuck to the face.

    // Raised arm holding a small magnifying glass — hand, handle, grip
    // ring, and the ring+lens head are all children of the arm mesh
    // itself now, positioned in the arm's own local space (local +Y
    // runs along the cylinder, from shoulder-end at -0.21 to hand-end
    // at +0.21) instead of being independently eyeballed in world
    // space. That was the actual bug in the previous version: the
    // glass was positioned where the hand looked like it should be,
    // not where the rotated arm's endpoint actually was, so it read
    // as floating a visible gap away from the hand. Parenting to the
    // arm means the glass is now geometrically guaranteed to sit at
    // the hand and to move with the arm if its transform ever changes
    // — nothing to keep in sync by hand.
    const armGeo = track(new THREE.CylinderGeometry(0.06, 0.075, 0.42, 6))
    const armR = new THREE.Mesh(armGeo, skinMat)
    armR.position.set(0.32, -0.02, 0)
    armR.rotation.z = -0.9
    guide.add(armR)

    // Hand — a small rounded fist at the arm's actual end (local Y =
    // +0.21, i.e. the "top" of the raised cylinder), not a separate
    // guess at where that end lands in world space.
    const handGeo = track(new THREE.SphereGeometry(0.075, 7, 5))
    const hand = new THREE.Mesh(handGeo, skinMat)
    hand.position.set(0, 0.23, 0)
    armR.add(hand)

    // Handle — passes through the hand rather than starting at it:
    // its bottom end sits below the hand's center (a small nub pokes
    // out, as if gripped) and it extends up past the hand toward the
    // lens.
    const handleGeo = track(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 5))
    const handle = new THREE.Mesh(handleGeo, metalMat)
    handle.position.set(0, 0.34, 0)
    armR.add(handle)

    // A simple grip ring around the handle at the hand — reads as
    // fingers/thumb wrapped around it without modeling individual
    // digits. TorusGeometry lies flat in its local XY plane by
    // default (hole along local Z); rotating -90° about X stands the
    // hole up along local Y so it actually rings the handle instead
    // of sitting like a flat coin next to it.
    const gripGeo = track(new THREE.TorusGeometry(0.05, 0.016, 6, 10))
    const grip = new THREE.Mesh(gripGeo, skinMat)
    grip.position.set(0, 0.23, 0)
    grip.rotation.x = Math.PI / 2
    armR.add(grip)

    // Ring + lens, grouped so the waggle animation below swings them
    // together as one rigid head instead of drifting apart. Both
    // built to face +Z by default — the same direction the camera
    // looks from — but since this group is now a child of armR
    // (rotated -0.9 on Z), it needs the opposite rotation on Z here
    // to cancel that tilt back out, or the lens would read as a
    // squashed ellipse instead of a circle facing the camera.
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
    const CLICK_DURATION_MS = 750
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

      const idleFacing = -0.3 + Math.sin(t * 0.5) * 0.35
      const walkFacing = -0.15
      let facing = idleFacing * (1 - intensity) + walkFacing * intensity
      let bob = walkBob + idleBob
      let magSpeed = 2.2

      // A cute little hop-and-spin when he's clicked — layered on top
      // of whatever else is happening (idle or walking), not a
      // separate mode, so clicking him mid-walk doesn't look broken.
      const clickP = (performance.now() - clickStartRef.current) / CLICK_DURATION_MS
      if (clickP >= 0 && clickP < 1) {
        const hop = Math.sin(clickP * Math.PI) * 0.28
        bob += hop
        facing += clickP * Math.PI * 2
        magSpeed = 8
      }

      guide.position.y = bob
      guide.rotation.y = facing
      // A gentle waggle rather than the old flag's full flutter — a
      // rigid glass shouldn't swing as wide as fabric would.
      magHead.rotation.y = Math.sin(t * magSpeed) * 0.18

      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
      cleanup()
    }
  }, [accentColor, size])

  return (
    <div
      ref={containerRef}
      className="exh-guide-canvas"
      style={{ width: size, height: size, cursor: 'pointer' }}
      onClick={() => { clickStartRef.current = performance.now() }}
      role="button"
      aria-label="Say hi to the guide"
    />
  )
}
