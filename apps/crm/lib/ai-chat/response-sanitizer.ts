/**
 * Strip internal reasoning artefacts from Gemini responses and reject the ones
 * that leaked the system prompt instead of following it.
 *
 * Two distinct failure modes are handled here:
 *
 * 1. A marked chain-of-thought block before the real answer:
 *
 *      THOUGHT: The user wants to see pergolas. I need to acknowledge…
 *
 *      שלום! הנה כמה פרויקטים…
 *
 *    These are stripped by stripThoughtBlock().
 *
 * 2. An unmarked plan that mirrors the SYSTEM_PROMPT structure, in English,
 *    with no salvageable customer-facing text:
 *
 *      1. **Acknowledge/Identify:** Confirm that I understand the product
 *      2. **Fact/Value:** Give a general price range for electric pergolas…
 *      3. **Question:** Ask for city/size to follow the pricing rule…
 *
 *    Nothing can be stripped from these — the whole response is the leak, so
 *    isLeakedReasoning() rejects it and the caller retries or falls back.
 *
 * Neither variant may reach the customer or be written to ai_messages: saved
 * leaks are replayed as history on the next turn and teach the model to repeat
 * the format.
 */

import { SAFE_FALLBACK_REPLY } from './config'

const THOUGHT_PATTERNS = [
  // Standard single or multi-paragraph THOUGHT block, terminated by a blank line
  /^THOUGHT:[\s\S]*?\n\n/i,
  // THOUGHT block at the very end of the text (no trailing blank line)
  /^THOUGHT:[^\n]*\n?/i,
  // Markdown variant: **THOUGHT:** or **THOUGHT (internal):**
  /^\*\*THOUGHT[^*]*\*\*:?[^\n]*\n?/i,
  // Thinking bracket variant: [THINKING]…[/THINKING]
  /^\[THINKING\][\s\S]*?\[\/THINKING\]\s*/i,
]

export function stripThoughtBlock(text: string): string {
  let cleaned = text

  for (const pattern of THOUGHT_PATTERNS) {
    const before = cleaned
    cleaned = cleaned.replace(pattern, '')
    // If a pattern matched, restart from the beginning
    // (a response can theoretically have more than one THOUGHT block)
    if (cleaned !== before) {
      cleaned = cleaned.trimStart()
    }
  }

  return cleaned.trim()
}

/** Prompt-structure labels the model must never print, regardless of language. */
const LEAKED_LABEL_PATTERNS = [
  /\b(acknowledge|identify)\s*\/?\s*(identify|acknowledge)?\s*:/i,
  /\bfact\s*\/\s*value\s*:/i,
  /\bquestion\s*:\s*\*?\*?\s*ask\b/i,
  /\*\*\s*(acknowledge|identify|fact|value|question|step|goal|positioning)\b/i,
  /\b(pricing|output)\s+(rule|format)\b/i,
  /\bsystem\s+(prompt|instruction)s?\b/i,
  /\bfew[-\s]?shot\b/i,
]

/** First-person planning the model does instead of answering the customer. */
const PLANNING_PATTERNS = [
  /\bI\s+(will|need to|should|must|am going to)\b/i,
  /\b(confirm|re-?state|provide|give)\s+(that\s+)?I\s+understand\b/i,
  /\bmove\s+towards?\s+a\s+meeting\b/i,
  /\baligns?\s+with\s+the\b/i,
]

function hasHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text)
}

/** A numbered or bulleted list whose items carry bold labels — the prompt template rendered. */
function looksLikeLabeledPlan(text: string): boolean {
  const listItems = text.match(/^\s*(?:\d+\.|[-*•])\s+/gm)
  if (!listItems || listItems.length < 2) return false
  return /\*\*[^*\n]{2,40}:?\s*\*\*/.test(text) || /^\s*\d+\.\s*\*\*/m.test(text)
}

export interface LeakCheckResult {
  leaked: boolean
  reason?: string
}

/**
 * Decide whether a sanitized response is an internal-reasoning leak rather than
 * a customer-facing reply. Callers must discard leaked text — never stream it
 * and never persist it.
 */
export function inspectResponse(text: string): LeakCheckResult {
  const trimmed = text.trim()

  if (!trimmed) return { leaked: true, reason: 'empty' }

  for (const pattern of LEAKED_LABEL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { leaked: true, reason: `prompt_label:${pattern.source.slice(0, 32)}` }
    }
  }

  for (const pattern of PLANNING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { leaked: true, reason: `planning:${pattern.source.slice(0, 32)}` }
    }
  }

  if (looksLikeLabeledPlan(trimmed)) {
    return { leaked: true, reason: 'labeled_plan' }
  }

  // The channel is Hebrew-only. A reply without a single Hebrew letter means the
  // customer's language overrode the persona — treat it as a failed turn.
  if (!hasHebrew(trimmed)) {
    return { leaked: true, reason: 'no_hebrew' }
  }

  return { leaked: false }
}

/** Convenience wrapper: strip marked blocks, then report whether what remains is usable. */
export function sanitizeAndInspect(rawText: string): { text: string } & LeakCheckResult {
  const text = stripThoughtBlock(rawText)
  return { text, ...inspectResponse(text) }
}

/**
 * Whether an outgoing reply belongs in ai_messages.
 *
 * Beyond leaks, two replies are streamed to the customer but deliberately not
 * stored: an image-only turn (no text to keep) and SAFE_FALLBACK_REPLY. Storing
 * the fallback would show the model stalling as its own precedent, whereas
 * omitting it leaves the customer's question unanswered in history so the next
 * turn addresses it properly.
 */
export function shouldPersistReply(text: string): { persist: boolean; reason?: string } {
  const trimmed = text.trim()

  if (!trimmed) return { persist: false, reason: 'no_text' }
  if (trimmed === SAFE_FALLBACK_REPLY) return { persist: false, reason: 'fallback' }

  const { leaked, reason } = inspectResponse(trimmed)
  if (leaked) return { persist: false, reason }

  return { persist: true }
}
