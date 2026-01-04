# 🔄 Руководство по миграции базы данных

## Проблема
При инвайте пользователей возникали ошибки:

**Ошибка 1:**
```
Key (user_id)=(xxx) is not present in table "users"
```

**Ошибка 2:**
```
null value in column "password_hash" violates not-null constraint
```

**Ошибка 3:**
```
duplicate key value violates unique constraint "users_email_key"
```

Это происходит потому, что:
1. Пользователи создаются в `auth.users` (Supabase Auth)
2. Но таблица `company_members` ссылается на `public.users`
3. В `public.users` могут быть старые записи с теми же email, но другими ID
4. В `public.users` есть NOT NULL constraint на `password_hash`, но Supabase Auth хранит пароли отдельно
5. Триггер для синхронизации не был настроен

## Решение

### Шаг 1: Применить миграцию

1. Откройте **Supabase Dashboard**: https://app.supabase.com
2. Выберите ваш проект
3. Перейдите в **SQL Editor**
4. Скопируйте содержимое файла:
   ```
   supabase/migrations/025_sync_auth_users.sql
   ```
5. Вставьте в SQL Editor
6. Нажмите **Run** (▶️)

### Что делает миграция:

✅ **Исправляет constraint на `password_hash`** - делает поле nullable, так как Supabase Auth хранит пароли отдельно

✅ **Создаёт триггер `on_auth_user_created`** - автоматически синхронизирует новых пользователей из `auth.users` в `public.users`

✅ **Мёрджит дублирующиеся записи** - если в `public.users` есть запись с тем же email, но другим ID, миграция:
   - Обновляет все ссылки в `company_members` на новый ID из `auth.users`
   - Удаляет старую запись
   - Вставляет новую запись с правильным ID

✅ **Синхронизирует всех существующих пользователей** из `auth.users` в `public.users`

✅ **При создании нового пользователя через Supabase Auth** автоматически создаётся запись в `public.users`

### Шаг 2: Проверка

После применения миграции проверьте:

```sql
-- Проверить, что пользователи синхронизированы
SELECT 
  au.id,
  au.email,
  pu.id IS NOT NULL as synced_to_public
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id;
```

Все пользователи должны иметь `synced_to_public = true`.

### Шаг 3: Тестирование инвайта

1. Перезапустите сервер CRM (если не перезапущен автоматически)
2. Перейдите в раздел **Admin → Users**
3. Попробуйте пригласить нового пользователя
4. Ошибки больше не должно быть!

## Что изменилось в коде

### `apps/crm/app/admin-api/users/invite/route.ts`
- Теперь создаёт пользователя через `supabase.auth.admin.createUser()`
- Триггер автоматически создаёт запись в `public.users`
- Только после этого создаётся membership

### `apps/crm/app/admin-api/users/route.ts`
- Получает список пользователей из `auth.users` через Admin API
- Объединяет данные с `company_members`
- Больше не использует JOIN с `public.users`

## Важно!

⚠️ После применения миграции все новые пользователи будут автоматически синхронизироваться.

⚠️ Если у вас уже есть пользователи в `auth.users`, они будут автоматически добавлены в `public.users` при выполнении миграции.

⚠️ Не удаляйте таблицу `public.users` - она используется для хранения дополнительных данных о пользователях (phone, locale, last_seen_at и т.д.).

## Поддержка

Если после применения миграции остались проблемы:
1. Проверьте логи в терминале CRM
2. Проверьте Network → Console в браузере
3. Проверьте, что триггер создан:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

