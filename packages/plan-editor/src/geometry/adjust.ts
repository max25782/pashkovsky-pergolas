import { rebuildChain } from './chain'
import { normalizeAngle } from './snap'
import { closureGap } from './closure'
import type { FixedEdge, Point } from './types'

/**
 * Порог неоднозначности worstEdgeIndex, см. AdjustContourResult.ambiguousCandidates.
 * Взвешенные стоимости кандидатов, отличающиеся друг от друга МЕНЬШЕ этой доли
 * от максимальной — считаются «математически неразличимыми», не одной чётко
 * виновной стороной. 20% — не статистический вывод, эвристический запас: цель
 * не поймать любое минимальное расхождение, а поймать классический случай
 * прямоугольника, где противолежащие стороны входят в уравнение замыкания
 * буквально с противоположными знаками и система физически видит только их
 * разность (см. adjust.test.ts «broken rectangle»).
 */
const AMBIGUITY_RELATIVE_THRESHOLD = 0.2

/**
 * Модель доверия для уравнивания. Это НЕ статистическая точность прибора —
 * у нас нет реального σ измерения. Это осознанный эвристический выбор с
 * ЧЕТЫРЬМЯ уровнями (длина — два, угол — три):
 *
 *   длина, введена числом (measuredLengthMm)         — angleTyped-класс, "обычный"
 *   длина, не введена (грубый клик/магнит)            — "мягкий"
 *   угол, защёлкнут привязкой (angleSnapped, без ввода числа) — "очень жёсткий"
 *   угол, введён числом (measuredAngleDeg)             — "жёсткий"
 *   угол, ни то ни другое (свободное движение мыши)    — "мягкий"
 *
 * Порядок жёсткости угла (снапнутый > введённый) НЕ опечатка: пользователь,
 * который зажал Shift/попал в polar-привязку, осознанно попросил инструмент
 * держать точный угол (0/45/90°...) — это как минимум не менее надёжное
 * утверждение, чем набранное число, а на практике часто надёжнее (число
 * можно опечатать, привязка физически не даёт угол «почти 90°»).
 *
 * Диапазон весов — от angleSnapped (самый жёсткий) до length/angleFree
 * (самый мягкий) — держим в пределах ~5 порядков (см. DEFAULT_ADJUST_WEIGHTS).
 * Это НЕ произвольная цифра: KKT-матрица решения содержит веса на диагонали
 * напрямую, и чем больше разброс между самым жёстким и самым мягким весом,
 * тем хуже обусловленность матрицы (число обусловленности растёт как минимум
 * пропорционально этому разбросу) — при 6-7+ порядках разницы решатель на
 * вырожденных/почти вырожденных контурах (см. degenerate-тесты в
 * adjust.test.ts) может начать давать неустойчивые результаты или ложно
 * репортить сходимость. Если понадобится расширять диапазон дальше — сначала
 * проверить именно это, а не считать "чуть жёстче/чуть мягче" бесплатным.
 */
export interface AdjustWeightsConfig {
  /** Длина, подтверждённая числом через updateEdgeLength. */
  lengthTyped: number
  /** Длина без подтверждения — грубый клик или магнит. */
  lengthFree: number
  /** Угол, защёлкнутый привязкой (dir.snapped) на момент commit — самый жёсткий. */
  angleSnapped: number
  /** Угол, подтверждённый числом через updateEdgeAngle. */
  angleTyped: number
  /** Угол без подтверждения и без привязки — свободное движение мыши. */
  angleFree: number
}

export const DEFAULT_ADJUST_WEIGHTS: AdjustWeightsConfig = {
  lengthTyped: 1,
  lengthFree: 1e-4,
  angleSnapped: 10,
  angleTyped: 1,
  angleFree: 1e-4,
}

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

/** Максимум итераций Gauss-Newton. Типичный контур (4-10 сторон) сходится за 3-5. */
const MAX_ITERATIONS = 50
/** |g(x)| в мм, ниже которого считаем итерацию завершённой досрочно. */
const GX_CONVERGED_MM = 1e-7
/** Норма шага Δx (мм для длины, рад для угла), ниже которой шаг уже ничтожен. */
const STEP_CONVERGED = 1e-9
/** Порог финальной невязки для флага converged — существенно грубее GX_CONVERGED_MM,
 *  чтобы не считать «не сошедшимся» решение с остаточным шумом плоских чисел. */
const FINAL_GAP_CONVERGED_MM = 1e-2

export interface EdgeResidual {
  edgeId: string
  /** adjustedLengthMm − targetLengthMm, мм, со знаком. target = measured, если введена, иначе текущая. */
  lengthResidualMm: number
  /** adjustedAngleDeg − targetAngleDeg, градусы, со знаком, нормализовано в (−180, 180]. */
  angleResidualDeg: number
  /**
   * true, если у стороны нет НИ ОДНОГО основания для доверия: длина не введена
   * числом, а угол ни введён числом, ни защёлкнут привязкой (dir.snapped) —
   * то есть вся геометрия стороны — свободное движение мыши/магнит. Такая
   * сторона исключается из кандидатов на worstEdgeIndex (см. там же).
   */
  wasUnmeasured: boolean
}

export interface AdjustContourResult {
  /** Те же стороны с уравненными lengthMm/angleDeg; from/to пересчитаны rebuildChain от startPoint. */
  edges: FixedEdge[]
  /** По каждой стороне, в порядке edges на входе — на сколько её сдвинуло от целевого значения. */
  residuals: EdgeResidual[]
  /**
   * Индекс ИЗМЕРЕННОЙ стороны (wasUnmeasured === false) с наибольшим ВЗВЕШЕННЫМ
   * отклонением — не голым мм. Неизмеренные стороны исключены из рассмотрения
   * полностью, а не просто занижены весом: у стороны без введённого числа
   * нет замера, который можно назвать подозрительным, а её голый остаток в мм
   * обычно больше всех остальных (ей и положено целиком уйти в подгонку) —
   * при достаточно большом остатке это способно перевесить даже вес в 10000
   * раз меньший, если сравнивать по голой взвешенной стоимости без явного
   * исключения. worstEdgeIndex обязан находить измеренную сторону, которая,
   * несмотря на высокое доверие, всё равно была вынуждена сдвинуться.
   * null, если сторон нет вовсе или ни одна не была измерена.
   */
  worstEdgeIndex: number | null
  /**
   * Индексы сторон, взвешенная стоимость которых отличается от максимальной
   * (см. worstEdgeIndex) меньше чем на AMBIGUITY_RELATIVE_THRESHOLD — то есть
   * математически неотличимы друг от друга как «виновник». Пустой массив —
   * либо однозначный виновник (worstEdgeIndex сам по себе достаточен), либо
   * измеренных сторон меньше двух, либо максимальная стоимость равна нулю
   * (контур и так сходился). Если длина >= 2, UI ОБЯЗАН показывать «нельзя
   * различить A и C», а не указывать пальцем на worstEdgeIndex — см. коммент
   * к AMBIGUITY_RELATIVE_THRESHOLD и usage в 3C (панель итога).
   */
  ambiguousCandidates: number[]
  /**
   * id сторон, у которых угол не имеет НИКАКОГО основания доверия — ни введён
   * числом (measuredAngleDeg), ни защёлкнут привязкой (angleSnapped). Их угол
   * взят из свободного движения мыши (или геометрически навязан магнитом) и
   * учтён с весом angleFree — результат по ним приблизителен вне зависимости
   * от того, попали ли они в worstEdgeIndex/ambiguousCandidates. UI показывает
   * это как отдельную, третью, независимую от первых двух, оговорку.
   */
  underDeterminedEdgeIds: string[]
  /** |невязка контура| ДО уравнивания, мм — «было расхождение X мм» для панели итога. */
  initialGapMm: number
  /** |невязка контура| ПОСЛЕ уравнивания, мм. У сходившегося решения ≈ 0. */
  closureGapMm: number
  /** false — решатель не сошёлся (вырожденная система или превышен лимит итераций). */
  converged: boolean
}

interface EdgeTarget {
  targetLengthMm: number
  targetAngleRad: number
  weightLength: number
  weightAngle: number
  /** мм — плечо для перевода углового веса в те же единицы (мм²), что и вес длины. */
  refLengthMm: number
  wasUnmeasured: boolean
  /** true — угол подтверждён числом или защёлкнут привязкой. false — свободная мышь. */
  hasAngleTrust: boolean
}

function buildTargets(edges: FixedEdge[], weights: AdjustWeightsConfig): EdgeTarget[] {
  return edges.map((e) => {
    const hasLen = e.measuredLengthMm != null
    const hasTypedAngle = e.measuredAngleDeg != null
    // Приоритет для веса угла: явно введённое число важнее факта привязки
    // (measuredAngleDeg перекрывает angleSnapped) — но привязка сама по себе
    // жёстче введённого числа (см. комментарий у DEFAULT_ADJUST_WEIGHTS), так
    // что порядок проверки НЕ "typed побеждает snapped по значению веса" —
    // typed просто означает "мы точно знаем, что угол подтверждён явно",
    // тогда как snapped применяется, только когда явного подтверждения не было.
    const isAngleSnapped = !hasTypedAngle && e.angleSnapped === true
    const targetLengthMm = e.measuredLengthMm ?? e.lengthMm
    const targetAngleRad = (e.measuredAngleDeg ?? e.angleDeg) * DEG2RAD
    const weightAngle = hasTypedAngle ? weights.angleTyped : isAngleSnapped ? weights.angleSnapped : weights.angleFree
    return {
      targetLengthMm,
      targetAngleRad,
      weightLength: hasLen ? weights.lengthTyped : weights.lengthFree,
      weightAngle,
      refLengthMm: Math.max(Math.abs(targetLengthMm), 1e-6),
      wasUnmeasured: !hasLen && !hasTypedAngle && !isAngleSnapped,
      hasAngleTrust: hasTypedAngle || isAngleSnapped,
    }
  })
}

/**
 * Решает Ax=b методом Гаусса с выбором главного элемента по столбцу.
 * null — матрица (численно) вырождена, решения не существует/не единственно.
 */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let pivotRow = col
    let maxAbs = Math.abs(M[col][col])
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxAbs) {
        maxAbs = Math.abs(M[r][col])
        pivotRow = r
      }
    }
    if (maxAbs < 1e-12) return null
    if (pivotRow !== col) {
      const tmp = M[col]
      M[col] = M[pivotRow]
      M[pivotRow] = tmp
    }
    const pivot = M[col][col]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = M[r][col] / pivot
      if (factor === 0) continue
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c]
      }
    }
  }

  return M.map((row, i) => row[n] / row[i])
}

/** Знаковая разность углов a−b в градусах, нормализованная в (−180, 180]. */
function angleDiffDeg(a: number, b: number): number {
  let d = normalizeAngle(a) - normalizeAngle(b)
  d = ((d + 180) % 360 + 360) % 360 - 180
  return d === -180 ? 180 : d
}

/**
 * Уравнивает замкнутый контур методом взвешенных наименьших квадратов с
 * нелинейным ограничением замыкания, решаемым итерациями Gauss-Newton
 * (SQP: на каждой итерации ограничение линеаризуется, квадратичная стоимость
 * остаётся точной — сходится за несколько итераций для типичной геометрии).
 *
 * Неизвестные — (lengthMm, angleDeg) КАЖДОЙ стороны, а не абсолютные вершины:
 * это даёт напрямую интерпретируемые residuals (мм и градусы на сторону —
 * то, что нужно показать пользователю в 3C: «эту сторону подвинуло на N мм»).
 *
 * Целевые значения (x0) — measuredLengthMm/measuredAngleDeg, если введены,
 * иначе текущие lengthMm/angleDeg. Вес — по AdjustWeightsConfig (см. выше),
 * в зависимости от того, как получено значение (введено/защёлкнуто/свободно).
 *
 * Ограничение (жёсткое, через множители Лагранжа, не штрафом):
 *   Σ lengthMm_i · cos(angleDeg_i) = 0
 *   Σ lengthMm_i · sin(angleDeg_i) = 0
 * (сумма векторов сторон возвращается в startPoint — контур замкнут точно).
 */
export function adjustContour(
  edges: FixedEdge[],
  startPoint: Point,
  weights: AdjustWeightsConfig = DEFAULT_ADJUST_WEIGHTS,
): AdjustContourResult {
  const n = edges.length
  if (n === 0) {
    return {
      edges: [],
      residuals: [],
      worstEdgeIndex: null,
      ambiguousCandidates: [],
      underDeterminedEdgeIds: [],
      initialGapMm: 0,
      closureGapMm: 0,
      converged: true,
    }
  }

  const initialGapMm = closureGap(edges).distMm
  const targets = buildTargets(edges, weights)
  const dim = 2 * n

  // x = [len_0, ang_0(рад), len_1, ang_1(рад), ...]. Старт — из целевых значений:
  // если контур уже сходится сам по себе, ни одна итерация даже не понадобится.
  const x = new Array<number>(dim)
  const x0 = new Array<number>(dim)
  for (let i = 0; i < n; i++) {
    x[2 * i] = targets[i].targetLengthMm
    x[2 * i + 1] = targets[i].targetAngleRad
    x0[2 * i] = targets[i].targetLengthMm
    x0[2 * i + 1] = targets[i].targetAngleRad
  }

  // Диагональ весов: D[2i] — мм⁻² (вес длины), D[2i+1] — угловой вес,
  // переведённый в мм²-эквивалент через refLengthMm (см. коммент к EdgeTarget).
  const D = new Array<number>(dim)
  for (let i = 0; i < n; i++) {
    D[2 * i] = targets[i].weightLength
    D[2 * i + 1] = targets[i].weightAngle * targets[i].refLengthMm * targets[i].refLengthMm
  }

  let degenerate = false

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let gx = 0
    let gy = 0
    for (let i = 0; i < n; i++) {
      gx += x[2 * i] * Math.cos(x[2 * i + 1])
      gy += x[2 * i] * Math.sin(x[2 * i + 1])
    }
    if (Math.hypot(gx, gy) < GX_CONVERGED_MM) break

    // Якобиан ограничения G (2 × dim) в текущей точке x.
    const G0 = new Array<number>(dim).fill(0)
    const G1 = new Array<number>(dim).fill(0)
    for (let i = 0; i < n; i++) {
      const len = x[2 * i]
      const ang = x[2 * i + 1]
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      G0[2 * i] = c
      G0[2 * i + 1] = -len * s
      G1[2 * i] = s
      G1[2 * i + 1] = len * c
    }

    // KKT-система (dim+2)×(dim+2):
    //   [ 2D   Gᵗ ] [Δx]   [ -2D(x−x0) ]
    //   [ G    0  ] [λ ] = [ -g(x)      ]
    const size = dim + 2
    const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0))
    const rhs = new Array<number>(size).fill(0)
    for (let i = 0; i < dim; i++) {
      A[i][i] = 2 * D[i]
      A[i][dim] = G0[i]
      A[i][dim + 1] = G1[i]
      A[dim][i] = G0[i]
      A[dim + 1][i] = G1[i]
      rhs[i] = -2 * D[i] * (x[i] - x0[i])
    }
    rhs[dim] = -gx
    rhs[dim + 1] = -gy

    const solved = solveLinear(A, rhs)
    if (!solved) {
      degenerate = true
      break
    }

    let stepNormSq = 0
    for (let i = 0; i < dim; i++) {
      x[i] += solved[i]
      stepNormSq += solved[i] * solved[i]
    }
    if (Math.sqrt(stepNormSq) < STEP_CONVERGED) break
  }

  let finalGx = 0
  let finalGy = 0
  for (let i = 0; i < n; i++) {
    finalGx += x[2 * i] * Math.cos(x[2 * i + 1])
    finalGy += x[2 * i] * Math.sin(x[2 * i + 1])
  }
  const closureGapMm = Math.hypot(finalGx, finalGy)
  const converged = !degenerate && closureGapMm < FINAL_GAP_CONVERGED_MM

  const resultEdges: FixedEdge[] = edges.map((e, i) => ({
    ...e,
    lengthMm: x[2 * i],
    angleDeg: normalizeAngle(x[2 * i + 1] * RAD2DEG),
  }))
  const rebuiltEdges = rebuildChain(resultEdges, startPoint)

  const residuals: EdgeResidual[] = targets.map((t, i) => {
    const adjustedLen = x[2 * i]
    const adjustedAngDeg = normalizeAngle(x[2 * i + 1] * RAD2DEG)
    const targetAngDeg = normalizeAngle(t.targetAngleRad * RAD2DEG)
    return {
      edgeId: edges[i].id,
      lengthResidualMm: adjustedLen - t.targetLengthMm,
      angleResidualDeg: angleDiffDeg(adjustedAngDeg, targetAngDeg),
      wasUnmeasured: t.wasUnmeasured,
    }
  })

  // worstEdgeIndex ищем ТОЛЬКО среди измеренных сторон (wasUnmeasured === false).
  // Взвешенная стоимость одна не спасает: у неизмеренной стороны голый остаток
  // обычно на порядки больше (ей и положено целиком уйти в подгонку под замыкание),
  // и при достаточно большом остатке даже вес 1e-4 может перевесить вес=1 измеренной
  // стороны с остатком, близким к нулю. У неизмеренной стороны просто нет замера,
  // который можно было бы назвать подозрительным — её исключаем из рассмотрения
  // явно, а не надеемся, что подбор коэффициента веса всегда угадает соотношение.
  const measuredCosts: Array<{ index: number; cost: number }> = []
  for (let i = 0; i < n; i++) {
    if (targets[i].wasUnmeasured) continue
    const t = targets[i]
    const r = residuals[i]
    const angleResidRad = r.angleResidualDeg * DEG2RAD
    const cost = t.weightLength * r.lengthResidualMm ** 2 + t.weightAngle * (angleResidRad * t.refLengthMm) ** 2
    measuredCosts.push({ index: i, cost })
  }

  let worstEdgeIndex: number | null = null
  let worstCost = -Infinity
  for (const c of measuredCosts) {
    if (c.cost > worstCost) {
      worstCost = c.cost
      worstEdgeIndex = c.index
    }
  }

  // Неоднозначность — среди измеренных сторон, чья стоимость близка к worstCost
  // (см. AMBIGUITY_RELATIVE_THRESHOLD). worstCost === 0 означает «контур и так
  // сходился» — некого подозревать, кандидатов нет по определению, а не «все
  // стороны равно неоднозначны».
  const ambiguousCandidates =
    worstCost > 0
      ? measuredCosts
          .filter((c) => (worstCost - c.cost) / worstCost <= AMBIGUITY_RELATIVE_THRESHOLD)
          .map((c) => c.index)
          .sort((a, b) => a - b)
      : []
  if (ambiguousCandidates.length <= 1) ambiguousCandidates.length = 0

  const underDeterminedEdgeIds = edges.filter((_, i) => !targets[i].hasAngleTrust).map((e) => e.id)

  return {
    edges: rebuiltEdges,
    residuals,
    worstEdgeIndex,
    ambiguousCandidates,
    underDeterminedEdgeIds,
    initialGapMm,
    closureGapMm,
    converged,
  }
}
