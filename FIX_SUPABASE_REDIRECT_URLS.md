# 🔧 Исправление Magic Link → /login редиректа

## 🚨 Проблема

После клика на magic link пользователь попадает на `/login?error=missing_code#error=access_denied&error_code=otp_expired`

**Признаки проблемы:**
- `#error=access_denied` в hash fragment → **implicit flow** (неправильно!)
- `error=missing_code` → callback не получил `code` параметр
- `error_code=otp_expired` → ссылка истекла или недействительна

---

## ✅ Решение

### Шаг 1: Проверьте Supabase Dashboard

1. **Откройте Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   ```

2. **Перейдите в Authentication → URL Configuration**

3. **Проверьте настройки:**

   **Site URL:**
   ```
   https://crm.pashkovsky-group.com
   ```

   **Redirect URLs** (добавьте все эти URL):
   ```
   https://crm.pashkovsky-group.com/auth/callback
   https://crm.pashkovsky-group.com/app/admin
   https://crm.pashkovsky-group.com/app/*
   ```

4. **Сохраните изменения**

---

### Шаг 2: Проверьте тип Magic Link

Magic link должен использовать **PKCE flow**, а не implicit flow.

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
  &type=magiclink  ← НЕ используйте это!
  ...
```

**Как проверить:**
1. Сгенерируйте новый magic link
2. Откройте ссылку в текстовом редакторе
3. Проверьте параметр `type`:
   - ✅ `type=recovery` или `type=invite` → PKCE flow
   - ❌ `type=magiclink` → implicit flow (не работает с SSR cookies)

---

### Шаг 3: Проверьте код генерации Magic Link

**Файл:** `apps/crm/app/api/superadmin/users/send-magic-link/route.ts`

Убедитесь что используется правильный тип:

```typescript
// ✅ Правильно
const linkType = existingUser ? 'recovery' : 'invite'

const { data, error } = await supabaseAdmin.auth.admin.generateLink({
  type: linkType as any,  // 'recovery' или 'invite'
  email,
  options: {
    redirectTo: callbackUrl,  // Должен быть /auth/callback
  },
})
```

**НЕ используйте:**
- ❌ `type: 'magiclink'` → implicit flow
- ❌ `type: 'signup'` → требует password

---

### Шаг 4: Проверьте время жизни токена

По умолчанию Supabase magic links действуют **1 час**.

Если ссылка истекла (`otp_expired`):
1. Сгенерируйте **новый** magic link
2. Используйте его **сразу** (в течение часа)

---

### Шаг 5: Проверьте логи Vercel

После клика на magic link проверьте Vercel Logs:

**Vercel Dashboard** → **Deployments** → **Functions** → **Logs**

Ищите логи `[Callback]`:

**✅ Правильно:**
```
[Callback] Full URL: .../auth/callback?code=xxx...
[Callback] Code: ✓ (abc123...)
[Callback] ✓ Exchange successful
```

**❌ Неправильно:**
```
[Callback] Hash: #error=access_denied...
[Callback] ⚠️ Hash fragment detected - this indicates implicit flow!
[Callback] ❌ CRITICAL: Hash fragment error indicates implicit flow!
```

---

## 🔍 Диагностика

### Проблема 1: Hash fragment вместо query params

**Симптомы:**
- URL содержит `#error=...` вместо `?error=...`
- Callback не получает `code` параметр

**Причина:**
- Magic link использует implicit flow (`type: 'magiclink'`)
- Или Supabase redirect URL не настроен

**Решение:**
1. Проверьте тип ссылки (должен быть `recovery` или `invite`)
2. Проверьте Supabase Redirect URLs
3. Сгенерируйте новый magic link

---

### Проблема 2: `otp_expired`

**Симптомы:**
- `error_code=otp_expired`
- `error_description=Email+link+is+invalid+or+has+expired`

**Причина:**
- Magic link истёк (обычно 1 час)
- Или токен уже использован

**Решение:**
1. Сгенерируйте **новый** magic link
2. Используйте его сразу

---

### Проблема 3: `access_denied`

**Симптомы:**
- `error=access_denied`
- Callback не вызывается

**Причина:**
- Supabase отклоняет запрос
- Redirect URL не в списке разрешённых

**Решение:**
1. Проверьте Supabase Dashboard → Authentication → URL Configuration
2. Убедитесь что `https://crm.pashkovsky-group.com/auth/callback` в Redirect URLs
3. Сохраните изменения
4. Сгенерируйте новый magic link

---

## ✅ Checklist

- [ ] Supabase Site URL: `https://crm.pashkovsky-group.com`
- [ ] Redirect URLs содержат `/auth/callback`
- [ ] Magic link использует `type: 'recovery'` или `type: 'invite'`
- [ ] Magic link не истёк (использован в течение часа)
- [ ] Vercel logs показывают `[Callback] Code: ✓`
- [ ] Нет hash fragments в URL (только query params)

---

## 🧪 Тест после исправления

1. **Сгенерируйте новый magic link:**
   ```bash
   POST /api/superadmin/users/send-magic-link
   {
     "email": "test@example.com"
   }
   ```

2. **Проверьте структуру ссылки:**
   - Должна содержать `?token=xxx&type=recovery&redirect_to=.../auth/callback`
   - НЕ должна содержать `#access_token`

3. **Кликните на ссылку**

4. **Проверьте URL после редиректа:**
   - ✅ Должен быть: `/auth/callback?code=xxx`
   - ❌ НЕ должен быть: `/login?error=...#error=...`

5. **Проверьте Vercel Logs:**
   - Должны быть логи `[Callback] ✓ Exchange successful`
   - НЕ должно быть `Hash fragment detected`

---

## 📝 После исправления

Если всё настроено правильно:
1. Magic link будет использовать PKCE flow (`?code=xxx`)
2. Callback получит `code` параметр
3. Cookies установятся правильно
4. Пользователь попадёт на `/app` (не `/login`)




