export const SPEECH_LANGS = ['he-IL', 'ru-RU', 'en-US'] as const
export type SpeechLang = (typeof SPEECH_LANGS)[number]
const KEY = 'ai-director-speech-lang'

export function readSpeechLang(storage: Pick<Storage, 'getItem'> | null): SpeechLang {
  try {
    const value = storage?.getItem(KEY)
    if (value === 'he-IL' || value === 'ru-RU' || value === 'en-US') return value
  } catch {
    return 'he-IL'
  }
  return 'he-IL'
}

export function writeSpeechLang(storage: Pick<Storage, 'setItem'> | null, lang: SpeechLang): void {
  try {
    storage?.setItem(KEY, lang)
  } catch {
    // Private mode and blocked storage leave the choice for this visit only.
  }
}

export function speechSupported(hasRecognition: boolean, isSecure: boolean): 'ok' | 'insecure' | 'unsupported' {
  if (!isSecure) return 'insecure'
  if (!hasRecognition) return 'unsupported'
  return 'ok'
}

export type MicHint = 'https' | 'browser' | 'embedded' | 'denied' | 'no-device' | 'network'

/** Cursor's window is Electron. Its speech service always fails with a network error. */
export function speechHost(userAgent: string): 'ok' | 'embedded' {
  if (/Electron|Cursor\//.test(userAgent)) return 'embedded'
  return 'ok'
}

/** Maps a SpeechRecognition error to a hint. Silence is not a failure. */
export function micErrorKind(code: string): MicHint | null {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied'
  if (code === 'audio-capture') return 'no-device'
  if (code === 'network') return 'network'
  if (code === 'no-speech' || code === 'aborted') return null
  return 'browser'
}
