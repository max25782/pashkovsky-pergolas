export function readableLabelAngleDeg(dxScreen: number, dyScreen: number): number {
  const raw = (Math.atan2(dyScreen, dxScreen) * 180) / Math.PI
  if (raw > 90 || raw < -90) {
    const flipped = raw + 180
    return flipped > 180 ? flipped - 360 : flipped
  }
  return raw
}
