/**
 * Чистые типы геометрического слоя.
 * Никаких импортов React/DOM/SVG здесь и в остальных файлах geometry/.
 */

/** Точка в любой системе координат (мм в мире, px на экране — зависит от контекста). */
export interface Point {
  x: number
  y: number
}

/**
 * Абстрагированные модификаторы ввода.
 * Маппинг клавиш → модификаторов делается на входном слое (input/), не здесь.
 * Десктоп: lockOrtho = shiftKey, freeform = altKey.
 * Touch (будущий шаг): придут от экранных кнопок.
 */
export interface Modifiers {
  lockOrtho: boolean
  freeform: boolean
}

/** Результат разрешения направления из resolveDirection. */
export interface DirResult {
  /** Итоговый угол, градусы ∈ [0, 360). 0° = вправо, растёт против часовой стрелки. */
  angleDeg: number
  /** true → сработала привязка (polar или ortho). */
  snapped: boolean
  /** Угол привязки, к которому защёлкнулись; null если snapped = false. */
  snapAngle: number | null
}

/** Конфиг polar-привязки — передаётся снаружи, ничего не хардкодится в теле функции. */
export interface SnapConfig {
  /** Кандидаты угловой привязки, градусы. */
  snapAngles: number[]
  /** Порог защёлкивания, градусы. Сравнение включительное (delta <= thresholdDeg). */
  thresholdDeg: number
}

/** Дефолтный конфиг привязки. Не встроен в resolveDirection — передаётся явно. */
export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  snapAngles: [0, 45, 90, 135, 180, 225, 270, 315],
  thresholdDeg: 7,
}

/**
 * Дефолтный порог магнита замыкания, экранные px — моторная точность клика,
 * не мм (см. geometry/closure.ts applyStartMagnet). Живёт здесь, рядом с
 * DEFAULT_SNAP_CONFIG.thresholdDeg — тот же класс настройки («насколько точно
 * должен попасть курсор»), только для другого действия (замыкание vs привязка
 * угла). Раньше жил в closure.ts изолированно — перенесён по итогам ревью
 * (кнопка «В 3D» промпт): 15px оказалось слишком узкой целью на типичном
 * fit-to-screen зуме (полигон ~10×10м), поднято до 25px. С добавлением явной
 * кнопки «Замкнуть контур» (model/store.ts closeContourExplicit) магнит — уже
 * не единственный путь к замыканию, а лишь удобство, так что регресс от более
 * широкого порога (случайное залипание раньше времени) не критичен.
 */
export const DEFAULT_MAGNET_THRESHOLD_PX = 25

/** Прямоугольная область в мировых координатах (мм). */
export interface WorldBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Размер холста в экранных пикселях. */
export interface CanvasSize {
  widthPx: number
  heightPx: number
}

/**
 * Вьюпорт: перевод мировых мм ↔ экранные px.
 * scale — px на мм. panX/panY — смещение начала мира на экране, px.
 * Не задаётся константой — вычисляется fit-to-screen (см. computeFitToScreenViewport).
 */
export interface Viewport {
  scale: number
  panX: number
  panY: number
}

/**
 * Черновое ребро — резиновая линия.
 * `to` — проекция курсора вдоль `dir.angleDeg` (см. projectOntoRay в coords.ts),
 * а не сам курсор — иначе ребро визуально не выглядит привязанным к углу.
 *
 * Живёт в geometry/, а не в model/, потому что buildDraftEdge (чистая функция
 * geometry/draftEdge.ts) должна его возвращать без обратной зависимости на model/.
 */
export interface DraftEdge {
  from: Point   // мм
  to: Point     // мм
  dir: DirResult
  /**
   * true, если applyStartMagnet (geometry/closure.ts) «прилипил» `to` к стартовой
   * вершине контура — клик по этой линии должен вызвать closeContour(), а не
   * обычный commitDraft(). Отсутствует/false — обычное черновое ребро.
   */
  closesContour?: boolean
}

/**
 * Оверрайд длины/угла черновой линии из буфера динамического ввода (A1,
 * input/usePlanEditorInput.ts). Поле, которое пользователь НЕ печатал,
 * остаётся undefined — итоговое ребро берёт его из мыши (текущий draftEdge),
 * а не из этого объекта. Используется finalizeDraftEdge (geometry/draftEdge.ts)
 * и model/store.ts commitDraftTyped.
 */
export interface DraftOverride {
  lengthMm?: number
  angleDeg?: number
}

/** Единица ввода длины в UI динамического/точечного ввода. Внутри модели — только мм. */
export type LengthUnit = 'cm' | 'mm'

/**
 * Зафиксированная сторона контура (клик по резиновой линии превращает
 * DraftEdge в FixedEdge — см. commitDraft в model/store.ts).
 *
 * angleDeg хранится отдельно от from/to намеренно: правка длины/угла (см.
 * geometry/chain.ts rebuildChain) должна сохранять angleDeg неизменным и
 * пересчитывать только to — а не выводить угол обратно из from/to каждый раз.
 *
 * lengthMm/angleDeg — ТЕКУЩИЕ (эффективные) значения: то, что реально
 * используется для отрисовки и для rebuildChain. Они могут быть:
 *   - грубой оценкой из мышиного клика (commitDraft) — предварительное
 *     направление/длина, ничем не подтверждённые;
 *   - навязаны магнитом замыкания (closeContour) — угол/точка `to` посчитаны
 *     не из ввода пользователя, а из geometry «дотянуть до startPoint»;
 *   - явно введены пользователем числом через updateEdgeLength/updateEdgeAngle.
 *
 * measuredLengthMm/measuredAngleDeg — ТОЛЬКО третий случай: значение, которое
 * пользователь подтвердил числом в поле ввода. undefined — не подтверждено,
 * сторону геометрически можно свободно двигать при уравнивании (см.
 * geometry/adjust.ts adjustContour). Это разделение принципиально: без него
 * adjustContour не отличит реальную ошибку замера от честного «пользователь
 * тут просто прикинул мышью» — и невязка контура будет либо молча размазана
 * по всем сторонам поровну, либо (что хуже) списана на последнюю сторону
 * только потому, что она физически последняя, а не потому, что она виновата.
 */
export interface FixedEdge {
  id: string
  from: Point       // мм, мир
  to: Point         // мм, мир
  angleDeg: number  // направление, градусы — сохраняется при правке длины
  lengthMm: number  // текущая длина

  /** Длина, явно введённая пользователем числом. undefined = не вводилась. */
  measuredLengthMm?: number
  /** Угол, явно введённый пользователем числом. undefined = не вводился. */
  measuredAngleDeg?: number

  /**
   * true, если `to` этой стороны было принудительно поставлено в startPoint
   * магнитом замыкания (closeContour), а не выведено из направления курсора.
   * Это не «сторона неправильная» — это диагностический факт «её геометрия
   * частично навязана UI, а не измерена», нужный для 3C (подсветка/сообщение)
   * и как объяснение, почему у такой стороны обычно нет measuredAngleDeg.
   */
  closedByMagnet?: boolean

  /**
   * true, если УГОЛ этой стороны в момент commitDraft/closeContour был получен
   * привязкой (dir.snapped из resolveDirection — ortho-lock на Shift или
   * polar-привязка к config.snapAngles), а НЕ свободным движением мыши.
   * Источник — тот же dir.snapped, что уже используется для подсветки резиновой
   * линии; здесь он просто доносится до модели и переживает commit.
   *
   * Это отдельная от measuredAngleDeg ось доверия: пользователь ничего не
   * вводил числом, но осознанно попросил инструмент держать точный угол
   * (0/45/90°...) — такое утверждение обычно надёжнее, чем то, что угол
   * подошёл случайно при свободном клике. adjustContour (geometry/adjust.ts)
   * использует это как третий, самый жёсткий уровень доверия к углу — жёстче
   * даже явно введённого числа (см. DEFAULT_ADJUST_WEIGHTS.angleSnapped).
   * measuredAngleDeg, если он всё же появится позже (updateEdgeAngle), имеет
   * приоритет над этим флагом при выборе веса.
   */
  angleSnapped?: boolean

  /**
   * true — эта сторона прикреплена к стене здания: балка крепится к стене
   * напрямую по всей длине, стойки на этой стороне не ставятся (см.
   * промпт «крепление к стене» — computeFrame сторонняя правило про
   * вершины, не про рёбра, но сам ФЛАГ живёт на ребре, потому что
   * пользователь отмечает конкретную сторону как пристенную).
   * undefined/false — обычная свободная сторона. Чисто пользовательский
   * ввод (чекбокс в панели «Изменить размеры») — НЕ выводится из геометрии
   * и не трогается rebuildChain/adjustContour.
   *
   * Пробрасывается хостом (apps/crm) в PergolaSpec.wallEdgeIndices через
   * geometry/chain.ts wallEdgeIndicesFromChain — сам пакет plan-editor
   * ничего не знает о PergolaSpec/pergola-core (см. toPolygon).
   */
  attachedToWall?: boolean
}
