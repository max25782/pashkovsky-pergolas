import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export function createClient() {
  const store = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll()
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options)
          }
        },
      },
    }
  )
}
