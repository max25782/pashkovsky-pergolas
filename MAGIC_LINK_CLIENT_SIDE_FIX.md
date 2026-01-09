# 🔧 Альтернативное решение: Client-Side обработка Magic Link

## Проблема

Callback получает запрос **БЕЗ параметров**:
```
[Callback] Full URL: https://crm.pashkovsky-group.com/auth/callback
[Callback] Available params: []
```

Это означает что Supabase **НЕ передаёт `code` параметр** на сервер.

---

## Возможная причина

Recovery/signup/invite links могут использовать **client-side redirect** с hash fragments (`#access_token`), которые **не видны серверу**.

Даже если в magic link указан `redirect_to=/auth/callback`, Supabase может:
1. Проверить токен на своей стороне
2. Перенаправить на `/auth/callback` **БЕЗ параметров**
3. Ожидать что клиент извлечёт токен из hash fragment

---

## ✅ Решение: Client-Side обработка

Создать **client-side страницу** `/auth/callback` которая:
1. Извлекает токен из hash fragment (`#access_token=...`)
2. Обменивает его на session через Supabase client
3. Устанавливает cookies
4. Перенаправляет на `/app`

---

## Реализация

### 1. Создать Client Component для `/auth/callback`

**Файл:** `apps/crm/app/auth/callback/page.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient()
      
      // Check for code parameter (PKCE flow)
      const code = searchParams.get('code')
      
      if (code) {
        // PKCE flow - exchange code for session
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (error) {
          console.error('[Auth Callback] Exchange error:', error)
          router.push(`/login?error=${encodeURIComponent(error.message)}`)
          return
        }
        
        // Success - redirect to app
        router.push('/app')
        return
      }
      
      // Check for hash fragment (implicit flow fallback)
      const hash = window.location.hash.substring(1)
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      
      if (accessToken && refreshToken) {
        // Implicit flow - set session directly
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        
        if (error) {
          console.error('[Auth Callback] Set session error:', error)
          router.push(`/login?error=${encodeURIComponent(error.message)}`)
          return
        }
        
        // Success - redirect to app
        router.push('/app')
        return
      }
      
      // No parameters - redirect to login
      router.push('/login?error=missing_code')
    }
    
    handleCallback()
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing authentication...</p>
      </div>
    </div>
  )
}
```

### 2. Удалить Server Route `/auth/callback/route.ts`

Или переименовать его в `/auth/callback-server/route.ts` для fallback.

---

## Преимущества

1. ✅ Работает с любым типом magic link (recovery, invite, signup)
2. ✅ Обрабатывает как PKCE flow (`?code=`) так и implicit flow (`#access_token`)
3. ✅ Cookies устанавливаются через Supabase client автоматически
4. ✅ Не зависит от серверных настроек Supabase

---

## Недостатки

1. ❌ Требует JavaScript на клиенте
2. ❌ Может быть медленнее чем server-side обработка
3. ❌ Токены видны в URL (hash fragment)

---

## Альтернатива: Проверить логи генерации

Перед реализацией client-side решения, проверьте:

1. **Логи генерации Magic Link:**
   ```
   [SendMagicLink] Action link: ...
   [SendMagicLink] - redirect_to: ...
   ```

2. **Network tab в браузере:**
   - Откройте DevTools → Network
   - Кликните на magic link
   - Посмотрите все редиректы
   - Проверьте финальный URL перед `/auth/callback`

3. **Supabase Dashboard:**
   - Authentication → URL Configuration
   - Убедитесь что `/auth/callback` в Redirect URLs
   - Проверьте что Site URL правильный

---

## Рекомендация

**Сначала:** Проверьте логи генерации и Network tab чтобы понять что происходит.

**Если проблема остаётся:** Реализуйте client-side обработку как fallback.

