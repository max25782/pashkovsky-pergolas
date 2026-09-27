/** Prevents overlapping quick-offer POST/PATCH while a request is in flight. */
export function createQuickOfferSubmitGate() {
  let inFlight = false
  return {
    tryAcquire(): boolean {
      if (inFlight) return false
      inFlight = true
      return true
    },
    release(): void {
      inFlight = false
    },
    isInFlight(): boolean {
      return inFlight
    },
  }
}
