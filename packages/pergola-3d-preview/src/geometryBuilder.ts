import * as THREE from 'three'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { MM_TO_M } from './units'

const RAD = Math.PI / 180

/**
 * Билдер геометрии: CutPiece[] (из pergola-core, мм) → меши Three.js (м).
 *
 * Ядро (computeFrame/computeLamellas) не трогаем — вся математика профиля/
 * контура уже там. Здесь только перевод готового CutPiece в конкретную
 * BufferGeometry с подрезанными по cutMiter.../cutHand... торцами.
 *
 * ── Локальная система координат детали (до position/rotation) ──────────────
 *
 * КРИТИЧНО (исправленный баг ориентации сечения): position/rotation детали
 * содержат ТОЛЬКО одну азимутальную составляющую — rotation.y = -θ вокруг
 * мировой (=локальной, родителя нет) оси Y. Поворот вокруг Y у three.js не
 * трогает Y-координату точки и мешает МЕЖДУ СОБОЙ только X и Z. Значит для
 * детали, стоящей «на ребре» (балка, прогон) или лежащей плашмя (ламель),
 * ВЕРТИКАЛЬНАЯ величина сечения (heightMm) обязана лежать на локальном Y —
 * иначе после поворота на любой отличный от 0 азимут она «уезжает» в
 * горизонтальную плоскость вместе с длиной (ровно так балка оказывалась
 * положенной набок на всех рёбрах контура, кроме случайного θ=0).
 *
 * Для role !== 'post' (балка, прогон, ламель) — длина вдоль локального X:
 *   X ∈ [0, lengthAxisMm], с торцами, смещёнными по Z-стороне (см. ниже)
 *   Y ∈ [0, heightMm]              — высота профиля, «от опорной точки вверх»
 *   Z ∈ [-widthMm/2, +widthMm/2]   — ширина профиля в плане, отцентрована
 * После этого position/rotation из CutPiece применяются как есть:
 *   • балки: rotation = [0, -θ, 0] — Y (высота) инвариантна относительно
 *     поворота вокруг Y → остаётся вертикальной при любом θ; X (длина) и
 *     Z (ширина в плане) вращаются вместе — Z остаётся ПЕРПЕНДИКУЛЯРНОЙ
 *     направлению балки в плане, как и должно быть.
 *   • ламели: rotation = [tilt, -θ, 0] — поворот вокруг ДЛИННОЙ оси (X)
 *     первым (Euler XYZ: rotation.x применяется первым) корректно наклоняет
 *     сечение (Y/Z смешиваются вокруг X) вокруг собственной длинной оси —
 *     ровно то, что означает lamellaAngleDeg (и lamellaOnEdge: +90°, см.
 *     pergola-core/lamellas.ts).
 * Эта раскладка (X = длина) подтверждена самим frame.ts/lamellas.ts: вектор
 * локального +X после поворота на -θ вокруг Y даёт (cosθ, 0, sinθ) — ровно
 * направление ребра контура в плане (см. пруф в PR-описании/коммитах).
 *
 * Для role === 'post' — стойки всегда вертикальны, rotation = [0,0,0]
 * (см. frame.ts computeFrame: посты не поворачиваются). Чтобы «длина» стойки
 * шла по мировому +Y без лишнего поворота на объекте, канонический бокс
 * строится с ВЫСОТОЙ, отцентрованной по Y (а не «от 0 вверх», как у балки —
 * сечение стойки центрировано на точке контура, а не «от точки в одну
 * сторону»), а затем локальная геометрия целиком поворачивается на +90°
 * вокруг Z (geometry.rotateZ) — это меняет местами локальные X↔Y (длина
 * становится вертикальной), а Z (ширина сечения) остаётся горизонтальной
 * независимо от раскладки Y/Z выше — после этого position/rotation
 * (тождественный) применяются как обычно.
 *
 * ── Подрезка торцов (миттер) ─────────────────────────────────────────────
 *
 * Δ_i = tan(cutMiterDeg_i) × profileWidthMm / 2 (см. miter.ts longPointOffset
 * и сам frame.ts miterOffset — bevel НЕ входит в Δ: комментарий lamellas.ts
 * прямо говорит «bevel — поворот сечения вокруг оси длины, не сдвигает точку
 * реза по длине»; JSDoc в types.ts описывает более общую формулу, но реальный
 * код везде считает только по miter — код первичен, а не JSDoc, см. правило
 * проекта «trust code over docs»).
 *
 * «Длинная» Z-сторона (та, что торчит за номинальный торец) определяется
 * cutHandStart/cutHandEnd. Знак ПРОВЕРЕН на реальном выпуклом угле CCW
 * прямоугольника (см. тест «real polygon corner» / комментарий к фиксу):
 * для 'L' длинная точка оказывается на локальном z<0, что после rotation.y
 * = -θ и переноса в вершину контура ложится на ВНЕШНЮЮ сторону полигона —
 * ровно как у рамки картины (внешняя грань угла длиннее внутренней):
 *   'L' → длинная точка при z = -width/2
 *   'R' → длинная точка при z = +width/2
 *   'straight' → Δ обычно и так 0 (miter=0), знак не важен
 */

const EPS = 1e-9

function longSideSign(w: number, hand: 'L' | 'R' | 'straight'): number {
  if (hand === 'straight') return 0
  const isLeft = w > 0
  if (hand === 'L') return isLeft ? 1 : -1
  return isLeft ? -1 : 1
}

function deltaFromMiter(miterDeg: number, profileWidthMm: number): number {
  return Math.tan(miterDeg * RAD) * profileWidthMm / 2
}

interface MiteredBoxOptions {
  lengthMm: number
  widthMm: number
  heightMm: number
  /** 'based' — Y ∈ [0, heightMm] (балка/ламель садится на опорную высоту снизу вверх). 'centered' — Y ∈ [-h/2,+h/2] (сечение стойки). */
  zMode: 'based' | 'centered'
  cutMiterStartDeg: number
  cutHandStart: 'L' | 'R' | 'straight'
  cutMiterEndDeg: number
  cutHandEnd: 'L' | 'R' | 'straight'
}

/**
 * Строит «скошенный бокс» (параллелепипед с подрезанными по миттеру торцами)
 * вдоль локального X, с ВЫСОТОЙ сечения на Y (вертикаль, инвариантна к
 * азимутальному повороту rotation.y) и ШИРИНОЙ на Z (горизонталь в плане,
 * вращается вместе с длиной). Все 6 граней — плоские четырёхугольники:
 * Δ-смещение зависит только от Z (ширины), поэтому боковые/верхняя/нижняя
 * грани остаются точно осепараллельными, а торцевые — плоским
 * параллелограммом.
 *
 * Раскладка точек — та же самая, что была при Y=ширина/Z=высота, только
 * с заменой (y, z) → (z, -y) (поворот на 90° вокруг X, а не зеркальное
 * отражение) — это ФИЗИЧЕСКИ поворот, а не переименование осей, поэтому
 * винды граней (CCW снаружи) остаются корректными без переворота порядка
 * вершин в quads ниже (проверено: det этой замены = +1).
 */
function buildMiteredBoxGeometryMm(opts: MiteredBoxOptions): THREE.BufferGeometry {
  const { lengthMm: L, widthMm, heightMm, zMode } = opts
  const hw = widthMm / 2
  const y0 = zMode === 'based' ? 0 : -heightMm / 2
  const y1 = zMode === 'based' ? heightMm : heightMm / 2

  const dStart = deltaFromMiter(opts.cutMiterStartDeg, widthMm)
  const dEnd = deltaFromMiter(opts.cutMiterEndDeg, widthMm)

  const xStart = (w: number) => 0 - longSideSign(w, opts.cutHandStart) * dStart
  const xEnd = (w: number) => L + longSideSign(w, opts.cutHandEnd) * dEnd

  // 8 corners: P<start|end><w=-hw|+hw><y0|y1>; w (width, in-plan) на Z,
  // высота на Y — см. class-level комментарий про (y,z)→(z,-y).
  const P000: [number, number, number] = [xStart(-hw), y0, hw]
  const P001: [number, number, number] = [xStart(-hw), y1, hw]
  const P010: [number, number, number] = [xStart(hw), y0, -hw]
  const P011: [number, number, number] = [xStart(hw), y1, -hw]
  const P100: [number, number, number] = [xEnd(-hw), y0, hw]
  const P101: [number, number, number] = [xEnd(-hw), y1, hw]
  const P110: [number, number, number] = [xEnd(hw), y0, -hw]
  const P111: [number, number, number] = [xEnd(hw), y1, -hw]

  // Каждая грань получает СВОИ 4 вершины (не общие с соседними гранями) —
  // иначе computeVertexNormals усреднил бы нормали по 3 смежным граням в
  // каждом из 8 углов и дал бы «скруглённый» бокс вместо чёткого граненого.
  // Порядок вершин в каждом квадранте — CCW при взгляде СНАРУЖИ (та же
  // раскладка индексов, что и раньше — замена (y,z)→(z,-y) это поворот
  // (det=+1), винды не переворачиваются).
  const quads: Array<[typeof P000, typeof P000, typeof P000, typeof P000]> = [
    [P000, P010, P110, P100], // bottom, outward -Y
    [P101, P111, P011, P001], // top, outward +Y
    [P000, P100, P101, P001], // side z=+hw, outward +Z
    [P010, P011, P111, P110], // side z=-hw, outward -Z
    [P000, P001, P011, P010], // start cap, outward ≈ -X
    [P100, P110, P111, P101], // end cap, outward ≈ +X
  ]

  const positions = new Float32Array(quads.length * 4 * 3)
  const indices: number[] = []
  quads.forEach(([a, b, c, d], qi) => {
    const base = qi * 4
    ;[a, b, c, d].forEach((v, vi) => {
      const o = (base + vi) * 3
      positions[o] = v[0]
      positions[o + 1] = v[1]
      positions[o + 2] = v[2]
    })
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Собирает геометрию одной детали в метрах, с осями, соответствующими
 * position/rotation исходного CutPiece (см. комментарий класса выше).
 */
export function buildCutPieceGeometry(
  piece: CutPiece,
  profile: ProfileDimensions,
): THREE.BufferGeometry {
  const lengthMm = Math.max(piece.lengthAxisMm, EPS)
  const isPost = piece.role === 'post'

  const geometry = buildMiteredBoxGeometryMm({
    lengthMm,
    widthMm: Math.max(profile.widthMm, EPS),
    heightMm: Math.max(profile.heightMm, EPS),
    zMode: isPost ? 'centered' : 'based',
    cutMiterStartDeg: piece.cutMiterStartDeg,
    cutHandStart: piece.cutHandStart,
    cutMiterEndDeg: piece.cutMiterEndDeg,
    cutHandEnd: piece.cutHandEnd,
  })

  geometry.scale(MM_TO_M, MM_TO_M, MM_TO_M)

  if (isPost) {
    // Локальный X (длина) → локальный Y: стойка растёт от position (земля,
    // world Y=0) вверх на lengthAxisMm вдоль мирового +Y без поворота на
    // самом CutPiece (rotation всегда [0,0,0] у стоек — см. frame.ts).
    geometry.rotateZ(Math.PI / 2)
  }

  return geometry
}

/** Простой единый материал — см. промпт: «материал простой, один цвет», фотореализм — отдельный шаг. */
export function buildCutPieceMaterial(colorHex: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: safeColor(colorHex),
    metalness: 0.35,
    roughness: 0.55,
  })
}

function safeColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex)
  } catch {
    return new THREE.Color('#9aa0a6')
  }
}

/**
 * Собирает готовый THREE.Mesh для одной детали: геометрия + материал +
 * мировое position/rotation (мм → м на границе, rotation уже в радианах —
 * без конверсии). profiles — та же карта, что уходит в computeFrame/
 * computeLamellas (по piece.profileId).
 */
export function buildCutPieceMesh(
  piece: CutPiece,
  profiles: Map<string, ProfileDimensions>,
  material?: THREE.Material,
): THREE.Mesh {
  const profile = profiles.get(piece.profileId)
  if (!profile) {
    throw new Error(`Profile "${piece.profileId}" not found in profiles map (piece ${piece.id})`)
  }

  const geometry = buildCutPieceGeometry(piece, profile)
  const mesh = new THREE.Mesh(geometry, material ?? buildCutPieceMaterial(piece.color))
  mesh.position.set(
    piece.position[0] * MM_TO_M,
    piece.position[1] * MM_TO_M,
    piece.position[2] * MM_TO_M,
  )
  mesh.rotation.set(piece.rotation[0], piece.rotation[1], piece.rotation[2])
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.cutPieceId = piece.id
  mesh.userData.role = piece.role
  return mesh
}

/** Строит меши для всех деталей сразу — удобно для рендера всего FrameResult+lamellas одним вызовом. */
export function buildCutPieceMeshes(
  pieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
): THREE.Mesh[] {
  return pieces.map((piece) => buildCutPieceMesh(piece, profiles))
}

/**
 * Строит один THREE.BatchedMesh на весь список деталей — один draw call
 * вместо N отдельных THREE.Mesh (см. промпт «ламели»: при узком профиле
 * 20мм на L-образном контуре может получиться под тысячу деталей, а с
 * сегментацией по прогонам — несколько тысяч; при таком количестве
 * отдельные Mesh обваливают FPS, InstancedMesh не подходит — у деталей
 * разные длины и углы реза, то есть разная геометрия, а не только матрица).
 *
 * У каждой детали своя (разная) геометрия — BatchedMesh поддерживает это
 * через addGeometry (своя грани/вершины на инстанс) + addInstance (только
 * матрица трансформации), в отличие от InstancedMesh, где геометрия ОДНА
 * на все инстансы. Материал общий на весь батч (см. buildCutPieceMaterial)
 * — оправдано тем, что вызывающий код группирует по role, а pieces одной
 * роли в текущем ядре всегда получают spec.color (один и тот же цвет).
 *
 * Возвращает null для пустого списка — вызывающему (PergolaCutPieceScene)
 * не нужно рендерить пустой батч.
 */
export function buildBatchedCutPieceMesh(
  pieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
  material?: THREE.Material,
): THREE.BatchedMesh | null {
  if (pieces.length === 0) return null

  const geometries = pieces.map((piece) => {
    const profile = profiles.get(piece.profileId)
    if (!profile) {
      throw new Error(`Profile "${piece.profileId}" not found in profiles map (piece ${piece.id})`)
    }
    return buildCutPieceGeometry(piece, profile)
  })

  const maxVertexCount = geometries.reduce((sum, g) => sum + g.getAttribute('position').count, 0)
  const maxIndexCount = geometries.reduce((sum, g) => sum + (g.getIndex()?.count ?? 0), 0)

  const batched = new THREE.BatchedMesh(
    pieces.length,
    maxVertexCount,
    maxIndexCount,
    material ?? buildCutPieceMaterial(pieces[0].color),
  )
  // Каждая деталь мала относительно всей сцены — покровное frustum culling
  // по каждому инстансу того стоит, в отличие от одного culling'а по всему
  // батчу сразу (умолчание three.js уже true, оставляем явно для ясности).
  batched.perObjectFrustumCulled = true
  batched.castShadow = true
  batched.receiveShadow = true

  const matrix = new THREE.Matrix4()
  const euler = new THREE.Euler()
  pieces.forEach((piece, i) => {
    const geometryId = batched.addGeometry(geometries[i])
    const instanceId = batched.addInstance(geometryId)
    euler.set(piece.rotation[0], piece.rotation[1], piece.rotation[2])
    matrix.makeRotationFromEuler(euler)
    matrix.setPosition(
      piece.position[0] * MM_TO_M,
      piece.position[1] * MM_TO_M,
      piece.position[2] * MM_TO_M,
    )
    batched.setMatrixAt(instanceId, matrix)
  })

  batched.userData.role = pieces[0].role
  batched.userData.cutPieceIds = pieces.map((p) => p.id)
  return batched
}

const LED_STRIP_COLOR = '#fff2c8'
const LED_STRIP_EMISSIVE = '#ffdf94'
/** Толщина светящейся полосы, мм — тонкая накладка, не отдельный конструктивный профиль. */
const LED_STRIP_HEIGHT_MM = 4

/**
 * Тонкая светящаяся полоса вдоль ОДНОГО прогона с hasLedChannel — 3D-эффект
 * той же формы (те же торцевые резы cutMiter.../cutHand..., та же длина), но
 * заметно уже и утоплена чуть ниже нижней грани прогона, имитируя канал
 * (см. промпт: «полосы света идут ровно по прогонам», не произвольно по
 * периметру — источник геометрии здесь ровно тот же CutPiece прогона).
 * Только рисует то, что уже посчитано (см. pergola-core ledChannel.ts —
 * ledPurlinPieces уже отобрал, какие прогоны реально несут LED-канал).
 */
export function buildLedStripMesh(purlinPiece: CutPiece, purlinProfile: ProfileDimensions): THREE.Mesh {
  const lengthMm = Math.max(purlinPiece.lengthAxisMm, EPS)
  const stripWidthMm = Math.min(purlinProfile.widthMm * 0.4, 12)

  const geometry = buildMiteredBoxGeometryMm({
    lengthMm,
    widthMm: stripWidthMm,
    heightMm: LED_STRIP_HEIGHT_MM,
    zMode: 'based',
    cutMiterStartDeg: purlinPiece.cutMiterStartDeg,
    cutHandStart: purlinPiece.cutHandStart,
    cutMiterEndDeg: purlinPiece.cutMiterEndDeg,
    cutHandEnd: purlinPiece.cutHandEnd,
  })
  // Утапливаем чуть ниже нижней грани прогона (piece.position — низ
  // "based"-геометрии прогона на Y=0, высота идёт вверх по Y, см.
  // buildMiteredBoxGeometryMm), чтобы полоса читалась как канал, а не
  // как деталь той же толщины.
  geometry.translate(0, -LED_STRIP_HEIGHT_MM, 0)
  geometry.scale(MM_TO_M, MM_TO_M, MM_TO_M)

  const material = new THREE.MeshStandardMaterial({
    color: LED_STRIP_COLOR,
    emissive: new THREE.Color(LED_STRIP_EMISSIVE),
    emissiveIntensity: 1.6,
    roughness: 0.4,
    metalness: 0,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(
    purlinPiece.position[0] * MM_TO_M,
    purlinPiece.position[1] * MM_TO_M,
    purlinPiece.position[2] * MM_TO_M,
  )
  mesh.rotation.set(purlinPiece.rotation[0], purlinPiece.rotation[1], purlinPiece.rotation[2])
  mesh.userData.cutPieceId = `${purlinPiece.id}-led`
  mesh.userData.role = 'led-strip'
  return mesh
}

/**
 * Строит светящиеся полосы для всех переданных деталей — ожидается, что
 * вызывающий уже отфильтровал через pergola-core.ledPurlinPieces (роль
 * 'purlin' + profile.hasLedChannel), эта функция сама фильтровать не
 * обязана, но безопасно пропускает детали без профиля в карте.
 */
export function buildLedStripMeshes(
  purlinPieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  for (const piece of purlinPieces) {
    const profile = profiles.get(piece.profileId)
    if (!profile) continue
    meshes.push(buildLedStripMesh(piece, profile))
  }
  return meshes
}
