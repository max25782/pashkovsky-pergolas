# 📱 SuperAdmin Phone Login Setup

## ✅ Что сделано:

### 1. Database Changes
- ✅ Добавлена колонка `phone` в `platform_admins`
- ✅ Добавлен UNIQUE constraint
- ✅ Добавлен index для быстрого поиска
- ✅ Ваш номер `0524494848` связан с SuperAdmin аккаунтом

### 2. Login Page Updates
- ✅ Поддержка email И телефона
- ✅ Автоматическое определение типа ввода
- ✅ Проверка в `platform_admins` для телефонов
- ✅ Fallback на email для обычных пользователей

---

## 🚀 Как использовать:

### Шаг 1: Применить SQL миграцию

В Supabase SQL Editor запустите:

```sql
-- supabase/ADD_PHONE_TO_SUPERADMIN.sql
ALTER TABLE public.platform_admins
ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_platform_admins_phone 
ON public.platform_admins(phone);

UPDATE public.platform_admins
SET phone = '0524494848'
WHERE user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';
```

### Шаг 2: Перезапустить CRM

```bash
cd apps/crm
npm run dev
```

### Шаг 3: Тестировать логин

1. Откройте: `http://localhost:3001/login`

2. **Вход с телефоном:**
   ```
   Email or Phone: 0524494848
   Password: ваш_пароль
   ```

3. **Или с email (как обычно):**
   ```
   Email or Phone: office@pashkovsky-group.com
   Password: ваш_пароль
   ```

---

## 📋 Поддерживаемые форматы телефона:

- ✅ `0524494848` (Israeli format)
- ✅ `+972524494848` (International)
- ✅ `972524494848` (Without +)

Система автоматически определяет телефон если строка начинается с `0` или `+`.

---

## 🔐 Как это работает:

### Email Login (обычные пользователи):
```
Input: email@example.com + password
  ↓
Supabase Auth
  ↓
Login Success
```

### Phone Login (только SuperAdmin):
```
Input: 0524494848 + password
  ↓
Check platform_admins table by phone
  ↓
Get associated email
  ↓
Supabase Auth with email + password
  ↓
Login Success
```

---

## 🛡️ Безопасность:

- ✅ Только SuperAdmin могут входить по телефону
- ✅ Телефон проверяется в `platform_admins` с `is_active = true`
- ✅ Password всё равно требуется
- ✅ UNIQUE constraint предотвращает дубликаты
- ✅ Обычные пользователи не могут использовать телефон

---

## 📝 Добавить телефон другому SuperAdmin:

```sql
-- 1. Find the user
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';

-- 2. Add to platform_admins (if not exists)
INSERT INTO public.platform_admins (user_id, role, phone)
VALUES ('USER_ID_HERE', 'SUPERADMIN', '0501234567')
ON CONFLICT (user_id) DO UPDATE SET phone = '0501234567';

-- 3. Verify
SELECT * FROM public.platform_admins WHERE phone = '0501234567';
```

---

## 🧪 Тестирование:

### Test 1: Phone Login
```
URL: http://localhost:3001/login
Input: 0524494848
Password: your_password
Expected: ✅ Success, redirect to /app/admin
```

### Test 2: Email Login (should still work)
```
URL: http://localhost:3001/login
Input: office@pashkovsky-group.com
Password: your_password
Expected: ✅ Success, redirect to /app/admin
```

### Test 3: Invalid Phone
```
URL: http://localhost:3001/login
Input: 0999999999
Password: any_password
Expected: ❌ "Phone number not registered as SuperAdmin"
```

---

## ❓ Troubleshooting:

### "Phone number not registered as SuperAdmin"
**Solution:** 
```sql
SELECT * FROM public.platform_admins WHERE phone = '0524494848';
-- If empty, run UPDATE query again
```

### "Email not found for this phone number"
**Solution:**
```sql
-- Check if user_id is correct
SELECT pa.*, u.email 
FROM public.platform_admins pa
JOIN auth.users u ON u.id = pa.user_id
WHERE pa.phone = '0524494848';
```

### Phone login not working
1. Check phone format (must start with 0 or +)
2. Check `platform_admins` table has phone
3. Check `is_active = true`
4. Clear browser cache
5. Check console logs for errors

---

## 🎉 Done!

Теперь вы можете входить как:
- ✅ **Email:** office@pashkovsky-group.com
- ✅ **Phone:** 0524494848

Оба метода используют один и тот же password!

