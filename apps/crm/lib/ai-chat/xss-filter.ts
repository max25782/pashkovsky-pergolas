// XSS Filter for AI Chat

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<embed\b/gi,
  /<object\b/gi,
  /<link\b/gi,
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
]

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  let sanitized = input.trim()
  
  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }
  
  // Escape HTML entities
  sanitized = sanitized.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char)
  
  // Limit length
  if (sanitized.length > 2000) {
    sanitized = sanitized.slice(0, 2000)
  }
  
  return sanitized
}

export function sanitizeForDisplay(text: string): string {
  if (!text || typeof text !== 'string') return ''
  
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}








