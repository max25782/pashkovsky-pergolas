# 🔒 Pashkovsky CRM - SaaS System

Multi-tenant CRM система для управления лидами, сделками и проектами.

## 🚀 Запуск

```bash
# Из root директории монорепо
npm run dev:crm

# Или из apps/crm
npm run dev
```

Откроется на `http://localhost:3001`

## 📦 Что включает

- **Лиды**: Управление входящими заявками
- **Сделки**: Канбан доска с воронкой продаж
- **Воркеры**: Управление рабочими и сменами
- **Проекты**: Трекинг установки пергол
- **Оффер-листы**: Генерация PDF предложений
- **AI Аналитика**: Умная аналитика по сделкам
- **Multi-tenancy**: Разные компании в одной системе

## 🔒 Безопасность

- JWT authentication
- Row-Level Security (RLS)
- Company-based data isolation
- Role-based permissions
- Runtime assertions

## 🛠️ Технологии

- Next.js 14
- React 18
- Supabase (PostgreSQL)
- Puppeteer (PDF generation)
- AWS S3 (хранилище)
- Recharts (графики)

## 📝 Environment Variables

См. `/docs/ENV_LOCAL_SETUP.md`

## 🗄️ Миграции

```bash
# В Supabase dashboard:
# SQL Editor → New Query → Копируем содержимое из /supabase/migrations
```

## 🧪 Тестирование

```bash
npm run test:security
```

## 📚 Документация

- `/docs/SECURITY_LAYER_IMPLEMENTATION.md`
- `/docs/PUBLIC_LEAD_API.md`
- `/docs/SAAS_PLAN.md`

