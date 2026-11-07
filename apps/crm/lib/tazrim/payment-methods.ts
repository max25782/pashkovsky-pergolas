// Stored as-is in vendors.payment_mode (free-text column), optionally followed
// by a detail such as "60/90". Labels match what existing rows already contain.
export const PAYMENT_METHODS = [
  "שיק",
  "הוראת קבע חודשית",
  "מזומן",
  "העברה בנקאית",
  "כרטיס אשראי",
] as const;

export function buildPaymentMode(method: string, details: string): string | null {
  const isKnownMethod = (PAYMENT_METHODS as readonly string[]).includes(method);
  if (!isKnownMethod) return details || null;
  return details ? `${method} ${details}` : method;
}
