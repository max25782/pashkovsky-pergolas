# 🔒 Row Level Security (RLS) Setup Guide

## Текущий статус

✅ **Development (сейчас):**
- RLS **DISABLED** на всех таблицах
- Используется JWT-авторизация через localStorage
- Клиент автоматически добавляет JWT токен в заголовки

❌ **Для Production необходимо:**
- RLS **ENABLED** для защиты multi-tenant данных
- Политики уже созданы и готовы к использованию

---

## Что было сделано

### 1. Создан Authenticated Supabase Client
**Файл:** `apps/crm/lib/supabase/client.ts`

```typescript
import { createAuthenticatedClient } from '@/lib/supabase/client'

// Автоматически включает JWT из localStorage
const supabase = createAuthenticatedClient()
```

### 2. Обновлены все компоненты

**Обновленные файлы:**
- ✅ `apps/crm/components/admin/hooks/useLeads.ts`
- ✅ `apps/crm/components/admin/hooks/useLeadActions.ts`
- ✅ `apps/crm/components/admin/LeadsTable.tsx`
- ✅ `apps/crm/app/app/admin/statistics/page.tsx`
- ✅ `apps/crm/app/app/admin/workers/page.tsx`

**Изменения:**
- ❌ Удалён global `const supabase`
- ❌ Удалён параметр `adminToken`
- ✅ Используется `createAuthenticatedClient()` в каждой функции
- ✅ JWT токен автоматически добавляется в запросы

### 3. RLS Политики

**Файл:** `supabase/migrations/020_enable_rls_simple.sql`

Политики уже созданы для:
- `deals` (4 политики)
- `leads` (6 политик, включая публичные)
- `offers` (7 политик)
- `workers` (5 политик)

---

## 🚀 Как включить RLS для Production

### Шаг 1: Протестировать с отключенным RLS

```bash
# 1. Запустите CRM
cd apps/crm && npm run dev

# 2. Войдите через Google OAuth
# 3. Проверьте что все страницы работают:
#    - /app/admin/leads
#    - /app/admin/workers
#    - /app/admin/statistics
#    - /app/admin/deals
```

### Шаг 2: Включить RLS в Supabase

**В Supabase SQL Editor:**

```sql
-- Включить RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Проверить
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('deals', 'leads', 'workers', 'offers')
ORDER BY tablename;
```

### Шаг 3: Протестировать с включенным RLS

1. ✅ Выполните SQL выше
2. ✅ Перезагрузите страницы CRM (Ctrl+Shift+R)
3. ✅ Проверьте что данные загружаются
4. ✅ Проверьте что вы видите только данные вашей компании

---

## 🔍 Как работает RLS

### Пример политики для deals:

```sql
CREATE POLICY "Users can view own company deals"
ON public.deals
FOR SELECT
USING (
  company_id IN (
    SELECT cm.company_id 
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid() -- JWT токен
  )
);
```

**Логика:**
1. Пользователь логинится через Google OAuth
2. JWT токен сохраняется в `localStorage.token`
3. `createAuthenticatedClient()` добавляет токен в заголовки
4. Supabase извлекает `auth.uid()` из JWT
5. RLS политика проверяет `company_members`
6. Возвращаются только записи с правильным `company_id`

---

## ⚠️ Важно

### Что НЕЛЬЗЯ делать:

❌ **НЕ используйте SERVICE_ROLE_KEY в client components:**
```typescript
// ❌ ПЛОХО - обходит RLS
const supabase = createClient(url, SERVICE_ROLE_KEY)
```

❌ **НЕ используйте ANON_KEY без JWT:**
```typescript
// ❌ ПЛОХО - нет пользователя, auth.uid() = NULL
const supabase = createClient(url, ANON_KEY)
```

### Что НУЖНО делать:

✅ **Используйте authenticated client:**
```typescript
// ✅ ХОРОШО - включает JWT токен
const supabase = createAuthenticatedClient()
```

---

## 🐛 Troubleshooting

### Проблема: Возвращается 0 записей

**Причина:** RLS блокирует доступ

**Решение:**
1. Проверьте что JWT токен в localStorage:
   ```javascript
   console.log(localStorage.getItem('token'))
   ```

2. Проверьте что пользователь в `company_members`:
   ```sql
   SELECT * FROM company_members 
   WHERE user_id = '<USER_ID_FROM_JWT>';
   ```

3. Проверьте политики:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'deals';
   ```

### Проблема: Ошибка "JWT expired"

**Решение:**
1. Обновите токен через refresh token
2. Или выйдите и войдите заново

---

## 📊 Production Checklist

Перед деплоем на production:

- [ ] Все компоненты используют `createAuthenticatedClient()`
- [ ] RLS включен на всех таблицах
- [ ] Политики протестированы
- [ ] Refresh token реализован
- [ ] Logout очищает localStorage
- [ ] Нет использования SERVICE_ROLE_KEY на клиенте
- [ ] Нет использования ANON_KEY без JWT

---

## 🔐 Security Benefits

**С включенным RLS:**
- ✅ Полная изоляция данных между компаниями
- ✅ Невозможно получить данные чужой компании
- ✅ Защита на уровне базы данных
- ✅ Compliance с GDPR/SOC2

**Без RLS (development only):**
- ❌ Любой может видеть все данные
- ❌ Нет multi-tenancy защиты
- ❌ **ОПАСНО для production!**

---

## 📚 Дополнительная информация

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JWT Auth](https://supabase.com/docs/guides/auth/auth-helpers)
- [Multi-tenant Architecture](https://supabase.com/docs/guides/auth/managing-user-data#multi-tenancy)

