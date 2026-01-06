# Как протестировать Magic Link

## 🔗 Magic Link для пользователя oryaron38@gmail.com

```
https://kvqupacmdishpfnscnio.supabase.co/auth/v1/verify?token=25e799a2abb92920abf39a2901336ffb8b7af7f7c2b09891dd89e8de&type=magiclink&redirect_to=http://localhost:3001/app/admin
```

---

## ✅ Способ 1: Тестирование в браузере (Рекомендуется)

### Шаги:

1. **Скопируйте ссылку выше**

2. **Откройте новую вкладку в режиме инкогнито** (чтобы не мешала текущая сессия SuperAdmin):
   - Chrome/Edge: `Cmd+Shift+N` (Mac) или `Ctrl+Shift+N` (Windows)
   - Safari: `Cmd+Shift+N`
   - Firefox: `Cmd+Shift+P`

3. **Вставьте ссылку в адресную строку** и нажмите Enter

4. **Что должно произойти:**
   - ✅ Supabase проверит токен
   - ✅ Автоматически войдет в систему
   - ✅ Перенаправит на `http://localhost:3001/app/admin`
   - ✅ Вы увидите CRM dashboard компании **oryaron38**
   - ✅ В правом верхнем углу будет email: `oryaron38@gmail.com`

5. **Проверьте:**
   - Название компании в шапке: должно быть **oryaron38**
   - Email пользователя в профиле
   - Доступ к разделам: Deals, Leads, Workers и т.д.

---

## ✅ Способ 2: Через CRM UI

1. **Откройте CRM** в браузере: `http://localhost:3001/superadmin/companies`

2. **Найдите компанию** `oryaron38` и нажмите **"View"**

3. **Прокрутите вниз** до секции **"Send Login Access"**

4. **Нажмите кнопку** "Send Magic Login Link"

5. **Скопируйте ссылку** из буфера обмена (она автоматически скопируется)

6. **Откройте в режиме инкогнито** и проверьте

---

## ✅ Способ 3: Через API (для автоматизации)

```bash
# Генерация magic link
curl -X POST http://localhost:3001/api/superadmin/users/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "oryaron38@gmail.com",
    "redirectTo": "http://localhost:3001/app/admin"
  }'
```

**Ответ:**
```json
{
  "success": true,
  "message": "Magic link sent to oryaron38@gmail.com",
  "magicLink": "https://kvqupacmdishpfnscnio.supabase.co/auth/v1/verify?token=...&type=magiclink&redirect_to=http://localhost:3001/app/admin"
}
```

Скопируйте `magicLink` и откройте в браузере.

---

## ✅ Способ 4: Через Supabase Dashboard

1. Откройте **Supabase Dashboard**
2. Перейдите в **Authentication** → **Users**
3. Найдите пользователя `oryaron38@gmail.com`
4. Нажмите на пользователя
5. Нажмите **"Send magic link"**
6. В поле **Redirect URL** введите: `http://localhost:3001/app/admin`
7. Нажмите **"Send magic link"**
8. Скопируйте ссылку из email preview (или из логов)

---

## 🔍 Что проверить после входа:

### 1. Правильная компания
- Название компании в шапке: **oryaron38**
- URL: `http://localhost:3001/app/admin`

### 2. Правильный пользователь
- Email в профиле: `oryaron38@gmail.com`
- Роль: **owner**

### 3. Подписка
- План: **Enterprise**
- Статус: **Active**
- Срок действия: **1 месяц** (30 дней)

### 4. Доступ к функциям
- ✅ Deals (Сделки)
- ✅ Leads (Лиды)
- ✅ Workers (Рабочие)
- ✅ Settings (Настройки)
- ✅ AI Director

---

## ❌ Возможные проблемы:

### Проблема 1: "Invalid or expired link"
**Причина:** Токен истек (обычно действует 1 час)

**Решение:** Сгенерируйте новый magic link

### Проблема 2: Редирект на localhost:3000 вместо 3001
**Причина:** Неправильный `redirectTo` в Supabase Site URL

**Решение:** 
1. Откройте Supabase Dashboard
2. **Authentication** → **URL Configuration**
3. Добавьте в **Redirect URLs**:
   - `http://localhost:3001/app/admin`
   - `http://localhost:3001/app/*`

### Проблема 3: "User not found" или "Company not found"
**Причина:** Пользователь или компания не созданы

**Решение:** Проверьте в Supabase:
```sql
-- Проверить пользователя
SELECT * FROM auth.users WHERE email = 'oryaron38@gmail.com';

-- Проверить компанию
SELECT * FROM companies WHERE primary_email = 'oryaron38@gmail.com';

-- Проверить роль
SELECT * FROM company_members WHERE user_id = '...';
```

### Проблема 4: Редирект на Pashkovsky Group вместо oryaron38
**Причина:** Логика определения активной компании в `company-context.ts`

**Решение:** Уже исправлено - система выбирает последнюю созданную компанию, где пользователь owner

---

## 📝 Логи для отладки

### Проверить логи сервера:
```bash
# В терминале где запущен npm run dev
# Ищите строки:
# [CompanyContext] User companies: ...
# [CompanyContext] Selected company: ...
```

### Проверить в браузере:
1. Откройте **DevTools** (F12)
2. **Console** - ищите ошибки
3. **Network** - проверьте запросы к `/api/companies/me`
4. **Application** → **Cookies** - проверьте наличие `sb-access-token`

---

## ✅ Успешный тест выглядит так:

1. ✅ Кликаете по magic link
2. ✅ Видите "Redirecting..." или спиннер
3. ✅ Перенаправляет на `/app/admin`
4. ✅ Видите dashboard с названием компании **oryaron38**
5. ✅ Email в профиле: `oryaron38@gmail.com`
6. ✅ Все разделы доступны
7. ✅ Подписка: Enterprise, Active, 30 дней

---

## 🚀 Готово к продакшену?

Для production нужно:

1. **Обновить Redirect URLs в Supabase:**
   - `https://crm.pashkovsky-group.com/app/admin`
   - `https://crm.pashkovsky-group.com/app/*`
   - `https://crm.pashkovsky-group.com/auth/callback`

2. **Обновить Site URL:**
   - `https://crm.pashkovsky-group.com`

3. **Тестировать magic link с production URL:**
   ```bash
   curl -X POST https://crm.pashkovsky-group.com/api/superadmin/users/send-magic-link \
     -H "Content-Type: application/json" \
     -d '{
       "email": "oryaron38@gmail.com",
       "redirectTo": "https://crm.pashkovsky-group.com/app/admin"
     }'
   ```

