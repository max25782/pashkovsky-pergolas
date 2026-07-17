/**
 * Strip internal reasoning artefacts from Gemini responses.
 *
 * gemini-2.5-flash sometimes leaks its chain-of-thought before the real answer:
 *
 *   THOUGHT: The user wants to see pergolas. I need to acknowledge…
 *
 *   שלום! הנה כמה פרויקטים…
 *
 * This text must never reach the end user or be saved to the database.
 * The function removes every variant and returns only the visible answer.
 */

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
