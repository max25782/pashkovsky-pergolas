export const CM_TO_UNITS = 0.01

export function cm(n: number): number {
  return n * CM_TO_UNITS
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function dimsToCm(dim?: string): { a: number; b: number } | null {
  if (!dim) return null
  const dimStr = String(dim).trim()
  if (!dimStr) return null

  let m = dimStr.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i)
  if (m) {
    const a = parseFloat(m[1])
    const b = parseFloat(m[2])
    const isMm = /mm/i.test(dimStr) || !/cm/i.test(dimStr)
    const aCm = isMm ? a / 10 : a
    const bCm = isMm ? b / 10 : b
    return { a: Math.max(aCm, 0), b: Math.max(bCm, 0) }
  }

  m = dimStr.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm)/i)
  if (m) {
    const size = parseFloat(m[1])
    const isMm = /mm/i.test(dimStr)
    const sizeCm = isMm ? size / 10 : size
    return { a: Math.max(sizeCm, 0), b: Math.max(sizeCm, 0) }
  }

  return null
}
