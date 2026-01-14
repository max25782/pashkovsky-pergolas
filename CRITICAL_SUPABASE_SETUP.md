# 🚨 КРИТИЧНО: Настройка Supabase Redirect URLs

## Проблема

Callback получает запрос **БЕЗ параметров**:
```
[Callback] Full URL: https://crm.pashkovsky-group.com/auth/callback
[Callback] Available params: []
```

Это означает что **Supabase НЕ передаёт `code` параметр**, потому что `/auth/callback` **НЕ в списке разрешённых Redirect URLs**.

---

## ✅ Решение (ОБЯЗАТЕЛЬНО!)

### Шаг 1: Откройте Supabase Dashboard

1. Перейдите: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. **Authentication** → **URL Configuration**

### Шаг 2: Настройте Site URL

**Site URL:**
```
https://crm.pashkovsky-group.com
```

### Шаг 3: Добавьте Redirect URLs (КРИТИЧНО!)

**Redirect URLs** - добавьте **ВСЕ** эти URL (каждый на новой строке):

```
https://crm.pashkovsky-group.com/auth/callback
https://crm.pashkovsky-group.com/app/admin
https://crm.pashkovsky-group.com/app/*
```

**⚠️ ВАЖНО:**
- Каждый URL на **отдельной строке**
- Без запятых, без пробелов
- Точное совпадение с доменом (с `https://`)

### Шаг 4: Сохраните изменения

Нажмите **"Save"** внизу страницы.

---

## 🔍 Как проверить что настройка правильная

### 1. Проверьте логи генерации Magic Link

В Vercel Logs найдите запрос к `/api/superadmin/users/send-magic-link`:

Должны быть логи:
```
[SendMagicLink] Callback URL: https://crm.pashkovsky-group.com/auth/callback
[SendMagicLink] Action link: https://...supabase.co/auth/v1/verify?token=xxx&type=recovery&redirect_to=https://crm.pashkovsky-group.com/auth/callback
```

**Проверьте:**
- `redirect_to` параметр должен быть `https://crm.pashkovsky-group.com/auth/callback`
- Если `redirect_to` другой или отсутствует → проблема в коде генерации

### 2. Проверьте структуру Magic Link

Откройте magic link в текстовом редакторе. Должна быть:

**✅ Правильно:**
```
https://kvqupacmdishpfnscnio.supabase.co/auth/v1/verify?
  token=xxx
  &type=recovery  ← или 'invite'
  &redirect_to=https://crm.pashkovsky-group.com/auth/callback  ← ДОЛЖЕН БЫТЬ!
```

**❌ Неправильно:**
```
https://...supabase.co/auth/v1/verify?
  token=xxx
  &redirect_to=https://crm.pashkovsky-group.com/app/admin  ← НЕПРАВИЛЬНО!
```

### 3. Проверьте что происходит после клика

После клика на magic link:

1. **Supabase проверяет `redirect_to`** против списка Redirect URLs
2. **Если URL не в списке:**
   - Supabase **игнорирует** `redirect_to`
   - Перенаправляет на **Site URL** (`https://crm.pashkovsky-group.com`)
   - **БЕЗ параметров** → callback получает пустой запрос

3. **Если URL в списке:**
   - Supabase перенаправляет на `redirect_to` с `?code=xxx`
   - Callback получает `code` параметр
   - Всё работает ✅

---

## 🧪 Тест после настройки

1. **Настройте Supabase Dashboard** (см. выше)

2. **Сгенерируйте НОВЫЙ magic link:**
   ```bash
   POST /api/superadmin/users/send-magic-link
   {
     "email": "test@example.com"
   }
   ```

3. **Проверьте структуру ссылки:**
   - Должна содержать `redirect_to=https://crm.pashkovsky-group.com/auth/callback`

4. **Кликните на ссылку**

5. **Проверьте Vercel Logs:**
   ```
   [Callback] Full URL: https://crm.pashkovsky-group.com/auth/callback?code=xxx...
   [Callback] Code: ✓ (abc123...)
   [Callback] ✓ Exchange successful
   ```

---

## ❌ Если проблема остаётся

### Проверьте логи генерации Magic Link

В Vercel Logs найдите:
```
[SendMagicLink] Action link: ...
[SendMagicLink] redirect_to param: ...
```

**Если `redirect_to param` пустой или другой:**
- Проблема в коде генерации
- Проверьте что `callbackUrl` правильный

**Если `redirect_to param` правильный:**
- Проблема в Supabase Dashboard
- Убедитесь что URL **точно совпадает** (с `https://`, без trailing slash)

### Проверьте Supabase Dashboard ещё раз

1. **Authentication** → **URL Configuration**
2. Убедитесь что:
   - Site URL: `https://crm.pashkovsky-group.com`
   - Redirect URLs содержат: `https://crm.pashkovsky-group.com/auth/callback`
3. **Сохраните** изменения
4. Подождите **1-2 минуты** (настройки применяются не мгновенно)

---

## 📝 Checklist

- [ ] Supabase Dashboard открыт
- [ ] Authentication → URL Configuration
- [ ] Site URL: `https://crm.pashkovsky-group.com`
- [ ] Redirect URLs содержат `/auth/callback`
- [ ] Каждый URL на отдельной строке
- [ ] Сохранены изменения
- [ ] Сгенерирован НОВЫЙ magic link
- [ ] Magic link содержит правильный `redirect_to`
- [ ] Vercel logs показывают `[Callback] Code: ✓`

---

## 🎯 После правильной настройки

Magic link будет работать так:

1. Пользователь кликает на magic link
2. Supabase проверяет email и токен
3. Supabase перенаправляет на `/auth/callback?code=xxx`
4. Callback получает `code` параметр
5. Callback обменивает `code` на session
6. Cookies устанавливаются
7. Пользователь перенаправляется на `/app` ✅




