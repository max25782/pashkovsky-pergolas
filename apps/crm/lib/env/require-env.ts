/**
 * Environment-variable guards.
 *
 * Several integrations used to degrade silently when their configuration was
 * absent: a webhook would answer 200 without storing anything, CAPTCHA and rate
 * limiting would wave every request through, and the profiles proxy would call
 * localhost from production. Missing configuration is an operator error, so it
 * has to surface as a failure rather than as a quietly disabled protection.
 *
 * Dev keeps the permissive behaviour where it is genuinely useful (no Turnstile
 * widget, no Redis), which is why callers branch on `isProduction`.
 */

export const isProduction = process.env.NODE_ENV === 'production'

export class MissingEnvError extends Error {
  readonly names: string[]

  constructor(names: string[]) {
    super(`Missing required environment variable(s): ${names.join(', ')}`)
    this.name = 'MissingEnvError'
    this.names = names
  }
}

/** Read a variable, throwing MissingEnvError when it is unset or blank. */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new MissingEnvError([name])
  return value
}

/**
 * Names among `names` that are unset or blank.
 *
 * Returning the list instead of throwing lets route handlers report every
 * missing variable in one log line and answer with a single 500.
 */
export function missingEnv(...names: string[]): string[] {
  return names.filter((name) => !process.env[name]?.trim())
}

/** First non-blank value among `names`, or undefined. */
export function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}
