# 🔐 Supabase Auth Setup Guide

## ✅ Что уже сделано:

1. ✅ Обновлен Supabase client (`apps/crm/lib/supabase/client.ts`)
2. ✅ Обновлена Login page для Supabase OAuth
3. ✅ Обновлена Register page для Supabase Auth
4. ✅ Создан auth callback route (`/auth/callback`)
5. ✅ Создан API для setup company (`/api/auth/setup-company`)

---

## 📋 Что нужно сделать в Supabase Dashboard:

### 1. Настройка Google OAuth

1. **Откройте Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   ```

2. **Перейдите в Authentication → Providers:**
   - Найдите "Google" в списке провайдеров
   - Включите Google provider

3. **Получите Google OAuth credentials:**
   - Откройте [Google Cloud Console](https://console.cloud.google.com/)
   - Выберите ваш проект или создайте новый
   - Перейдите в **APIs & Services → Credentials**
   - Нажмите **Create Credentials → OAuth 2.0 Client ID**
   - Выберите **Web application**
   - **Authorized redirect URIs** добавьте:
     ```
     https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
     ```
   - Скопируйте **Client ID** и **Client Secret**

4. **Вставьте credentials в Supabase:**
   - Вернитесь в Supabase Dashboard → Authentication → Providers → Google
   - Вставьте **Client ID**
   - Вставьте **Client Secret**
   - Нажмите **Save**

5. **Настройте Redirect URLs в Supabase:**
   - Перейдите в Authentication → URL Configuration
   - **Site URL**: `http://localhost:3001` (для development)
   - **Redirect URLs** добавьте:
     ```
     http://localhost:3001/auth/callback
     http://localhost:3001/app/admin
     ```

---

### 2. Проверка RLS Policies

Ваши RLS policies уже созданы в миграции `019_enable_rls_with_policies.sql`.

**Важно:** RLS policies используют `auth.uid()` - это ID пользователя из **Supabase Auth**, а не из таблицы `users`!

**Проверьте что `company_members` использует правильный `user_id`:**

```sql
-- Check company_members table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'company_members' 
AND column_name = 'user_id';
```

**Если `user_id` ссылается на `public.users.id`**, нужно изменить на `auth.users.id` (UUID из Supabase Auth).

---

### 3. Миграция существующих пользователей (OPTIONAL)

Если у вас уже есть пользователи в `public.users`, их нужно мигрировать:

**Вариант A: Создать Supabase Auth users для существующих**
```sql
-- This would require service role key and custom script
-- Not recommended - better to re-register
```

**Вариант B: Пересоздать аккаунты (RECOMMENDED)**
- Попросите пользователей зарегистрироваться заново через новую форму
- Старые данные (leads, deals) останутся в `company_id`

---

### 4. Обновление `company_members.user_id`

**КРИТИЧЕСКИ ВАЖНО:** `company_members.user_id` должен ссылаться на `auth.users.id`, а не на `public.users.id`!

**Проверьте foreign key:**
```sql
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'company_members'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'user_id';
```

**Если ссылается на `public.users`**, нужно изменить:

```sql
-- Drop old FK
ALTER TABLE public.company_members 
DROP CONSTRAINT IF EXISTS company_members_user_id_fkey;

-- Create new FK to auth.users
ALTER TABLE public.company_members
ADD CONSTRAINT company_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;
```

---

### 5. Включение RLS

**После того как:**
1. ✅ Google OAuth настроен
2. ✅ `company_members.user_id` ссылается на `auth.users`
3. ✅ RLS policies созданы

**Выполните:**
```sql
-- Disable RLS first (clean slate)
ALTER TABLE public.deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own company deals" ON public.deals;
DROP POLICY IF EXISTS "Users can insert own company deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update own company deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete own company deals" ON public.deals;

-- ... repeat for leads, workers, offers ...

-- Now run migration 019_enable_rls_with_policies.sql
```

---

## 🧪 Тестирование

### 1. Test Registration
```bash
1. Откройте http://localhost:3001/register
2. Зарегистрируйтесь с email/password
3. Проверьте email для подтверждения
4. После подтверждения - войдите
```

### 2. Test Google OAuth
```bash
1. Откройте http://localhost:3001/login
2. Нажмите "Continue with Google"
3. Выберите Google аккаунт
4. Должен создаться пользователь и компания
```

### 3. Test RLS
```sql
-- As authenticated user, should see only your company's data
SELECT * FROM deals;
SELECT * FROM leads;
SELECT * FROM workers;
```

---

## 🎯 Следующие шаги:

1. ⏳ Настройте Google OAuth в Supabase Dashboard
2. ⏳ Проверьте/обновите `company_members.user_id` foreign key
3. ⏳ Включите RLS с policies
4. ⏳ Протестируйте регистрацию и логин
5. ⏳ Протестируйте multi-tenancy

---

## ⚠️ Production Checklist:

- [ ] Google OAuth настроен с production redirect URLs
- [ ] Site URL в Supabase указывает на production domain
- [ ] RLS включен на всех таблицах
- [ ] Email templates настроены (Supabase → Authentication → Email Templates)
- [ ] Rate limiting включен (уже есть в коде)
- [ ] HTTPS enabled для production domain

---

**Готовы продолжать?** Скажите когда настроите Google OAuth, и я помогу с тестированием! 🚀

