# 🔧 Исправление ошибки 500 в форме обратной связи

## Проблема

Форма на сайте `pashkovsky-group.com` отправляет запрос в CRM `/api/public/leads`, но получает ошибку 500.

## Причина

В CRM не установлены обязательные переменные окружения:
- `CRM_SITE_TOKEN` - токен безопасности для защиты API
- `DEFAULT_COMPANY_ID` - ID компании, в которую сохраняются лиды с сайта

## Решение

### Шаг 1: Получить DEFAULT_COMPANY_ID

Выполните в Supabase SQL Editor:

```sql
SELECT id, name FROM companies ORDER BY created_at DESC LIMIT 5;
```

Скопируйте `id` вашей компании (например, `6998295e-89ae-4e3d-afd2-8c2b0333eac2`)

### Шаг 2: Добавить переменные в Vercel (Production)

1. Откройте Vercel Dashboard: https://vercel.com/dashboard
2. Выберите проект **pashkovsky-crm** (или как называется CRM проект)
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте две переменные:

```env
CRM_SITE_TOKEN=<ТОКЕН_СГЕНЕРИРОВАННЫЙ_ВЫШЕ>
DEFAULT_COMPANY_ID=<ID_ИЗ_ШАГА_1>
```

**Важно:** Выберите **Production** (и опционально Preview + Development)

5. Нажмите **Save**
6. Выполните **Redeploy** проекта

### Шаг 3: Добавить токен на сайт (Site)

1. Откройте Vercel Dashboard
2. Выберите проект **pashkovsky-site** (сайт, не CRM!)
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте переменную:

```env
NEXT_PUBLIC_CRM_SITE_TOKEN=<ТОТ_ЖЕ_ТОКЕН_ЧТО_И_CRM_SITE_TOKEN>
```

**КРИТИЧНО:** Токен должен быть ОДИНАКОВЫМ в обоих проектах!

5. Нажмите **Save**
6. Выполните **Redeploy** проекта

### Шаг 4: Локальная разработка (.env.local)

Если разрабатываете локально, добавьте в `apps/crm/.env.local`:

```env
CRM_SITE_TOKEN=<сгенерированный_токен>
DEFAULT_COMPANY_ID=<uuid_компании>
```

И в `apps/site/.env.local`:

```env
NEXT_PUBLIC_CRM_API_URL=http://localhost:3001
NEXT_PUBLIC_CRM_SITE_TOKEN=<тот_же_токен>
```

### Шаг 5: Проверка

После редеплоя:

1. Откройте сайт: https://pashkovsky-group.com
2. Заполните форму контактов
3. Нажмите "Отправить"
4. Должно появиться сообщение: "תודה! ניצור איתך קשר בקרוב" (Спасибо! Мы свяжемся с вами)

### Проверка логов (если всё ещё ошибка)

В Vercel:
1. Перейдите в проект **pashkovsky-crm**
2. Откройте **Deployments** → последний деплой → **Logs**
3. Найдите ошибку с меткой `[Public Leads]`

Возможные ошибки:
- `CRM_SITE_TOKEN not configured` → переменная не установлена
- `Invalid site token` → токены в Site и CRM не совпадают
- `DEFAULT_COMPANY_ID not configured` → не установлен ID компании
- `Database error` → проблема с Supabase (проверьте rights)

## Безопасность

- **Токен должен быть случайным** (минимум 32 символа)
- **Токен должен быть одинаковым** в Site (`NEXT_PUBLIC_CRM_SITE_TOKEN`) и CRM (`CRM_SITE_TOKEN`)
- **Не публикуйте токен** в открытом коде (только в Environment Variables)

## Дополнительно: Rate Limiting

API защищён rate limiting:
- **5 запросов за 15 минут** с одного IP
- При превышении вернётся ошибка `429 Too Many Requests`

Если нужно увеличить лимит, измените в `apps/crm/app/api/public/leads/route.ts`:

```typescript
const RATE_LIMIT_CONFIG = {
  maxRequests: 10, // было 5
  windowMs: 15 * 60 * 1000,
}
```

## Тестирование API вручную

Проверить API можно через curl:

```bash
curl -X POST https://crm.pashkovsky-group.com/api/public/leads \
  -H "Content-Type: application/json" \
  -H "x-site-token: YOUR_TOKEN_HERE" \
  -d '{
    "name": "Test User",
    "phone": "+972501234567",
    "message": "Test message"
  }'
```

Ожидаемый ответ:
```json
{
  "success": true,
  "id": "uuid-here"
}
```

