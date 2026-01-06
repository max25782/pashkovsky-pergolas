# PKCE Flow Fix - Magic Link Cookies

## 🚨 Корень проблемы

**`admin.generateLink()` с `type: 'magiclink'` использует implicit flow (`#access_token`), а НЕ PKCE flow (`?code=...`)**

```
❌ Старый flow (НЕ работает с SSR):
Magic link → #access_token → callback ищет ?code → НЕТ → /login?error=missing_code
```

```
✅ Новый flow (работает с SSR):
Magic link → ?code=xxx → callback exchange → cookies → /app
```

---

## ✅ Что исправлено

### 1. Magic Link Generation: `type: 'signup'` (PKCE)
**Файл:** `apps/crm/app/api/superadmin/users/send-magic-link/route.ts`

```typescript
// ❌ Было: implicit flow (#access_token)
const { data, error } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',  // ← implicit flow
  email,
  options: { redirectTo: callbackUrl }
})

// ✅ Стало: PKCE flow (?code=xxx)
const { data, error } = await supabaseAdmin.auth.admin.generateLink({
  type: 'signup',  // ← PKCE flow
  email,
  options: { redirectTo: callbackUrl }
})
```

**Почему `type: 'signup'`?**
- `'magiclink'` → Supabase returns `#access_token` (implicit)
- `'signup'` → Supabase returns `?code=xxx` (PKCE)
- `'invite'` → Same as signup (PKCE)

### 2. Auth Callback: Упрощён
**Файл:** `apps/crm/app/auth/callback/route.ts`

```typescript
// Минимальный, чистый код
// Default redirect: /app (не /app/admin)
// Короткие логи
const next = url.searchParams.get('next') || '/app'
```

### 3. Client: Чистый createBrowserClient
**Файл:** `apps/crm/lib/supabase/client.ts`

```typescript
// Убраны лишние хелперы
// Только createBrowserClient
export const supabase = createClient()
```

---

## 🧪 Как тестировать

### Шаг 1: Дождаться деплоя (2-3 минуты)
Коммит: `e5a8686`
Vercel: https://vercel.com/max25782s-projects

### Шаг 2: Сгенерировать НОВЫЙ magic link
**Важно:** Старые ссылки НЕ будут работать!

1. Зайдите: https://crm.pashkovsky-group.com/superadmin/companies
2. Нажмите "Send Magic Login Link"
3. Ссылка скопируется в clipboard

### Шаг 3: Проверить структуру ссылки
Вставьте в текстовый редактор:

**✅ Правильно (PKCE):**
```
https://kvqupacmdishpfnscnio.supabase.co/auth/v1/verify?
  token=xxx
  &type=signup  ← НЕ 'magiclink'!
  &redirect_to=https://crm.pashkovsky-group.com/auth/callback
```

**❌ Неправильно (implicit):**
```
https://...supabase.co/auth/v1/verify?
  token=xxx
  &type=magiclink  ← Старый способ
  ...
```

### Шаг 4: Открыть Safari Private (**⌘ + Shift + N**)

### Шаг 5: Вставить magic link → Enter

**Ожидаемое поведение:**
1. Supabase verify page (быстро)
2. Redirect → `/auth/callback?code=xxx&next=/app`
3. Callback exchange code → set cookies
4. Redirect → `/app`
5. `/app` page проверяет роль:
   - SuperAdmin → `/app/admin`
   - User → `/app/admin/deals`

### Шаг 6: Проверить cookies в Safari
**DevTools → Storage → Cookies:**

Должны быть:
```
✓ sb-kvqupacmdishpfnscnio-auth-token (длинный JWT)
✓ sb-kvqupacmdishpfnscnio-auth-token-code-verifier
```

**НЕ должно быть в localStorage:**
```
✗ sb-*-auth-token
```

### Шаг 7: Проверить через API
```javascript
fetch('/api/debug/auth').then(r => r.json()).then(console.log)
```

**Ожидаемый результат:**
```json
{
  "authenticated": true,
  "userId": "...",
  "email": "oryaron38@gmail.com",
  "hasCookies": true
}
```

---

## 🔍 Диагностика ошибок

### ❌ Всё ещё `#access_token` в URL

**Причина:** Деплой не завершился.

**Решение:**
1. Подождите 2-3 минуты
2. Проверьте Vercel: последний коммит `e5a8686`?
3. Сгенерируйте НОВЫЙ magic link (старые не работают)

---

### ❌ URL `/auth/callback?code=xxx`, но cookies пустые

**Причина:** `exchangeCodeForSession` failed.

**Диагностика:**
1. Откройте Vercel Logs: https://vercel.com/max25782s-projects → crm → Logs
2. Ищите:
```
[Callback] URL: https://crm.pashkovsky-group.com/auth/callback?code=xxx
[Callback] Code: ✓
[Callback] Success! Cookies: 2 → /app
```

**Если видите:**
```
[Callback] Exchange error: ...
```
→ Проблема с кодом (expired или уже использован)
→ Сгенерируйте новый magic link

---

### ❌ `authenticated: false` в `/api/debug/auth`

**Причина:** Cookies не видны серверу.

**Диагностика:**
1. DevTools → Storage → Cookies → `sb-*-auth-token`
2. Проверьте **Domain:**
   - Должен быть: `.pashkovsky-group.com` или `crm.pashkovsky-group.com`
3. Проверьте **HttpOnly:**
   - Должен быть: ✓
4. Проверьте **Path:**
   - Должен быть: `/`

**Если Domain неправильный:**
→ Supabase Dashboard → Authentication → URL Configuration
→ Site URL: `https://crm.pashkovsky-group.com`

---

## 📊 Vercel Logs (правильный flow)

```
[SendMagicLink] Generating magic link for: oryaron38@gmail.com
[SendMagicLink] Callback URL: https://crm.pashkovsky-group.com/auth/callback
[SendMagicLink] ✓ Magic link generated successfully
[SendMagicLink] Action link: https://kvqupacmdishpfnscnio.supabase.co/auth/v1/verify?...type=signup...
[SendMagicLink] redirect_to param: https://crm.pashkovsky-group.com/auth/callback

---

[Callback] URL: https://crm.pashkovsky-group.com/auth/callback?code=abc123...
[Callback] Code: ✓
[Callback] Success! Cookies: 2 → /app
```

---

## 🎯 Успешный тест

1. ✓ Magic link с `type=signup` и `?code=` (НЕ `#access_token`)
2. ✓ Клик в Safari Private → `/auth/callback?code=xxx`
3. ✓ Cookies установлены: `sb-*-auth-token`
4. ✓ localStorage пуст (нет `sb-*`)
5. ✓ `/api/debug/auth` → `authenticated: true`
6. ✓ Redirect → `/app` → `/app/admin` или `/app/admin/deals`
7. ✓ Нет бесконечных loops
8. ✓ Работает в Safari Incognito

---

## 📚 Ссылки

- Supabase PKCE Flow: https://supabase.com/docs/guides/auth/server-side/nextjs
- @supabase/ssr: https://github.com/supabase/auth-helpers
- Next.js Cookies: https://nextjs.org/docs/app/api-reference/functions/cookies

