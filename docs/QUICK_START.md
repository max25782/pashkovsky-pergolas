# 🚀 QUICK START - Исправление и запуск CRM

## ⚡ ЧТО ДЕЛАТЬ СЕЙЧАС (5 минут):

### 1️⃣ **Выполните миграцию в Supabase SQL Editor**

Откройте: `supabase/MIGRATION_STEPS.sql`

Скопируйте **ВСЁ** и выполните в Supabase SQL Editor.

Это сделает:
- ✅ Очистит `company_members`
- ✅ Изменит FK на `auth.users`
- ✅ Отключит RLS

**Ожидаемый результат:**
```
FK updated to auth.users

tablename | rls_enabled
----------|------------
deals     | false
leads     | false
offers    | false
workers   | false
```

---

### 2️⃣ **Перезапустите CRM dev server**

В терминале:
```powershell
cd apps/crm
npm run dev
```

---

### 3️⃣ **Зарегистрируйтесь заново**

1. Откройте: `http://localhost:3001/register`
2. Заполните форму:
   - **Email:** office@pashkovsky-group.com
   - **Password:** (минимум 8 символов)
   - **Full Name:** Ваше имя
   - **Company Name:** Pashkovsky Group
   - **Industry:** Aluminum & Pergolas

3. Нажмите **"Create Account"**

**ЧТО ПРОИЗОЙДЕТ:**
- Создастся пользователь в `auth.users` (Supabase Auth)
- Создастся компания
- `company_members` свяжет `auth.users.id` с `company_id`

---

### 4️⃣ **Проверьте email**

Supabase отправит **confirmation email**. Проверьте почту и подтвердите.

---

### 5️⃣ **Войдите в CRM**

После подтверждения email:
- Откройте: `http://localhost:3001/login`
- Войдите с вашим email/password
- Вы попадете в `/app/admin`

---

### 6️⃣ **Проверьте Workers страницу**

- Откройте: `http://localhost:3001/app/admin/workers`
- Должен показаться: **גיוסי גולד | 0524494848 | 1000₪**

---

## 🎉 ВСЁ РАБОТАЕТ!

После этих шагов у вас будет:
- ✅ Supabase Auth работает
- ✅ Email/Password login
- ✅ Регистрация с созданием компании
- ✅ RLS отключен (для development)
- ✅ Все данные (deals, workers) видны

---

## 🔐 ПОТОМ (когда будет время):

1. **Настройте Google OAuth** (15 минут)
   - Следуйте инструкциям в `docs/SUPABASE_AUTH_SETUP.md`
   
2. **Включите RLS** (5 минут)
   - Выполните `supabase/migrations/019_enable_rls_with_policies.sql`
   - Протестируйте multi-tenancy

---

## 📝 Краткое резюме изменений:

| Было | Стало |
|------|-------|
| `public.users` (кастомная таблица) | `auth.users` (Supabase Auth) |
| Кастомный JWT | Supabase session |
| `admin_token` в localStorage | Supabase Auth token (автоматически) |
| RLS не работал | RLS готов (отключен для dev) |
| `/api/auth/register` создавал `public.users` | `/register` использует Supabase Auth |

---

**Начните с STEP 1 - выполните `MIGRATION_STEPS.sql` в Supabase!** 🚀

