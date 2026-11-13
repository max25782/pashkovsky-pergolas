'use client'

import { useFirmProfile } from './useFirmProfile'

/** The current firm's name ('' until loaded). Used for greetings and other branded text. */
export function useCompanyName(): string {
  return useFirmProfile().profile.name
}
