import { describe, it, expect } from 'vitest'
import {
  EMPTY_DYNAMIC_INPUT_BUFFER,
  appendDigit,
  backspace,
  switchField,
  isBufferEmpty,
  parseBufferOverride,
  lengthUnitToMm,
} from '../dynamicInputBuffer'

describe('appendDigit', () => {
  it('appends digits to the active field (length by default)', () => {
    let s = EMPTY_DYNAMIC_INPUT_BUFFER
    s = appendDigit(s, '5')
    s = appendDigit(s, '8')
    s = appendDigit(s, '0')
    expect(s.lengthText).toBe('580')
    expect(s.angleText).toBe('')
  })

  it('accepts a decimal point but rejects a second one', () => {
    let s = EMPTY_DYNAMIC_INPUT_BUFFER
    s = appendDigit(s, '6')
    s = appendDigit(s, '.')
    s = appendDigit(s, '5')
    expect(s.lengthText).toBe('6.5')
    const rejected = appendDigit(s, '.')
    expect(rejected).toBe(s) // same reference — rejected, no change
    expect(rejected.lengthText).toBe('6.5')
  })

  it('treats a comma as a decimal separator', () => {
    let s = EMPTY_DYNAMIC_INPUT_BUFFER
    s = appendDigit(s, '6')
    s = appendDigit(s, ',')
    s = appendDigit(s, '5')
    expect(s.lengthText).toBe('6.5')
  })

  it('rejects "-" in the length field entirely', () => {
    const s = appendDigit(EMPTY_DYNAMIC_INPUT_BUFFER, '-')
    expect(s).toBe(EMPTY_DYNAMIC_INPUT_BUFFER)
    expect(s.lengthText).toBe('')
  })

  it('accepts "-" as the first character of the angle field, rejects it afterwards', () => {
    let s = switchField(EMPTY_DYNAMIC_INPUT_BUFFER)
    s = appendDigit(s, '-')
    expect(s.angleText).toBe('-')
    s = appendDigit(s, '4')
    s = appendDigit(s, '5')
    expect(s.angleText).toBe('-45')
    const rejected = appendDigit(s, '-')
    expect(rejected).toBe(s)
  })

  it('ignores unknown characters', () => {
    const s = appendDigit(EMPTY_DYNAMIC_INPUT_BUFFER, 'x')
    expect(s).toBe(EMPTY_DYNAMIC_INPUT_BUFFER)
  })
})

describe('backspace', () => {
  it('removes the last character of the active field', () => {
    let s = EMPTY_DYNAMIC_INPUT_BUFFER
    s = appendDigit(s, '5')
    s = appendDigit(s, '8')
    s = backspace(s)
    expect(s.lengthText).toBe('5')
  })

  it('is a no-op on an empty field', () => {
    const s = backspace(EMPTY_DYNAMIC_INPUT_BUFFER)
    expect(s).toBe(EMPTY_DYNAMIC_INPUT_BUFFER)
  })

  it('only touches the active field, leaves the other one alone', () => {
    let s = EMPTY_DYNAMIC_INPUT_BUFFER
    s = appendDigit(s, '5')
    s = appendDigit(s, '8')
    s = appendDigit(s, '0')
    s = switchField(s)
    s = appendDigit(s, '6')
    s = appendDigit(s, '6')
    s = backspace(s)
    expect(s.lengthText).toBe('580')
    expect(s.angleText).toBe('6')
  })
})

describe('switchField', () => {
  it('toggles length <-> angle without touching either text', () => {
    let s = appendDigit(EMPTY_DYNAMIC_INPUT_BUFFER, '5')
    expect(s.activeField).toBe('length')
    s = switchField(s)
    expect(s.activeField).toBe('angle')
    expect(s.lengthText).toBe('5')
    s = switchField(s)
    expect(s.activeField).toBe('length')
  })
})

describe('isBufferEmpty', () => {
  it('true for the initial buffer', () => {
    expect(isBufferEmpty(EMPTY_DYNAMIC_INPUT_BUFFER)).toBe(true)
  })

  it('false once either field has any text', () => {
    expect(isBufferEmpty(appendDigit(EMPTY_DYNAMIC_INPUT_BUFFER, '5'))).toBe(false)
    const angleOnly = appendDigit(switchField(EMPTY_DYNAMIC_INPUT_BUFFER), '5')
    expect(isBufferEmpty(angleOnly)).toBe(false)
  })
})

describe('lengthUnitToMm', () => {
  it('multiplies by 10 for cm', () => {
    expect(lengthUnitToMm(580, 'cm')).toBe(5800)
  })
  it('passes through unchanged for mm', () => {
    expect(lengthUnitToMm(580, 'mm')).toBe(580)
  })
})

describe('parseBufferOverride', () => {
  it('empty buffer -> both fields undefined (mouse controls everything)', () => {
    const override = parseBufferOverride(EMPTY_DYNAMIC_INPUT_BUFFER, 'cm')
    expect(override.lengthMm).toBeUndefined()
    expect(override.angleDeg).toBeUndefined()
  })

  it('the real-world trap: "580" typed under cm default must become 5800mm, not 580mm', () => {
    const s = appendDigit(appendDigit(appendDigit(EMPTY_DYNAMIC_INPUT_BUFFER, '5'), '8'), '0')
    const override = parseBufferOverride(s, 'cm')
    expect(override.lengthMm).toBe(5800)
  })

  it('under mm unit, "580" stays 580mm', () => {
    const s = appendDigit(appendDigit(appendDigit(EMPTY_DYNAMIC_INPUT_BUFFER, '5'), '8'), '0')
    const override = parseBufferOverride(s, 'mm')
    expect(override.lengthMm).toBe(580)
  })

  it('parses a typed angle in degrees, unaffected by the length unit', () => {
    let s = switchField(EMPTY_DYNAMIC_INPUT_BUFFER)
    s = appendDigit(s, '6')
    s = appendDigit(s, '6')
    const override = parseBufferOverride(s, 'cm')
    expect(override.angleDeg).toBe(66)
  })

  it('parses both length and angle together', () => {
    let s = EMPTY_DYNAMIC_INPUT_BUFFER
    s = appendDigit(s, '6')
    s = appendDigit(s, '2')
    s = appendDigit(s, '4')
    s = appendDigit(s, '.')
    s = appendDigit(s, '9')
    s = switchField(s)
    s = appendDigit(s, '6')
    s = appendDigit(s, '6')
    const override = parseBufferOverride(s, 'cm')
    expect(override.lengthMm).toBeCloseTo(6249, 6)
    expect(override.angleDeg).toBe(66)
  })

  it('a lone "-" or "." never parses to a number, not 0/NaN silently accepted', () => {
    const s = appendDigit(switchField(EMPTY_DYNAMIC_INPUT_BUFFER), '-')
    const override = parseBufferOverride(s, 'cm')
    expect(override.angleDeg).toBeUndefined()
  })

  it('zero or negative length never becomes a real override', () => {
    const zero = appendDigit(EMPTY_DYNAMIC_INPUT_BUFFER, '0')
    expect(parseBufferOverride(zero, 'cm').lengthMm).toBeUndefined()
  })
})
