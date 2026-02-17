# 🔧 Диагностика ошибки 500 при загрузке профилей

## Проблема
CRM показывает ошибку "Failed to load profiles: Internal Server Error" при попытке открыть страницу управления профилями.

## Шаги диагностики

### 1. Проверьте, запущен ли NestJS API

Откройте новый терминал и выполните:

```bash
cd apps/profiles-api
npm run start:dev
```

Должно появиться сообщение:
```
🚀 Profiles API running on http://localhost:3003
```

**Если API не запускается:**
- Проверьте, что все зависимости установлены: `npm install`
- Проверьте файл `.env` в `apps/profiles-api/` - все переменные должны быть заполнены

### 2. Проверьте, что таблица `aluminum_profiles` существует

Откройте Supabase Dashboard → SQL Editor и выполните:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'aluminum_profiles';
```

**Если таблицы нет:**
1. Откройте файл: `apps/crm/supabase/migrations/018_create_profiles_system.sql`
2. Скопируйте весь SQL код
3. Вставьте в Supabase SQL Editor
4. Нажмите "Run"

### 3. Проверьте порты

Убедитесь, что порты совпадают:

- **NestJS API** (`apps/profiles-api/.env`): `PORT=3003`
- **CRM** (`apps/crm/.env.local`): `PROFILES_API_URL=http://localhost:3003`

### 4. Проверьте логи NestJS

Когда вы пытаетесь загрузить профили в CRM, в терминале где запущен NestJS API должны появиться логи:

```
[ProfilesService] Supabase error: { ... }
```

Если видите ошибку `42P01` - таблица не существует (см. шаг 2).

Если видите ошибку `PGRST204` - проблема с RLS политиками или таблицей.

### 5. Проверьте Company ID

Убедитесь, что в `apps/profiles-api/.env` указан правильный `PASHKOVSKY_COMPANY_ID`:

```bash
PASHKOVSKY_COMPANY_ID=6998295e-89ae-4e3d-afd2-8c2b0333eac2
```

## Быстрое решение

Если все вышеперечисленное проверено, попробуйте:

1. **Перезапустить NestJS API:**
   ```bash
   cd apps/profiles-api
   # Остановите текущий процесс (Ctrl+C)
   npm run start:dev
   ```

2. **Перезапустить CRM:**
   ```bash
   cd apps/crm
   # Остановите текущий процесс (Ctrl+C)
   npm run dev
   ```

3. **Очистить кеш браузера** и обновить страницу

## Проверка работоспособности

После исправления, откройте в браузере:
- CRM: http://localhost:3001/app/profiles
- Должна загрузиться страница с таблицей профилей (пустая, если профилей еще нет)

## Если проблема не решена

Проверьте логи в консоли браузера (F12 → Console) и в терминале NestJS API. Отправьте эти логи для дальнейшей диагностики.
