import { describe, expect, it } from 'vitest'
import { ralToHex, isHexColor } from './ral'
import { resolvePergolaFinish } from './materials'

describe('RAL table', () => {
  it('maps RAL7016 and spaced tokens to the same hex', () => {
    expect(ralToHex('RAL7016')).toBe('#383E42')
    expect(ralToHex('ral 7016')).toBe('#383E42')
  })

  it('returns null for unknown or non-RAL tokens', () => {
    expect(ralToHex('RAL0000')).toBeNull()
    expect(ralToHex('#383E42')).toBeNull()
  })

  it('accepts 3- and 6-digit hex', () => {
    expect(isHexColor('#9aa0a6')).toBe(true)
    expect(isHexColor('#fff')).toBe(true)
    expect(isHexColor('wood')).toBe(false)
  })
})

describe('resolvePergolaFinish', () => {
  it('uses aluminum PBR for RAL and hex', () => {
    const ral = resolvePergolaFinish('RAL9006')
    expect(ral.finish).toBe('aluminum')
    expect(ral.metalness).toBeCloseTo(0.9)
    expect(ral.roughness).toBeCloseTo(0.35)
    const hex = resolvePergolaFinish('#9aa0a6')
    expect(hex.finish).toBe('aluminum')
    expect(hex.hex).toBe('#9aa0a6')
  })

  it('uses the wood preset for wood tokens', () => {
    const wood = resolvePergolaFinish('wood:oak')
    expect(wood.finish).toBe('wood')
    expect(wood.metalness).toBe(0)
    expect(wood.roughness).toBeGreaterThan(0.5)
  })
})
