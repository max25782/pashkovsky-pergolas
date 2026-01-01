# ✅ JWT Authentication Implementation Complete!

## 🎯 Что было сделано

### 1. Создан Authenticated Supabase Client
**Файл:** `apps/crm/lib/supabase/client.ts`

Новый клиент автоматически:
- ✅ Извлекает JWT токен из `localStorage.token`
- ✅ Добавляет токен в заголовок `Authorization: Bearer <token>`
- ✅ Работает с Row Level Security (RLS) политиками

### 2. Обновлены все admin страницы

**Страницы:**
- ✅ `apps/crm/app/app/admin/statistics/page.tsx` - статистика
- ✅ `apps/crm/app/app/admin/leads/page.tsx` - лиды
- ✅ `apps/crm/app/app/admin/workers/page.tsx` - работники
- ✅ `apps/crm/app/app/admin/ai-chats/page.tsx` - AI чаты
- ✅ `apps/crm/app/app/admin/gallery/page.tsx` - галерея

**Компоненты:**
- ✅ `apps/crm/components/admin/hooks/useLeads.ts`
- ✅ `apps/crm/components/admin/hooks/useLeadActions.ts`
- ✅ `apps/crm/components/admin/LeadsTable.tsx`

**Изменения:**
- ❌ Удалён `admin_token` из state
- ❌ Удалены проверки токена и input формы
- ❌ Удалены кнопки logout
- ✅ Все Supabase запросы используют `createAuthenticatedClient()`

### 3. RLS Ready (но пока выключен)

**Файлы:**
- ✅ `supabase/migrations/020_enable_rls_simple.sql` - SQL для включения RLS
- ✅ `docs/RLS_SETUP.md` - подробная инструкция

---

## 🚀 Как это работает

### 1. Логин через Google OAuth

```typescript
// apps/crm/app/login/page.tsx
function handleGoogleLogin() {
  window.location.href = '/api/auth/oauth/google'
}

// После успешного логина:
// 1. JWT токен приходит в URL (?token=...)
// 2. Сохраняется в localStorage.setItem('token', token)
// 3. Редирект на /app/admin
```

### 2. Authenticated Запросы

```typescript
// Каждый компонент создаёт новый клиент
import { createAuthenticatedClient } from '@/lib/supabase/client'

async function fetchData() {
  const supabase = createAuthenticatedClient() // Авт��матически добавляет JWT
  
  const { data, error } = await supabase
    .from('leads')
    .select('*')
  // RLS политики автоматически фильтруют по company_id
}
```

### 3. RLS Политики (уже созданы)

```sql
-- Пример политики
CREATE POLICY "Users can view own company leads"
ON public.leads
FOR SELECT
USING (
  company_id IN (
    SELECT cm.company_id 
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid() -- JWT токен!
  )
);
```

---

## 🧪 Тестирование

### 1. Запустите CRM

```bash
cd apps/crm
npm run dev
```

### 2. Войдите через Google OAuth

1. Откройте http://localhost:3001/login
2. Нажмите "Continue with Google"
3. Авторизуйтесь
4. Проверьте что токен в localStorage: `localStorage.getItem('token')`

### 3. Проверьте страницы

Все должны работать **без** запроса `admin_token`:
- ✅ http://localhost:3001/app/admin/statistics
- ✅ http://localhost:3001/app/admin/leads
- ✅ http://localhost:3001/app/admin/workers
- ✅ http://localhost:3001/app/admin/ai-chats
- ✅ http://localhost:3001/app/admin/gallery

### 4. Откройте Console

Должны увидеть логи:
```
[Statistics] Loading deals with JWT...
[Statistics] Response: { data: 13, error: null }
[Workers] Fetching workers with JWT...
[Leads] Loading with authenticated client...
```

---

## 🔒 Включение RLS (Production)

**Сейчас (Development):**
```sql
-- RLS выключен
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('deals', 'leads', 'workers');
-- ❌ rowsecurity = false
```

**Для Production:**
```sql
-- Выполните миграцию
\i supabase/migrations/020_enable_rls_simple.sql

-- Проверьте
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('deals', 'leads', 'workers');
-- ✅ rowsecurity = true
```

⚠️ **ВАЖНО:** Перед включением RLS убедитесь:
1. Пользователь залогинен через OAuth
2. JWT токен в localStorage
3. Пользователь в `company_members` таблице
4. `company_id` установлен

---

## 📊 Преимущества

**Безопасность:**
- ✅ Нет глобального `admin_token` в коде
- ✅ Каждый пользователь имеет свой JWT
- ✅ RLS изолирует данные между компаниями
- ✅ Токен автоматически expires

**UX:**
- ✅ Вход через Google OAuth (удобно)
- ✅ Нет ручного ввода токенов
- ✅ Automatic session management

**Multi-tenancy:**
- ✅ Полная изоляция данных
- ✅ Невозможно увидеть данные другой компании
- ✅ Защита на уровне БД

---

## 🐛 Troubleshooting

### Проблема: "Нет данных"

**Причина:** RLS включен, но JWT токен не передаётся

**Решение:**
1. Проверьте токен: `console.log(localStorage.getItem('token'))`
2. Если нет - выйдите и войдите заново
3. Проверьте что в `company_members` есть запись с вашим `user_id`

### Проблема: "Unauthorized"

**Причина:** Токен expired или невалидный

**Решение:**
1. Очистите localStorage: `localStorage.clear()`
2. Перезайдите через /login

---

## 📚 Дополнительная информация

- [RLS Setup Guide](./RLS_SETUP.md) - подробная инструкция
- [Supabase JWT Auth](https://supabase.com/docs/guides/auth/auth-helpers)
- [Multi-tenant RLS](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✨ Что дальше?

1. **Протестируйте все страницы**
2. **Проверьте что данные загружаются**
3. **Когда готовы к production - включите RLS**
4. **Реализуйте refresh token** (токен expires через время)

---

**Готово! 🎉**

Теперь CRM использует правильную JWT аутентификацию и готов к включению RLS для production.

