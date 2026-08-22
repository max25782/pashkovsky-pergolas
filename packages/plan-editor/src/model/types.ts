import type { Point, Viewport, CanvasSize, DraftEdge, FixedEdge, DraftOverride, LengthUnit } from '../geometry/types'
import type { AdjustContourResult } from '../geometry/adjust'

export type { DraftEdge, FixedEdge, AdjustContourResult, DraftOverride, LengthUnit }

/** Срез стора редактора плана. */
export interface PlanEditorState {
  viewport: Viewport

  /**
   * Зафиксированная стартовая точка контура.
   * Мировое значение не важно само по себе (см. initViewport) — {0,0} выбрано,
   * чтобы первая сторона считалась от нуля и не мешала числами в голове при отладке.
   */
  startPoint: Point

  /** null = резиновое ребро не рисуется (курсор вне холста / рисование не начато). */
  draftEdge: DraftEdge | null

  /** Зафиксированные стороны контура по порядку. Каждая начинается от конца предыдущей. */
  fixedEdges: FixedEdge[]

  /** id стороны, для которой сейчас открыто всплывающее поле длины/угла. null = поле закрыто. */
  editingEdgeId: string | null

  /**
   * true после клика в зоне магнита замыкания (closeContour). Не означает
   * «геометрически замкнуто без невязки» — просто «пользователь подтвердил,
   * что это последняя сторона». Реальную невязку показывает closureGap
   * (geometry/closure.ts) над текущими fixedEdges.
   */
  isClosed: boolean

  /**
   * Результат последнего adjustAndClose() — диагностика для 3C (подсветка
   * худшей стороны, сообщение о невязке). null, если уравнивание ещё не
   * запускалось (например, контур замкнут только магнитом, без adjustAndClose).
   */
  lastAdjustResult: AdjustContourResult | null

  /**
   * Снимок fixedEdges/isClosed СРАЗУ ПЕРЕД последним adjustAndClose() — ручной
   * откат для "Отменить" в панели итога (часть B), пока zundo в этот стор не
   * подключён (см. package.json — зависимость есть, temporal() middleware
   * пока не обёрнут вокруг create()). null — уравнивание либо не запускалось,
   * либо его уже приняли (acceptAdjust) или отменили (cancelAdjust).
   */
  preAdjustSnapshot: { edges: FixedEdge[]; isClosed: boolean } | null

  /**
   * Причина последнего неудавшегося явного замыкания (closeContourExplicit).
   * null — либо ещё не пытались, либо последняя попытка удалась/форма с тех
   * пор изменилась (см. коммент к closeContourError: null в commitDraft и
   * остальных мутаторах fixedEdges — стухшее сообщение сбрасывается там).
   * 'tooFewEdges' практически недостижимо через UI (кнопка и так задисейблена
   * при < 3 сторонах) — оставлено как защита от прямого вызова экшена.
   */
  closeContourError: 'tooFewEdges' | 'selfIntersecting' | null

  /**
   * Единица ввода длины в UI динамического ввода (A1) и правки стороны (A2).
   * По умолчанию 'cm' — реальные замеры пергол на объекте почти всегда ведутся
   * в сантиметрах (580, 624.9, 1085.6...), а не в мм; молчаливая трактовка "580"
   * как миллиметров даёт 58см вместо 5.8м — см. input/dynamicInputBuffer.ts.
   * Внутри модели (fixedEdges, adjustContour) единица всегда мм, независимо
   * от этой настройки — конверсия происходит на границе UI, не здесь.
   */
  inputUnit: LengthUnit

  /**
   * id стороны, которую сейчас подсвечивают наведением мышью — либо строка
   * панели «Изменить размеры» (view-html/SizesPanel.tsx), либо сама сторона
   * на канвасе (view-svg/FixedEdges.tsx). Двусторонняя синхронизация: наведение
   * в любом из двух мест подсвечивает то же ребро в другом. Чисто transient
   * UI-состояние (как editingEdgeId), но, в отличие от него, никак не влияет
   * на canDraw/рисование — это только подсветка, не режим ввода.
   */
  hoveredEdgeId: string | null

  // ── Экшены ──────────────────────────────────────────────────────────────

  /** Пересчитывает viewport через fit-to-screen под текущий размер холста. */
  initViewport: (canvasSize: CanvasSize) => void

  setViewport: (patch: Partial<Viewport>) => void

  setInputUnit: (unit: LengthUnit) => void

  setDraftEdge: (edge: DraftEdge | null) => void

  /** См. hoveredEdgeId. Вызывается и из FixedEdges (canvas), и из SizesPanel (список сторон). */
  setHoveredEdgeId: (id: string | null) => void

  /**
   * Точка старта следующей резиновой линии: to последней зафиксированной
   * стороны, либо startPoint, если цепочка пуста. Обёртка над чистой
   * geometry/chain.ts currentAnchor(fixedEdges, startPoint) — читает текущее
   * состояние стора за вызывающего.
   */
  currentAnchor: () => Point

  /**
   * Клик по резиновой линии: draftEdge → новый FixedEdge (направление и
   * предварительная длина — из проекции курсора), draftEdge обнуляется.
   * Режим грубого наброска: editingEdgeId НЕ выставляется, рисование
   * продолжается немедленно следующим кликом/печатью — правка конкретной
   * стороны требует отдельного явного действия (клик по уже зафиксированной
   * стороне → openEditor, либо панель «Изменить размеры»). No-op, если
   * draftEdge сейчас null, а также если экранная длина черновой линии меньше
   * порога (короткий тычок без отъезда курсора — см. MIN_COMMIT_LENGTH_PX
   * в store.ts).
   */
  commitDraft: () => void

  /**
   * Клик в зоне магнита замыкания (см. geometry/closure.ts applyStartMagnet):
   * draftEdge (у которого closesContour уже true — это гарантирует вызывающий,
   * input-слой) → новый FixedEdge, isClosed становится true. editingEdgeId не
   * трогается — isClosed=true само по себе замораживает рисование (canDraw),
   * форма правки не открывается автоматически. No-op, если draftEdge сейчас
   * null или closesContour не true — на этот случай обычный клик должен
   * вызывать commitDraft(), а не эту функцию.
   */
  closeContour: () => void

  /**
   * Явное замыкание контура — «Замкнуть контур» в оверлее (см. подробный
   * комментарий у реализации в model/store.ts; про рассмотренный и отклонённый
   * вариант с двойным кликом по холсту — см. комментарий в view-svg/PlanCanvas.tsx).
   * Активна
   * при fixedEdges.length >= 3 && !isClosed — сама эта проверка тоже внутри
   * (защита от прямого вызова, UI обязан дублировать её в disabled кнопки).
   *
   * Считает замыкающую сторону геометрически (текущий якорь → startPoint),
   * проверяет результирующий полигон на самопересечение ПЕРЕД записью — если
   * контур зигзагом пересёк бы сам себя, fixedEdges/isClosed не меняются,
   * причина неудачи кладётся в closeContourError.
   */
  closeContourExplicit: () => void

  /**
   * A1 (динамический ввод): коммитит текущий draftEdge с оверрайдом длины
   * и/или угла из буфера ввода — то, что пользователь НАПЕЧАТАЛ, а не то, что
   * дала мышь. В отличие от commitDraft/closeContour, editingEdgeId НЕ
   * выставляется — введённое число уже точное, поле правки не нужно.
   * Поле override, которое пользователь напечатал, становится
   * measuredLengthMm/measuredAngleDeg новой стороны (высокий вес в
   * adjustContour); ненапечатанное — как обычно, из мыши (низкий вес).
   * isClosed становится true, если исходный draftEdge.closesContour был true
   * (магнит замыкания сработал ДО того, как начали печатать) — независимо от
   * оверрайда: печать числа переопределяет геометрию замыкающей стороны, но
   * не отменяет то, что это последняя сторона контура (см. finalizeDraftEdge).
   * No-op, если draftEdge сейчас null.
   */
  commitDraftTyped: (override: DraftOverride) => void

  /**
   * Применяет точную длину к стороне `id`. from и angleDeg не меняются —
   * пересчитывается только to. Если сторона не последняя, вся цепочка после
   * неё пересобирается (см. geometry/chain.ts rebuildChain) — хвост сдвигается.
   */
  updateEdgeLength: (id: string, mm: number) => void

  /** Аналогично updateEdgeLength, но меняется направление, длина сохраняется. */
  updateEdgeAngle: (id: string, deg: number) => void

  /**
   * Переключает FixedEdge.attachedToWall для стороны `id` — чекбокс «к
   * стене» в панели «Изменить размеры» (см. промпт «крепление к стене»).
   * В отличие от updateEdgeLength/Angle НЕ трогает from/to/rebuildChain —
   * это чисто пользовательский признак, не геометрия, ничего пересчитывать
   * не нужно. No-op, если сторона `id` не найдена.
   */
  setEdgeAttachedToWall: (id: string, attachedToWall: boolean) => void

  /**
   * A2: открывает поле правки для уже зафиксированной стороны `id` (клик по
   * стороне на холсте, не по резиновой линии). draftEdge принудительно
   * обнуляется — курсор в этот момент едет по HTML-полю A2, а не по холсту,
   * и резиновая линия не должна висеть на последней позиции мыши ДО клика.
   */
  openEditor: (id: string) => void

  /**
   * Закрывает поле ввода, ничего не меняя в fixedEdges. Для Escape: вызывающий
   * (input-слой) просто не должен звать updateEdgeLength/Angle перед этим —
   * тогда сторона останется с тем предварительным значением, что было
   * выставлено в commitDraft.
   *
   * draftEdge принудительно обнуляется — пока поле A2 было открыто, курсор
   * ездил по HTML-инпуту, а не по холсту, pointermove на SVG не приходил, и
   * последний известный draftEdge мог протухнуть (курсор уже физически не там).
   * Резиновая линия появится заново только по первому НАСТОЯЩЕМУ pointermove
   * после закрытия — не прыгнет со старой позиции.
   */
  closeEditor: () => void

  /**
   * Уравнивает контур методом наименьших квадратов (см. geometry/adjust.ts
   * adjustContour): стороны с measuredLengthMm/measuredAngleDeg почти не
   * двигаются, свободные (неизмеренные, включая обычно closedByMagnet)
   * забирают на себя невязку. Заменяет fixedEdges результатом, сохраняет
   * диагностику в lastAdjustResult, гарантирует isClosed=true. No-op на
   * пустом контуре.
   */
  adjustAndClose: () => void

  /**
   * Откатывает fixedEdges/isClosed к preAdjustSnapshot и чистит
   * lastAdjustResult/preAdjustSnapshot. No-op, если снимка нет (уравнивание
   * не запускалось либо уже принято/отменено).
   */
  cancelAdjust: () => void

  /** Подтверждает результат последнего уравнивания — просто чистит preAdjustSnapshot. */
  acceptAdjust: () => void
}
