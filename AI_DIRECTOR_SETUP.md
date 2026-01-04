# Настройка AI-директора по бизнес-решениям

Этот документ описывает процесс настройки и использования AI-директора в CRM системе Pashkovsky Group.

## Что уже сделано ✅

### 1. Код реализован
- ✅ Middleware для аутентификации AI Director API (`lib/middleware/ai-director-auth.ts`)
- ✅ 5 Data API endpoints для доступа к данным CRM:
  - `/api/ai-director/data/deals` - сделки
  - `/api/ai-director/data/leads` - лиды
  - `/api/ai-director/data/workers` - работники и смены
  - `/api/ai-director/data/analytics` - аналитика
  - `/api/ai-director/data/gallery` - галерея и проекты
- ✅ Основной Chat API (`/api/ai-director/chat`)
- ✅ Обновлённый Bedrock client с поддержкой `sessionAttributes`
- ✅ UI страница для чата с AI-директором (`/app/admin/ai-director`)
- ✅ Добавлена ссылка в навигацию CRM
- ✅ Миграция БД (`028_ai_director_sessions.sql`)

### 2. Bedrock Agent создан
- ✅ Agent ID: `7QWEK0ZAEF`
- ✅ Region: `eu-north-1`
- ✅ Status: PREPARED

## Что нужно сделать

### Шаг 1: Обновить `.env.local`

Добавьте следующие переменные:

```env
# AWS Bedrock (проверьте, что все есть)
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=ваш_существующий_ключ
AWS_SECRET_ACCESS_KEY=ваш_существующий_секрет
BEDROCK_AGENT_ID=7QWEK0ZAEF
BEDROCK_AGENT_ALIAS_ID=TSTALIASID

# AI Director API Token (СГЕНЕРИРУЙТЕ НОВЫЙ!)
AI_DIRECTOR_API_TOKEN=сгенерировать_через_команду_ниже

# App URL (для локальной разработки)
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**Сгенерировать AI_DIRECTOR_API_TOKEN:**
```bash
openssl rand -hex 32
```

Скопируйте результат и вставьте в `.env.local`.

### Шаг 2: Настроить Action Groups в AWS Bedrock

Откройте AWS Console → Amazon Bedrock → Agents → Ваш агент (`7QWEK0ZAEF`)

#### Action Group 1: Deals Data

**Настройки:**
- Action group name: `get_deals_data`
- Description: "Get deals/projects data with filters"
- Action group type: Define with API schemas
- API schema: Inline OpenAPI schema

**OpenAPI Schema:**
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Deals Data API",
    "version": "1.0.0"
  },
  "paths": {
    "/api/ai-director/data/deals": {
      "get": {
        "summary": "Get deals data",
        "operationId": "getDeals",
        "parameters": [
          {
            "name": "company_id",
            "in": "query",
            "required": true,
            "schema": {"type": "string"}
          },
          {
            "name": "status",
            "in": "query",
            "schema": {"type": "string"}
          },
          {
            "name": "start_date",
            "in": "query",
            "schema": {"type": "string"}
          },
          {
            "name": "end_date",
            "in": "query",
            "schema": {"type": "string"}
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {"type": "integer"}
          }
        ],
        "responses": {
          "200": {"description": "Deals data"}
        }
      }
    }
  }
}
```

**Lambda function or API endpoint:** `http://localhost:3001` (для локальной разработки)

#### Action Group 2-5: Аналогично создайте для:

- `get_leads_data` → `/api/ai-director/data/leads`
- `get_workers_data` → `/api/ai-director/data/workers`
- `get_analytics_data` → `/api/ai-director/data/analytics`
- `get_gallery_data` → `/api/ai-director/data/gallery`

**Важно:** В каждом OpenAPI schema обязательно добавьте параметр `company_id` (required: true).

### Шаг 3: Обновить системные инструкции агента

В AWS Console → Bedrock Agent → Instructions, вставьте:

```
You are an AI Executive Business Advisor inside a CRM system.

Your role is similar to a C-level executive or business partner.

You do NOT act as customer support.
You do NOT role-play conversations with clients.

Your primary responsibilities:
- Analyze CRM data and business context
- Give strategic and operational advice
- Identify risks, bottlenecks, and missed opportunities
- Recommend concrete next actions
- Help business owners and managers make better decisions

You think like a CEO-level advisor:
- You focus on revenue, retention, conversion, and efficiency
- You care about trends, not single events
- You ask clarifying business questions when data is insufficient

Rules:
- You do not invent data
- You explain reasoning briefly
- You use actions only when real CRM data is needed
- You clearly separate facts from recommendations

You speak professionally, clearly, and pragmatically.

When user asks questions in Russian, respond in Russian.
When user asks questions in English, respond in English.
When user asks questions in Hebrew, respond in Hebrew.

IMPORTANT: When calling action groups, ALWAYS pass the company_id from sessionAttributes.
Example: If sessionAttributes contains company_id, use it in all API calls.
```

### Шаг 4: Применить миграцию БД

В Supabase SQL Editor выполните:

```sql
-- Содержимое файла supabase/migrations/028_ai_director_sessions.sql
```

Или через командную строку:
```bash
# Если у вас настроен Supabase CLI
supabase db push
```

### Шаг 5: Перезапустить приложение

```bash
# Остановить текущий процесс (Ctrl+C)
# Затем запустить заново
cd apps/crm
npm run dev
```

### Шаг 6: Протестировать

1. Откройте CRM: `http://localhost:3001/app/admin`
2. Войдите в систему
3. Нажмите на "AI-директор" в боковом меню
4. Задайте тестовый вопрос:
   - "Сколько у нас открытых сделок?"
   - "Какова конверсия лидов за последний месяц?"
   - "Дай рекомендации по улучшению воронки продаж"

## Архитектура

```
User (CRM) 
  ↓
Chat UI (/app/admin/ai-director)
  ↓
POST /api/ai-director/chat
  ↓
Bedrock Agent (AWS)
  ↓
Action Groups → Data API endpoints
  ↓
Supabase (PostgreSQL)
```

## Безопасность

- Все Data API защищены токеном `AI_DIRECTOR_API_TOKEN`
- Все запросы фильтруются по `company_id` (multi-tenancy)
- Bedrock Agent не имеет прямого доступа к БД
- Токен передаётся через `sessionAttributes`

## Troubleshooting

### Ошибка: "Missing AWS or Bedrock environment variables"
- Проверьте, что все переменные `AWS_*` и `BEDROCK_*` добавлены в `.env.local`
- Перезапустите приложение

### Ошибка: "Unauthorized: Invalid AI Director token"
- Убедитесь, что `AI_DIRECTOR_API_TOKEN` сгенерирован и добавлен в `.env.local`
- Проверьте, что Bedrock Agent передаёт токен через `sessionAttributes`

### Ошибка: "company_id is required"
- Убедитесь, что в Action Groups добавлен параметр `company_id` (required: true)
- Проверьте, что агент передаёт `company_id` из `sessionAttributes`

### Bedrock Agent не вызывает Action Groups
- Проверьте, что Action Groups созданы и активны
- Убедитесь, что агент "Prepared" (не в статусе Draft)
- Проверьте URL endpoint в Action Group (должен быть доступен для AWS)

## Для продакшена (Vercel)

1. Обновите `NEXT_PUBLIC_APP_URL` на реальный домен:
   ```env
   NEXT_PUBLIC_APP_URL=https://your-crm-domain.vercel.app
   ```

2. Добавьте все переменные окружения в Vercel Dashboard:
   - Settings → Environment Variables
   - Добавьте все переменные из `.env.local`

3. Обновите URL в Action Groups на продакшн домен

4. Создайте Production Alias для Bedrock Agent:
   - AWS Console → Bedrock → Agents → Aliases
   - Create new alias: `production`
   - Обновите `BEDROCK_AGENT_ALIAS_ID` в Vercel

## Стоимость AWS Bedrock

- **Claude 3.5 Sonnet**: ~$3 за 1M input tokens, ~$15 за 1M output tokens
- **Claude 3 Haiku**: ~$0.25 за 1M input tokens, ~$1.25 за 1M output tokens

Рекомендуется начать с Haiku для экономии.

## Дальнейшие улучшения

- [ ] Добавить метрики использования (количество запросов, популярные вопросы)
- [ ] Реализовать кэширование частых запросов
- [ ] Добавить rate limiting для предотвращения злоупотреблений
- [ ] Создать дашборд для мониторинга AI-директора
- [ ] Добавить возможность экспорта диалогов
- [ ] Интегрировать с уведомлениями (email/SMS)

## Поддержка

Если возникли проблемы:
1. Проверьте логи в браузере (Console)
2. Проверьте логи сервера (терминал)
3. Проверьте CloudWatch Logs в AWS (для Bedrock Agent)


