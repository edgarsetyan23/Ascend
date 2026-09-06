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
    return 0.43 + 0.23 * front - 0.035 * lock
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
        0.035 * gaussian(0, 0.425, 0.044 * p.noseWidth, 0.103)
        + 0.055 * gaussian(0, 0.35, 0.06 * p.noseWidth, 0.04)
        + 0.02 * gaussian(-0.045 * p.noseWidth, 0.335, 0.022, 0.024)
        + 0.02 * gaussian(0.045 * p.noseWidth, 0.335, 0.022, 0.024)
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
      const color = base.clone().lerp(beard, coverage * (0.72 + grain * 0.08))
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
    ellipsoid(white, x, 0.462, 0.246, 0.061, 0.021, 0.029)
    ellipsoid(dark, x, 0.462, 0.272, 0.022, 0.019, 0.009)
    curve([[x - 0.059, 0.461, 0.251], [x, 0.485, 0.268], [x + 0.059, 0.461, 0.251]], 0.009, skin)
    curve([[x - 0.059, 0.532, 0.244], [x, 0.54, 0.259], [x + 0.059, 0.532, 0.244]], 0.011, hair)
  }
  curve([[-0.087, 0.269, 0.238], [-0.038, 0.259, 0.259], [0, 0.255, 0.266], [0.038, 0.259, 0.259], [0.087, 0.269, 0.238]], 0.009, lips)
  curve([[-0.074, 0.263, 0.249], [0, 0.246, 0.27], [0.074, 0.263, 0.249]], 0.009, lips)
  curve([[-0.078, 0.269, 0.247], [0, 0.255, 0.277], [0.078, 0.269, 0.247]], 0.002, dark)
  // Small distinguishing mark visible beside the eyebrow in the close portrait.
  ellipsoid(dark, 0.235, 0.535, 0.127, 0.006, 0.006, 0.003)

  // Conform the cap to the SAME head profile. The previous independent sphere
  // intersected the scalp when shortened or shifted sideways, creating bald spots.
  const cap = track(new THREE.BufferGeometry())
  const capPositions = [], capIndices = []
  const capRows = 48, capSegments = 96
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
      // Broad, low-amplitude waves keep a soft silhouette without spiky ridges.
      const wave = (1 + Math.sin(angle * 7 + t * 9)) * 0.009 * Math.sin(Math.PI * t)
      const padding = (0.012 + wave + 0.016 * Math.sin(Math.PI * t)) * (1 - t ** 8)
      const radiusX = row === capRows ? 0 : ring.x + padding
      const radiusZ = row === capRows ? 0 : ring.z + padding
      capPositions.push(Math.sin(angle) * radiusX,
        headY + 0.12 * p.hairHeight * t + wave,
        Math.cos(angle) * radiusZ)
      if (row < capRows && col < capSegments) {
        const a = row * (capSegments + 1) + col, b = a + capSegments + 1
        capIndices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  cap.setAttribute('position', new THREE.Float32BufferAttribute(capPositions, 3))
  cap.setIndex(capIndices)
  cap.computeVertexNormals()
  group.add(new THREE.Mesh(cap, hair))
  group.scale.set(p.faceWidth, p.faceHeight, 1)
  return group
}
