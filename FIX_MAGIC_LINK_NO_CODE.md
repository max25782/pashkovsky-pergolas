# Fix: Magic Link Redirects Without Code Parameter

## 🚨 Проблема

Callback получает запрос на `/auth/callback` БЕЗ параметров:
```
[Callback] URL: /auth/callback
[Callback] Has code: false
[Callback] Has hash: false
[Callback] All search params: {}
```

## 🔍 Причина

Supabase `generateLink` генерирует ссылку на Supabase verify страницу:
```
https://PROJECT.supabase.co/auth/v1/verify?token=xxx&type=invite&redirect_to=https://crm.pashkovsky-group.com/auth/callback
```

Эта verify страница должна редиректить на `redirect_to` с параметром `?code=...`, но если:
1. `redirect_to` не совпадает с настройками в Supabase Dashboard → редирект без параметров
2. PKCE не включен в настройках → редирект с hash вместо code
3. Ссылка истекла → редирект с ошибкой

## ✅ Решение

### Шаг 1: Проверьте Supabase Dashboard

1. Откройте: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/auth/url-configuration

2. **Site URL** должен быть:
   ```
   https://crm.pashkovsky-group.com
   ```

3. **Redirect URLs** должны включать ТОЧНО:
   ```
   https://crm.pashkovsky-group.com/auth/callback
   ```
   
   ⚠️ Важно: URL должен совпадать ТОЧНО, включая:
   - Протокол (`https://`)
   - Домен (`crm.pashkovsky-group.com`)
   - Путь (`/auth/callback`)
   - Без trailing slash

4. **PKCE** должен быть включен:
   - Authentication → Providers → Email → Enable PKCE: ✅ Enabled

### Шаг 2: Проверьте логи генерации ссылки

После отправки invite проверьте логи Vercel:

**Должно быть:**
```
[InviteUser] Link analysis: {
  hasCode: false,  // Это нормально - code будет добавлен при редиректе
  hasHash: false,
  redirectTo: 'https://crm.pashkovsky-group.com/auth/callback',
  type: 'invite' или 'recovery',
  hasToken: true
}
```

**Если видите ошибку:**
```
[InviteUser] ❌ CRITICAL: redirect_to in link does not match callbackUrl!
```
→ Значит `redirect_to` в ссылке не совпадает с настройками Supabase Dashboard

### Шаг 3: Проверьте сгенерированную ссылку

1. Откройте email с magic link
2. Скопируйте ссылку
3. Проверьте структуру:

**✅ Правильно:**
```
https://PROJECT.supabase.co/auth/v1/verify?
  token=xxx
  &type=invite  (или recovery)
  &redirect_to=https://crm.pashkovsky-group.com/auth/callback
```

**❌ Неправильно:**
```
https://PROJECT.supabase.co/auth/v1/verify?
  token=xxx
  &type=magiclink  ← НЕ используйте это!
  &redirect_to=http://localhost:3001/auth/callback  ← Неправильный домен
```

### Шаг 4: Тестирование

1. Откройте magic link в браузере
2. Должно произойти:
   - Redirect на Supabase verify страницу (быстро)
   - Redirect на `/auth/callback?code=xxx&next=/app` (с параметрами!)
   - Callback устанавливает cookies
   - Redirect на `/app`

3. Если callback получает запрос БЕЗ параметров:
   - Проверьте Redirect URLs в Supabase Dashboard
   - Убедитесь, что URL совпадает ТОЧНО
   - Проверьте, что PKCE включен

## 🔧 Альтернативное решение

Если проблема сохраняется, можно использовать `inviteUserByEmail` вместо `generateLink`:

```typescript
// Supabase сам отправит email с правильной ссылкой
await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  redirectTo: callbackUrl,
})
```

Этот метод гарантирует, что Supabase использует правильные настройки из Dashboard.

