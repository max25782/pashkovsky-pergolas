# 🎯 Pashkovsky Group - Монорепо структура

Проект разделён на **2 независимых приложения**:

## 📁 Структура

```
pashkovsky-monorepo/
├── apps/
│   ├── site/          # 📄 Публичный сайт (pashkovsky-group.com)
│   └── crm/           # 🔒 SaaS CRM система (crm.pashkovsky-group.com)
├── packages/
│   └── shared-types/  # 📦 Общие TypeScript типы для API контрактов
└── scripts/           # 🛠️ Утилиты для обработки данных
```

---

## 🚀 Quick Start

### 1️⃣ Установка зависимостей

```bash
npm install
```

### 2️⃣ Запуск dev серверов

```bash
# Оба приложения одновременно
npm run dev

# Только Site (port 3000)
npm run dev:site

# Только CRM (port 3001)
npm run dev:crm
```

### 3️⃣ Билд для production

```bash
# Оба приложения
npm run build

# Только Site
npm run build:site

# Только CRM
npm run build:crm
```

---

## 📄 Site (Public pages)

**Порт**: `3000`  
**Путь**: `/apps/site`  
**Домен**: `pashkovsky-group.com`

### Что включает:
- ✅ Главная страница, портфолио, блог
- ✅ Страницы услуг (перголы, заборы, окна)
- ✅ Контактная форма → отправляет лиды в CRM API
- ✅ Минимум зависимостей (только публичный функционал)

### Environment Variables (.env.local):
```bash
# AWS S3 (для изображений)
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1

# CRM API (для отправки лидов)
NEXT_PUBLIC_CRM_API_URL=https://crm.pashkovsky-group.com
CRM_SITE_TOKEN=your-secret-token
```

---

## 🔒 CRM (Admin panel)

**Порт**: `3001`  
**Путь**: `/apps/crm`  
**Домен**: `crm.pashkovsky-group.com`

### Что включает:
- ✅ Multi-tenant SaaS система
- ✅ Лиды, сделки, воркеры, проекты
- ✅ Генерация PDF оффер-листов
- ✅ AI аналитика и чаты
- ✅ Роли, подписки, биллинг

### Environment Variables (.env.local):
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# JWT
JWT_SECRET=your-jwt-secret

# AWS S3
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Public API Token
CRM_SITE_TOKEN=your-secret-token
DEFAULT_COMPANY_ID=your-default-company-id

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 📦 Shared Types

**Путь**: `/packages/shared-types`

Содержит только **интерфейсы для API контрактов** между Site и CRM:

```typescript
import { PublicLeadPayload } from '@pashkovsky/shared-types'

const lead: PublicLeadPayload = {
  name: 'John Doe',
  phone: '+972501234567',
  email: 'john@example.com',
  message: 'Интересуют перголы'
}
```

---

## 🔗 Связь между Site и CRM

**Site** отправляет лиды в CRM через публичный API:

```typescript
// apps/site/lib/submit-lead.ts
await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/api/public/leads`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-site-token': process.env.CRM_SITE_TOKEN
  },
  body: JSON.stringify(lead)
})
```

**CRM** принимает лиды и сохраняет в базу данных (Supabase).

---

## 🛠️ Деплой

### Vercel (рекомендуется)

**Site**:
- Root Directory: `apps/site`
- Build Command: `cd ../.. && npm run build:site`
- Output Directory: `apps/site/.next`
- Install Command: `npm install`

**CRM**:
- Root Directory: `apps/crm`
- Build Command: `cd ../.. && npm run build:crm`
- Output Directory: `apps/crm/.next`
- Install Command: `npm install`

### Environment Variables в Vercel:
- Настройте для каждого проекта отдельно
- CRM требует больше env переменных (Supabase, JWT, AWS)

---

## 🧪 Тестирование

```bash
# Run security tests (CRM only)
cd apps/crm
npm run test:security
```

---

## 📚 Документация

- `/docs/ENV_LOCAL_SETUP.md` - Настройка локального окружения
- `/docs/SECURITY_LAYER_IMPLEMENTATION.md` - Безопасность multi-tenant
- `/docs/PUBLIC_LEAD_API.md` - API для приёма лидов
- `/docs/VERCEL_DEPLOY.md` - Деплой на Vercel

---

## 🤝 Contributing

1. Создайте feature branch
2. Коммитьте изменения
3. Отправьте PR

---

## 📧 Support

Вопросы: [your-email@example.com](mailto:your-email@example.com)

---

Built with ❤️ by Pashkovsky Group

