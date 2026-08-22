import type { DraftOverride, LengthUnit } from '../geometry/types'

/**
 * Буфер динамического ввода A1 (AutoCAD-style dynamic input) — чистая логика,
 * без React/DOM. Живёт отдельно от usePlanEditorInput, чтобы парсинг буквенно-
 * цифрового буфера тестировался без jsdom/renderHook — обычными юнит-тестами,
 * как geometry/.
 *
 * Два независимых текстовых поля (длина, угол) — пользователь может напечатать
 * длину, Tab на угол, напечатать и его, и Enter коммитит ОБА оверрайда сразу
 * (см. usePlanEditorInput). Непустой текст поля = «защёлкнуто», мышь больше не
 * управляет этим измерением (см. isFieldLocked).
 */
export type DynamicInputField = 'length' | 'angle'

export interface DynamicInputBufferState {
  activeField: DynamicInputField
  lengthText: string
  angleText: string
}

export const EMPTY_DYNAMIC_INPUT_BUFFER: DynamicInputBufferState = {
  activeField: 'length',
  lengthText: '',
  angleText: '',
}

/** Клавиши, которые этот буфер обрабатывает. Всё остальное — return as-is у вызывающего. */
const DIGIT_CHARS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])

function fieldText(state: DynamicInputBufferState, field: DynamicInputField): string {
  return field === 'length' ? state.lengthText : state.angleText
}

function withFieldText(state: DynamicInputBufferState, field: DynamicInputField, text: string): DynamicInputBufferState {
  return field === 'length' ? { ...state, lengthText: text } : { ...state, angleText: text }
}

/**
 * Применяет один печатный символ к активному полю буфера. Возвращает тот же
 * объект (по ссылке), если символ отвергнут (второй десятичный разделитель,
 * '-' не первым символом, '-' в поле длины, неизвестный символ) — вызывающий
 * может использовать это как «ничего не изменилось» без отдельного флага.
 */
export function appendDigit(state: DynamicInputBufferState, char: string): DynamicInputBufferState {
  const field = state.activeField
  const current = fieldText(state, field)

  if (DIGIT_CHARS.has(char)) return withFieldText(state, field, current + char)

  if (char === '.' || char === ',') {
    if (current.includes('.')) return state
    return withFieldText(state, field, current + '.')
  }

  if (char === '-') {
    // Отрицательная длина не имеет смысла; отрицательный угол — только как
    // самый первый символ поля (иначе это не "минус", а мусор в середине числа).
    if (field !== 'angle' || current.length > 0) return state
    return withFieldText(state, field, '-')
  }

  return state
}

/** Backspace — стирает последний символ активного поля. No-op на пустом поле. */
export function backspace(state: DynamicInputBufferState): DynamicInputBufferState {
  const field = state.activeField
  const current = fieldText(state, field)
  if (current.length === 0) return state
  return withFieldText(state, field, current.slice(0, -1))
}

/** Tab — переключает активное поле length↔angle. Текст обоих полей сохраняется. */
export function switchField(state: DynamicInputBufferState): DynamicInputBufferState {
  return { ...state, activeField: state.activeField === 'length' ? 'angle' : 'length' }
}

/** true, если хоть одно поле что-то содержит — Enter с полностью пустым буфером игнорируется вызывающим. */
export function isBufferEmpty(state: DynamicInputBufferState): boolean {
  return state.lengthText === '' && state.angleText === ''
}

/** Переводит текст поля длины в мм согласно настройке редактора (по умолчанию см). */
export function lengthUnitToMm(value: number, unit: LengthUnit): number {
  return unit === 'cm' ? value * 10 : value
}

/** Обратная конверсия — мм модели → единица отображения (для бейджа и предзаполнения A2). */
export function mmToLengthUnit(mm: number, unit: LengthUnit): number {
  return unit === 'cm' ? mm / 10 : mm
}

/**
 * Парсит текущий буфер в DraftOverride для commitDraftTyped. Поле с пустым
 * текстом, нечисловым текстом (например одинокий "-" или "."), нулём/
 * отрицательной длиной — не становится оверрайдом (undefined, как «не
 * напечатано») — коммит в этом случае просто берёт значение у мыши, а не
 * падает и не приводит к NaN геометрии.
 */
export function parseBufferOverride(state: DynamicInputBufferState, unit: LengthUnit): DraftOverride {
  const lengthRaw = state.lengthText === '' ? NaN : parseFloat(state.lengthText.replace(',', '.'))
  const angleRaw = state.angleText === '' ? NaN : parseFloat(state.angleText.replace(',', '.'))

  const lengthMm = Number.isFinite(lengthRaw) && lengthRaw > 0 ? lengthUnitToMm(lengthRaw, unit) : undefined
  const angleDeg = Number.isFinite(angleRaw) ? angleRaw : undefined

  return { lengthMm, angleDeg }
}
