# Быстрый старт: AI-директор

## ✅ Что сделано

Код полностью реализован! Все файлы созданы и готовы к работе.

## 🚀 Что сделать сейчас (5 минут)

### 1. Установить зависимость AWS SDK

```bash
cd apps/crm
npm install @aws-sdk/client-bedrock-agent-runtime
cd ../..
```

### 2. Сгенерировать токен

```bash
openssl rand -hex 32
```

### 3. Добавить в `.env.local`

```env
# Добавьте эту строку (если её нет)
AWS_REGION=eu-north-1

# Добавьте сгенерированный токен
AI_DIRECTOR_API_TOKEN=ваш_сгенерированный_токен
```

### 4. Применить миграцию БД

Откройте Supabase SQL Editor и выполните:

```sql
-- Файл: supabase/migrations/028_ai_director_sessions.sql
```

Или скопируйте содержимое файла `supabase/migrations/028_ai_director_sessions.sql` и выполните в SQL Editor.

### 5. Настроить Action Groups в AWS

**Важно:** Без Action Groups агент не сможет получать данные из CRM!

1. Откройте AWS Console → Amazon Bedrock → Agents
2. Выберите ваш агент (ID: `7QWEK0ZAEF`)
3. Перейдите в раздел "Action groups"
4. Создайте 5 Action Groups (см. `AI_DIRECTOR_SETUP.md` для деталей):
   - `get_deals_data`
   - `get_leads_data`
   - `get_workers_data`
   - `get_analytics_data`
   - `get_gallery_data`

**Для каждой группы:**
- API endpoint: `http://localhost:3001` (для локальной разработки)
- В OpenAPI schema добавьте параметр `company_id` (required: true)

### 6. Обновить системные инструкции агента

В AWS Console → Bedrock Agent → Instructions, замените на:

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
```

### 7. Перезапустить CRM

```bash
# Ctrl+C для остановки
# Затем:
cd apps/crm
npm run dev
```

### 8. Протестировать

1. Откройте: `http://localhost:3001/app/admin`
2. Войдите в систему
3. Нажмите "AI-директор" в меню
4. Задайте вопрос: "Сколько у нас открытых сделок?"

## 📁 Созданные файлы

### Backend (API)
- `apps/crm/lib/middleware/ai-director-auth.ts` - аутентификация
- `apps/crm/app/api/ai-director/data/deals/route.ts` - данные по сделкам
- `apps/crm/app/api/ai-director/data/leads/route.ts` - данные по лидам
- `apps/crm/app/api/ai-director/data/workers/route.ts` - данные по работникам
- `apps/crm/app/api/ai-director/data/analytics/route.ts` - аналитика
- `apps/crm/app/api/ai-director/data/gallery/route.ts` - галерея
- `apps/crm/app/api/ai-director/chat/route.ts` - основной чат API
- `apps/crm/lib/ai/bedrock-client.ts` - обновлён для sessionAttributes

### Frontend (UI)
- `apps/crm/app/app/admin/ai-director/page.tsx` - страница чата
- `apps/crm/components/crm/CRMSidebar.tsx` - обновлена навигация

### Database
- `supabase/migrations/028_ai_director_sessions.sql` - миграция

### Документация
- `AI_DIRECTOR_SETUP.md` - полная инструкция
- `AI_DIRECTOR_QUICKSTART_RU.md` - этот файл

## ⚠️ Важно

1. **Настройте права IAM!** Ваш пользователь должен иметь права `bedrock:InvokeAgent`. См. `AWS_BEDROCK_PERMISSIONS.md`
2. **Без Action Groups агент не будет работать!** Обязательно создайте их в AWS.
3. **Токен должен быть уникальным!** Не используйте примеры из документации.
4. **Для продакшена** обновите `NEXT_PUBLIC_APP_URL` на реальный домен.

## 🆘 Проблемы?

См. раздел "Troubleshooting" в `AI_DIRECTOR_SETUP.md`

## 💡 Примеры вопросов

- "Сколько у нас открытых сделок?"
- "Какова конверсия лидов за последний месяц?"
- "Какие сделки требуют внимания?"
- "Сравни производительность работников за последние 2 недели"
- "Дай рекомендации по улучшению воронки продаж"
- "Какие источники лидов наиболее эффективны?"

