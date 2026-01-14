# Тестирование Magic Link с SSR Cookies

## Что было исправлено:

**❌ Старая схема (cookies НЕ ставились):**
```
Magic link → https://crm.pashkovsky-group.com/app/admin
            └─ Напрямую на /app/admin (минуя callback)
            └─ Cookies НЕ установлены
            └─ Safari infinite loading
```

**✅ Новая схема (cookies ставятся правильно):**
```
Magic link → https://[supabase].supabase.co/auth/v1/verify?token=xxx&redirect_to=/auth/callback
            ↓
            /auth/callback?code=xxx
            ├─ exchangeCodeForSession(code)
            ├─ Накопление cookies: sb-*-auth-token, sb-*-auth-token-code-verifier
            ├─ Set-Cookie headers в response
            └─ Redirect → /app/admin
            
Результат: Cookies в браузере ✓
```

---

## Как правильно тестировать:

### Шаг 1: Дождаться деплоя на Vercel (2-3 минуты)

Проверьте что коммит `d30b643` задеплоился:
- Зайдите на https://vercel.com/max25782s-projects
- Убедитесь что статус: ✓ Ready

### Шаг 2: Сгенерировать НОВЫЙ magic link

**Важно:** Старые magic links НЕ будут работать! Нужен новый.

1. Зайдите на: https://crm.pashkovsky-group.com/superadmin/companies
2. Найдите компанию (например, oryaron38)
3. Нажмите **"Send Magic Login Link"**
4. Ссылка скопируется в clipboard

### Шаг 3: Проверить структуру magic link

Вставьте ссылку в текстовый редактор и проверьте:

**Должно быть так:**
```
https://kvqupacmdishpfnscnio.supabase.co/auth/v1/verify?
  token=abc123...
  &type=magiclink
  &redirect_to=https://crm.pashkovsky-group.com/auth/callback
            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            Это ОБЯЗАТЕЛЬНО должно быть /auth/callback
```

Если `redirect_to` ведёт на `/app/admin` — **значит деплой ещё не завершился**, подождите.

### Шаг 4: Открыть Safari Private Window

**macOS:**
- Горячие клавиши: **⌘ + Shift + N**
- Или: File → New Private Window

**Признаки Private mode:**
- Адресная строка тёмная
- В левом верхнем углу: "Private"

### Шаг 5: Вставить magic link в Safari Private

1. Вставьте magic link в адресную строку
2. Нажмите Enter
3. **Следите за редиректами:**
   - Verify page (Supabase)
   - → `/auth/callback?code=xxx` (должен быть быстрый редирект)
   - → `/app/admin` (финальная страница)

### Шаг 6: Проверить cookies в Safari

**Открыть DevTools:**
- **⌘ + Option + I** (или **⌘ + ⌥ + I**)
- Если не работает: Safari → Settings → Advanced → Show Develop menu
  - Затем: Develop → Show Web Inspector

**Перейти в Storage → Cookies:**

Должны быть cookies с именами:
```
✓ sb-kvqupacmdishpfnscnio-auth-token
✓ sb-kvqupacmdishpfnscnio-auth-token-code-verifier
```

**Проверить что НЕТ localStorage:**
- Storage → Local Storage
- Не должно быть ключей `sb-*-auth-token`

### Шаг 7: Проверить через debug endpoint

В консоли Safari DevTools выполните:

```javascript
fetch('/api/debug/auth').then(r => r.json()).then(console.log)
```

**Ожидаемый результат:**
```json
{
  "authenticated": true,
  "userId": "...",
  "email": "oryaron38@gmail.com",
  "hasCookies": true,
  "timestamp": "2026-01-06T..."
}
```

Если `authenticated: false` — **cookies НЕ работают**.

---

## Диагностика проблем:

### ❌ Проблема: `redirect_to` всё ещё `/app/admin`

**Причина:** Деплой не завершился.

**Решение:**
- Подождите 2-3 минуты
- Проверьте Vercel Dashboard
- Сгенерируйте новый magic link

---

### ❌ Проблема: Cookies пустые после клика на magic link

**Причина:** Не попали на `/auth/callback?code=xxx`.

**Диагностика:**
1. Откройте Safari DevTools **ДО** клика на magic link
2. Перейдите в **Network** tab
3. Кликните на magic link
4. Смотрите запросы:
   - Должен быть: `GET /auth/callback?code=xxx`
   - Response headers должны содержать `Set-Cookie: sb-*...`

**Если НЕТ запроса к `/auth/callback`:**
- Проблема: `redirect_to` в magic link неправильный
- Решение: Проверьте что деплой завершился

**Если ЕСТЬ запрос, но НЕТ `Set-Cookie`:**
- Проблема: `exchangeCodeForSession` не вернул cookies
- Решение: Проверьте server logs в Vercel

---

### ❌ Проблема: `authenticated: false` в debug endpoint

**Причина:** Cookies есть, но сервер не видит их.

**Диагностика:**
1. DevTools → Storage → Cookies
2. Проверьте **Domain** для `sb-*` cookies:
   - Должен быть: `.pashkovsky-group.com` (с точкой)
   - Или: `crm.pashkovsky-group.com`

3. Проверьте **Path**:
   - Должен быть: `/`

4. Проверьте **HttpOnly**:
   - Должен быть: ✓ (checked)

**Если Domain неправильный:**
- Проблема: Supabase Dashboard Site URL
- Решение: Измените в Supabase Dashboard:
  - Site URL: `https://crm.pashkovsky-group.com`

---

## Server Logs (Vercel)

Для диагностики смотрите логи в Vercel:

https://vercel.com/max25782s-projects → crm → Logs → Functions

Ищите:
```
[Auth Callback] ===================
[Auth Callback] Full URL: https://crm.pashkovsky-group.com/auth/callback?code=xxx
[Auth Callback] Code present: true
[Auth Callback] ✓ exchangeCodeForSession succeeded
[Auth Callback] Cookies collected: 2
[Auth Callback] Cookie names: sb-kvqupacmdishpfnscnio-auth-token, sb-kvqupacmdishpfnscnio-auth-token-code-verifier
[Auth Callback] → Set cookie: sb-kvqupacmdishpfnscnio-auth-token (length: 1234)
[Auth Callback] ✓ Redirecting to: /app/admin
```

**Если не видите этих логов:**
- Проблема: `/auth/callback` не вызывается
- Решение: Проверьте `redirect_to` в magic link

**Если видите `⚠️ WARNING: No cookies collected!`:**
- Проблема: `exchangeCodeForSession` не вернул cookies
- Возможная причина: `code` уже использован или expired
- Решение: Сгенерируйте новый magic link

---

## Успешный тест выглядит так:

1. ✓ Magic link с `redirect_to=/auth/callback`
2. ✓ Клик на ссылку в Safari Private
3. ✓ Быстрый редирект через `/auth/callback`
4. ✓ DevTools → Cookies: `sb-*-auth-token` присутствует
5. ✓ DevTools → Local Storage: пусто (нет `sb-*`)
6. ✓ `fetch('/api/debug/auth')` → `authenticated: true`
7. ✓ Страница `/app/admin` загружается без loops

---

## Следующий шаг после успешного теста:

Если всё работает → можно убрать временный debug endpoint:
```bash
rm apps/crm/app/api/debug/auth/route.ts
```

Или оставить для будущих диагностик (но добавить auth check).




