# Weekly Digest Setup Guide

## Описание

AI Weekly Digest — автоматический еженедельный отчёт, который генерируется каждую неделю и содержит анализ данных CRM за последние 7 дней.

## База данных

### Миграция

Выполните миграцию для создания таблицы `weekly_digests`:

```sql
-- Файл: supabase/migrations/create_weekly_digests.sql
```

Или выполните SQL напрямую в Supabase SQL Editor.

### Структура таблицы

- `id` - UUID, первичный ключ
- `company_id` - TEXT, опционально (для мультитенантности)
- `period_from` - DATE, начало периода
- `period_to` - DATE, конец периода
- `created_at` - TIMESTAMPTZ, время создания
- `summary_json` - JSONB, AnalyticsContext с данными
- `ai_text` - TEXT, сгенерированный AI текст
- `status` - TEXT, 'generated' или 'failed'
- `error_message` - TEXT, опционально

## Настройка Cron

### Вариант 1: Vercel Cron (рекомендуется)

Добавьте в `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-digest?token=YOUR_SECRET_TOKEN",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

Расписание: каждый понедельник в 09:00 UTC (11:00 Asia/Jerusalem).

### Вариант 2: Внешний scheduler

Настройте внешний сервис (например, cron-job.org) для вызова:

```
POST https://your-domain.com/api/cron/weekly-digest?token=YOUR_SECRET_TOKEN
```

Расписание: каждый понедельник в 09:00 Asia/Jerusalem.

### Переменные окружения

Добавьте в `.env.local`:

```env
CRON_SECRET_TOKEN=your-secret-token-here
# или
WEEKLY_DIGEST_CRON_TOKEN=your-secret-token-here
```

## API Endpoints

### 1. Cron endpoint (автоматическая генерация)

```
POST /api/cron/weekly-digest?token=YOUR_SECRET_TOKEN
```

- Защищён секретным токеном
- Rate limit: 1 раз в час
- Генерирует дайджест для всех компаний

### 2. Ручная генерация (только admin)

```
POST /api/reports/weekly-digest/generate
Headers: x-admin-token: YOUR_ADMIN_TOKEN
Body: { "companyId": "optional-company-id" }
```

### 3. Получение дайджестов

```
GET /api/reports/weekly-digest
Headers: x-admin-token: YOUR_ADMIN_TOKEN
Query params:
  - id: получить конкретный дайджест
  - companyId: фильтр по компании
  - limit: количество (по умолчанию 20)
```

## UI

### Страница дайджестов

Доступна по адресу: `/[locale]/admin/reports/weekly`

Функции:
- Просмотр списка дайджестов
- Просмотр конкретного дайджеста
- Кнопка "Сгенерировать сейчас" (только для admin)
- Отображение ключевых метрик
- Отображение AI текста

## Что включается в дайджест

### Данные (из AnalyticsContext):

1. **Leads:**
   - Total leads
   - Qualified leads
   - Duplicates count
   - Top 3 sources
   - Average response time (если есть)
   - Conversion lead→deal

2. **Deals:**
   - Open deals
   - Won deals
   - Win rate
   - Average days to close
   - Top stalled stage

3. **Finance:**
   - Revenue
   - Labor cost (если есть)
   - Profit
   - Profit margin

4. **Top Issues:**
   - Из topIssues в контексте
   - Дополнительная AI интерпретация

5. **Рекомендации:**
   - 3-5 конкретных действий на следующую неделю
   - Генерируются AI на основе данных

## Безопасность

- ✅ Cron endpoint защищён секретным токеном
- ✅ Rate limiting (1 раз в час)
- ✅ Admin endpoints требуют admin token
- ✅ Не логируются персональные данные
- ✅ Ошибки логируются с ограничением размера

## Тестирование

### Ручная генерация

1. Войдите в админ панель
2. Перейдите на `/admin/reports/weekly`
3. Нажмите "Сгенерировать сейчас"
4. Проверьте результат

### Проверка cron endpoint

```bash
curl -X POST "http://localhost:3000/api/cron/weekly-digest?token=YOUR_SECRET_TOKEN"
```

## Troubleshooting

### Дайджест не генерируется

1. Проверьте логи сервера
2. Убедитесь, что токен правильный
3. Проверьте, что Supabase подключен
4. Проверьте, что есть данные за период

### Ошибка "Failed to generate digest"

- Проверьте логи в `weekly_digests` таблице (поле `error_message`)
- Убедитесь, что `buildAnalyticsContext` работает
- Проверьте, что LLM API доступен

### Cron не запускается

- Проверьте настройки Vercel Cron
- Убедитесь, что токен правильный
- Проверьте логи Vercel

