# 🔍 Диагностика Magic Link → /login редиректа

## Проблема

После перехода по Magic Link пользователь попадает на `/login` вместо `/app`.

---

## 🔍 Шаг 1: Проверьте Vercel Logs

После деплоя с улучшенным логированием:

1. **Vercel Dashboard** → https://vercel.com/max25782s-projects → `crm`
2. **Deployments** → последний деплой
3. **Functions** → Logs

### Ищите логи `[Callback]`:

```
[Callback] ===================
[Callback] Full URL: https://crm.pashkovsky-group.com/auth/callback?code=xxx...
[Callback] Code: ✓ (abc123...)
[Callback] Token: ✗
[Callback] Type: recovery
[Callback] Next: /app
[Callback] Error: none
[Callback] All params: { code: 'xxx', type: 'recovery', ... }
[Callback] ===================
[Callback] Exchanging code/token for session...
[Callback] ✓ Exchange successful
[Callback] Session user: user@example.com
[Callback] Cookies to set: 2
[Callback] Cookie names: sb-*-auth-token, sb-*-auth-token-code-verifier
[Callback] Redirecting to: /app
```

---

## 🐛 Возможные проблемы и решения

### ❌ Проблема 1: `Code: ✗` (нет code параметра)

**Логи покажут:**
```
[Callback] Code: ✗
[Callback] Token: ✗
[Callback] Missing both code and token parameters
```

**Причина:** Magic link использует implicit flow (`#access_token`), а не PKCE (`?code=`)

**Решение:** 
- Проверьте что используется правильный тип ссылки
- `recovery` и `invite` должны генерировать `?code=`
- Если видите `#access_token` → ссылка неправильного типа

---

### ❌ Проблема 2: `Exchange error: ...`

**Логи покажут:**
```
[Callback] ✗ Exchange error: Invalid code
[Callback] Error code: 400
```

**Возможные причины:**

1. **Code уже использован**
   - Решение: Сгенерируйте новый magic link

2. **Code expired (истёк)**
   - Решение: Сгенерируйте новый magic link

3. **Неправильный redirect_to в ссылке**
   - Проверьте: Magic link должен вести на `/auth/callback`
   - Не на `/app/admin` напрямую!

---

### ❌ Проблема 3: `Cookies to set: 0`

**Логи покажут:**
```
[Callback] ✓ Exchange successful
[Callback] Cookies to set: 0
[Callback] ⚠️ WARNING: No cookies collected!
```

**Причина:** `exchangeCodeForSession` не вернул cookies

**Решение:**
- Проверьте что используется правильный Supabase client (`createServerClient` из `@supabase/ssr`)
- Проверьте что `setAll` callback вызывается

---

### ❌ Проблема 4: `Supabase error in URL`

**Логи покажут:**
```
[Callback] Error: access_denied
[Callback] Error Description: ...
```

**Причина:** Supabase отклонил запрос

**Решение:**
- Проверьте Supabase Dashboard → Authentication → URL Configuration
- Убедитесь что `https://crm.pashkovsky-group.com/auth/callback` в списке Redirect URLs

---

## 🧪 Тест Magic Link

### 1. Сгенерируйте новый magic link

```
POST /api/superadmin/users/send-magic-link
{
  "email": "test@example.com"
}
```

### 2. Проверьте структуру ссылки

Вставьте magic link в текстовый редактор. Должна быть:

**✅ Правильно (PKCE):**
```
https://kvqupacmdishpfnscnio.supabase.co/auth/v1/verify?
  token=xxx
  &type=recovery  ← или 'invite'
  &redirect_to=https://crm.pashkovsky-group.com/auth/callback
```

**❌ Неправильно (Implicit):**
```
https://...supabase.co/auth/v1/verify?
  token=xxx
  &type=magiclink  ← Старый способ
  ...
```

### 3. Кликните на ссылку

**Откройте DevTools (F12) → Network tab**

Смотрите запросы:
1. `GET /auth/callback?code=xxx` ← должен быть
2. Response headers должны содержать `Set-Cookie: sb-*...`

### 4. Проверьте cookies

**DevTools → Application → Cookies**

Должны быть:
```
✓ sb-kvqupacmdishpfnscnio-auth-token
✓ sb-kvqupacmdishpfnscnio-auth-token-code-verifier
```

---

## 📊 Checklist диагностики

- [ ] Magic link содержит `?code=` (не `#access_token`)
- [ ] Magic link ведёт на `/auth/callback` (не `/app/admin`)
- [ ] Vercel logs показывают `[Callback] Code: ✓`
- [ ] Vercel logs показывают `[Callback] ✓ Exchange successful`
- [ ] Vercel logs показывают `Cookies to set: 2`
- [ ] Cookies установлены в браузере (DevTools → Cookies)
- [ ] После callback редирект на `/app` (не `/login`)

---

## 🔧 Быстрое исправление

Если проблема повторяется:

1. **Проверьте тип ссылки:**
   - Существующий пользователь → `recovery` ✅
   - Новый пользователь → `invite` ✅
   - НЕ используйте `magiclink` ❌

2. **Проверьте Supabase Dashboard:**
   - Site URL: `https://crm.pashkovsky-group.com`
   - Redirect URLs: `https://crm.pashkovsky-group.com/auth/callback`

3. **Сгенерируйте НОВЫЙ magic link** (старые могут быть expired)

4. **Проверьте Vercel logs** после клика на ссылку

---

## 📝 Что смотреть в логах

После клика на magic link в Vercel Logs должно быть:

```
[Callback] ===================
[Callback] Full URL: .../auth/callback?code=...
[Callback] Code: ✓ (...)
[Callback] Exchanging code/token for session...
[Callback] ✓ Exchange successful
[Callback] Session user: user@example.com
[Callback] Cookies to set: 2
[Callback] Cookie names: sb-*-auth-token, sb-*-auth-token-code-verifier
[Callback] Redirecting to: /app
```

Если видите что-то другое → покажите мне логи и я помогу исправить!

