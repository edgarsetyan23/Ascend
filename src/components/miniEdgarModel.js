import * as THREE from 'three'
import likeness from './edgar-likeness.json'

// Portrait-based proportions. The unseen side/back remain artistic approximations.
export const EDGAR_LIKENESS = Object.freeze(likeness)

export function createEdgarHead(track, settings = EDGAR_LIKENESS) {
  const p = { ...EDGAR_LIKENESS, ...settings }
  const group = new THREE.Group()
  const skin = track(new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.82 }))
  const hair = track(new THREE.MeshStandardMaterial({ color: p.hair, roughness: 0.95 }))
  const lips = track(new THREE.MeshStandardMaterial({ color: '#a57770', roughness: 0.9 }))
  const dark = track(new THREE.MeshStandardMaterial({ color: '#35342d', roughness: 0.8 }))
  const white = track(new THREE.MeshStandardMaterial({ color: '#ded5c7', roughness: 0.75 }))
  const iris = track(new THREE.MeshStandardMaterial({ color: '#626657', roughness: 0.65 }))
  const pupil = track(new THREE.MeshStandardMaterial({ color: '#202520', roughness: 0.5 }))
  const glint = track(new THREE.MeshBasicMaterial({ color: '#eee9df' }))
  const nostril = track(new THREE.MeshStandardMaterial({ color: '#846457', roughness: 1 }))
  const sphere = track(new THREE.SphereGeometry(1, 24, 16))
  function ellipsoid(material, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(sphere, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, sy, sz)
    group.add(mesh)
    return mesh
  }
  function curve(points, radius, material) {
    const path = new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v)))
    const mesh = new THREE.Mesh(track(new THREE.TubeGeometry(path, 20, radius, 6, false)), material)
    group.add(mesh)
    return mesh
  }

  // Controlled cheek/jaw rings preserve the lower face's width instead of
  // narrowing to the point of the old low-subdivision icosahedron.
  const rings = [
    [0.055, 0.01, 0.01], [0.075, 0.11, 0.13], [0.12, 0.19, 0.20],
    [0.21, 0.245, 0.245], [0.36, 0.28, 0.278], [0.48, 0.275, 0.27],
    [0.60, 0.265, 0.25], [0.70, 0.25, 0.22], [0.78, 0.18, 0.15], [0.81, 0.01, 0.01],
  ]
  const positions = [], colors = [], indices = []
  const base = new THREE.Color(p.skin), beard = new THREE.Color(p.hair).lerp(new THREE.Color('#705544'), 0.22)
  const segments = 128, rows = 128
  const profile = new THREE.CatmullRomCurve3(rings.map(([y, w, d]) => new THREE.Vector3(w, y, d)))
  const hairlineAt = angle => {
    const front = Math.max(0, Math.cos(angle))
    const lock = Math.exp(-(((Math.sin(angle) + 0.3) / 0.28) ** 2)) * front ** 5
    return 0.43 + 0.235 * front - 0.052 * lock
  }
  for (let row = 0; row <= rows; row++) {
    const ring = profile.getPoint(row / rows)
    for (let col = 0; col <= segments; col++) {
      const angle = col / segments * Math.PI * 2, front = Math.cos(angle)
      const jaw = 1 + (p.jawWidth - 1) * (1 - THREE.MathUtils.smoothstep(ring.y, 0.2, 0.4))
      const x = Math.sin(angle) * ring.x * jaw
      // Blend the bridge, tip and nostril wings into the face surface.
      const gaussian = (cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - ((ring.y - cy) / sy) ** 2)
      const nose = front > 0 ? (
        0.041 * gaussian(0, 0.423, 0.035 * p.noseWidth, 0.105)
        + 0.048 * gaussian(0, 0.353, 0.043 * p.noseWidth, 0.033)
        + 0.014 * gaussian(-0.038 * p.noseWidth, 0.337, 0.018, 0.018)
        + 0.014 * gaussian(0.038 * p.noseWidth, 0.337, 0.018, 0.018)
      ) : 0
      // Connected cheek beard, chin, sideburns and mustache from the latest portrait.
      // Color and a slight surface expansion keep it attached to the actual face.
      const side = Math.abs(Math.sin(angle))
      const edge = 0.208 + 0.19 * side ** 1.5 + 0.055 * side ** 10
      const frontMask = THREE.MathUtils.smoothstep(front, -0.14, 0.16)
      const jawBeard = THREE.MathUtils.smoothstep(edge - ring.y, -0.025, 0.065) * frontMask
      const mustache = gaussian(0, 0.293, 0.092, 0.023) * Math.max(0, front) ** 8
      const connector = gaussian(-0.089, 0.259, 0.025, 0.045) + gaussian(0.089, 0.259, 0.025, 0.045)
      const soulPatch = gaussian(0, 0.214, 0.033, 0.024)
      const coverage = Math.min(1, Math.max(jawBeard, mustache, (connector + soulPatch) * Math.max(0, front))) * p.beardDensity
      const grain = Math.abs(Math.sin(row * 127.1 + col * 311.7) * 43758.5453) % 1
      const bulk = coverage * 0.003
      positions.push(x + Math.sin(angle) * bulk, ring.y, front * (ring.z + bulk) + nose)
      const color = base.clone().lerp(beard, coverage * (0.4 + grain * 0.6))
      // The scalp itself has hair color above the shared hairline. Even at
      // minimum hair height, it cannot show a skin-colored patch through the cap.
      if (ring.y >= hairlineAt(angle)) color.set(p.hair)
      colors.push(color.r, color.g, color.b)
      if (row < rows && col < segments) {
        const a = row * (segments + 1) + col, b = a + segments + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geometry = track(new THREE.BufferGeometry())
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // The front UV seam duplicates vertices. Average its normals to remove the
  // hard vertical line through the nose and forehead under directional lighting.
  const normals = geometry.attributes.normal
  for (let row = 0; row <= rows; row++) {
    const a = row * (segments + 1), b = a + segments
    const normal = new THREE.Vector3().fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize()
    normals.setXYZ(a, normal.x, normal.y, normal.z)
    normals.setXYZ(b, normal.x, normal.y, normal.z)
  }
  group.add(new THREE.Mesh(geometry, track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }))))

  for (const side of [-1, 1]) {
    ellipsoid(skin, side * 0.278, 0.395, -0.005, 0.046, 0.084, 0.039)
    const x = side * 0.115 * p.eyeSpacing
    // A shallow almond surface keeps the whites inside the lids, rather than
    // exposing a round eyeball. The outer corner rises slightly as in the photo.
    const eyePositions = [x, 0.46, 0.282], eyeIndices = []
    for (let i = 0; i <= 48; i++) {
      const angle = i / 48 * Math.PI * 2
      const u = Math.cos(angle), v = Math.sin(angle)
      eyePositions.push(x + u * 0.058,
        0.46 + v * (v > 0 ? 0.021 : 0.015) + side * u * 0.004,
        0.255 + (1 - u * u) * 0.016)
      if (i < 48) eyeIndices.push(0, i + 1, i + 2)
    }
    const eye = track(new THREE.BufferGeometry())
    eye.setAttribute('position', new THREE.Float32BufferAttribute(eyePositions, 3))
    eye.setIndex(eyeIndices)
    eye.computeVertexNormals()
    group.add(new THREE.Mesh(eye, white))
    ellipsoid(iris, x, 0.461, 0.28, 0.018, 0.018, 0.004)
    ellipsoid(pupil, x, 0.461, 0.284, 0.009, 0.011, 0.002)
    ellipsoid(glint, x - 0.005, 0.467, 0.286, 0.003, 0.003, 0.001)
    curve([[x - 0.058, 0.46 - side * 0.004, 0.255], [x, 0.482, 0.273], [x + 0.058, 0.46 + side * 0.004, 0.255]], 0.007, skin)
    curve([[x - 0.057, 0.46 - side * 0.004, 0.255], [x, 0.444, 0.273], [x + 0.057, 0.46 + side * 0.004, 0.255]], 0.004, skin)
    curve([[x - 0.059, 0.532, 0.244], [x, 0.54, 0.259], [x + 0.059, 0.532, 0.244]], 0.011, hair)
  }
  for (const side of [-1, 1]) {
    ellipsoid(nostril, side * 0.03 * p.noseWidth, 0.333, 0.305, 0.009, 0.004, 0.002)
  }
  curve([[-0.087, 0.269, 0.238], [-0.038, 0.259, 0.259], [0, 0.255, 0.266], [0.038, 0.259, 0.259], [0.087, 0.269, 0.238]], 0.009, lips)
  curve([[-0.074, 0.263, 0.249], [0, 0.246, 0.27], [0.074, 0.263, 0.249]], 0.009, lips)
  curve([[-0.078, 0.269, 0.247], [0, 0.255, 0.277], [0.078, 0.269, 0.247]], 0.002, dark)
  // Small distinguishing mark visible beside the eyebrow in the close portrait.
  ellipsoid(dark, 0.235, 0.535, 0.127, 0.006, 0.006, 0.003)

  // Conform the cap to the SAME head profile. The previous independent sphere
  // intersected the scalp when shortened or shifted sideways, creating bald spots.
  const cap = track(new THREE.BufferGeometry())
  const capPositions = [], capIndices = [], capColors = []
  const hairColor = new THREE.Color(p.hair)
  const capRows = 80, capSegments = 160
  for (let row = 0; row <= capRows; row++) {
    const t = row / capRows
    for (let col = 0; col <= capSegments; col++) {
      const angle = col / capSegments * Math.PI * 2
      const bottom = hairlineAt(angle)
      const headY = THREE.MathUtils.lerp(bottom, 0.81, t)
      let lo = 0, hi = 1
      for (let iteration = 0; iteration < 16; iteration++) {
        const mid = (lo + hi) / 2
        if (profile.getPoint(mid).y < headY) lo = mid
        else hi = mid
      }
      const ring = profile.getPoint((lo + hi) / 2)
      // Short sides and a rounded crown support overlapping, irregular locks.
      // Keep the lift broad: a narrow raised crest reads as a squeezed ribbon.
      const front = Math.max(0, Math.cos(angle))
      const envelope = Math.sin(Math.PI * t)
      const top = THREE.MathUtils.smoothstep(t, 0.12, 0.78)
      const quiff = front * envelope
      const flow = angle * 19 + 12 * t + 0.65 * Math.sin(angle * 5 - t * 7)
      const locks = Math.sin(flow) * 0.009 + Math.sin(angle * 31 - t * 13) * 0.004
      const strands = Math.sin(angle * 67 + t * 17) * 0.0015
      const wave = (locks + strands) * envelope
      const padding = (0.008 + 0.016 * top + 0.014 * quiff + wave) * (1 - t ** 8)
      const radiusX = row === capRows ? 0 : ring.x + padding
      const radiusZ = row === capRows ? 0 : ring.z + padding
      capPositions.push(Math.sin(angle) * radiusX - 0.018 * top * p.hairHeight,
        headY + p.hairHeight * (0.05 * t + 0.035 * quiff)
          + wave + 0.012 * Math.sin(angle * 5 + t * 4) * envelope * top,
        Math.cos(angle) * radiusZ + 0.009 * quiff * p.hairHeight)
      const shade = 0.9 + 0.1 * Math.sin(flow) * envelope
        + 0.035 * Math.sin(angle * 67 + t * 17) * envelope
      const lockColor = hairColor.clone().multiplyScalar(shade)
      capColors.push(lockColor.r, lockColor.g, lockColor.b)
      if (row < capRows && col < capSegments) {
        const a = row * (capSegments + 1) + col, b = a + capSegments + 1
        capIndices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  cap.setAttribute('position', new THREE.Float32BufferAttribute(capPositions, 3))
  cap.setAttribute('color', new THREE.Float32BufferAttribute(capColors, 3))
  cap.setIndex(capIndices)
  cap.computeVertexNormals()
  // Join the wrap seam and crown normals so lighting cannot draw a hard stripe.
  const capNormals = cap.attributes.normal
  for (let row = 0; row < capRows; row++) {
    const a = row * (capSegments + 1), b = a + capSegments
    const normal = new THREE.Vector3().fromBufferAttribute(capNormals, a)
      .add(new THREE.Vector3().fromBufferAttribute(capNormals, b)).normalize()
    capNormals.setXYZ(a, normal.x, normal.y, normal.z)
    capNormals.setXYZ(b, normal.x, normal.y, normal.z)
  }
  for (let col = 0; col <= capSegments; col++) {
    capNormals.setXYZ(capRows * (capSegments + 1) + col, 0, 1, 0)
  }
  group.add(new THREE.Mesh(cap, track(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1,
  }))))
  group.scale.set(p.faceWidth, p.faceHeight, 1)
  return group
}
