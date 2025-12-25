# ✅ Монорепо: Разделение завершено!

## 🎯 Что сделано

### 1️⃣ Структура монорепо

```
pashkovsky-monorepo/
├── apps/
│   ├── site/          ✅ Публичный сайт (port 3000)
│   └── crm/           ✅ SaaS CRM (port 3001)
├── packages/
│   └── shared-types/  ✅ Общие типы для API контрактов
├── package.json       ✅ Root с workspaces
└── turbo.json         ✅ Turborepo конфиг
```

### 2️⃣ Site (apps/site)
- ✅ Public pages (`[locale]/`)
- ✅ Public компоненты (navbar, footer, home)
- ✅ Минимальные зависимости
- ✅ Независимый build
- ✅ Port 3000
- ✅ Domain: `pashkovsky-group.com`

### 3️⃣ CRM (apps/crm)
- ✅ CRM pages (`/app/admin/*`)
- ✅ Auth pages (`/login`, `/register`)
- ✅ Все API routes (`/api/*`, `/admin-api/*`)
- ✅ Admin компоненты
- ✅ Полный security layer
- ✅ Supabase migrations
- ✅ Port 3001
- ✅ Domain: `crm.pashkovsky-group.com`

### 4️⃣ Shared Packages
- ✅ `@pashkovsky/shared-types`
  - `PublicLeadPayload` - интерфейс для API между Site и CRM
  - Минимум зависимостей (только типы)

### 5️⃣ Конфигурация
- ✅ Turborepo (`turbo.json`)
- ✅ Workspaces в root `package.json`
- ✅ Отдельные `package.json` для Site и CRM
- ✅ `.gitignore` для каждого приложения
- ✅ TypeScript, Tailwind, PostCSS configs

### 6️⃣ Документация
- ✅ `README.md` - главный readme монорепо
- ✅ `apps/site/README.md` - site docs
- ✅ `apps/crm/README.md` - CRM docs
- ✅ `docs/MONOREPO_DEPLOY.md` - Vercel deployment guide

---

## 🚀 Как запускать

### Установка
```bash
npm install
```

### Development
```bash
# Оба приложения
npm run dev

# Только Site
npm run dev:site

# Только CRM
npm run dev:crm
```

### Build
```bash
# Оба приложения
npm run build

# Отдельно
npm run build:site
npm run build:crm
```

---

## 🔗 API Связь

**Site → CRM**:
```typescript
// Site отправляет лиды
POST https://crm.pashkovsky-group.com/api/public/leads
Headers: { 'x-site-token': '<secret>' }
```

**CRM** принимает лиды через `/api/public/leads` и сохраняет в Supabase.

---

## 📦 Зависимости

### Site (минимум)
- Next.js
- React
- TailwindCSS
- AWS SDK (S3)
- Framer Motion

### CRM (полный стек)
- Next.js
- React
- Supabase
- Puppeteer (PDF)
- AWS SDK (S3)
- JWT auth
- Recharts
- ...и другие

---

## 🛠️ Vercel Deploy

### Site Project
- **Root Directory**: `apps/site`
- **Build Command**: `cd ../.. && npm run build:site`
- **Domain**: `pashkovsky-group.com`

### CRM Project
- **Root Directory**: `apps/crm`
- **Build Command**: `cd ../.. && npm run build:crm`
- **Domain**: `crm.pashkovsky-group.com`

**Подробнее**: `/docs/MONOREPO_DEPLOY.md`

---

## ✅ Преимущества архитектуры

1. **Полная изоляция**
   - Site и CRM - независимые приложения
   - Разные зависимости, разные билды
   - CRM может работать с любым сайтом (SaaS!)

2. **Безопасность**
   - CRM изолирован на поддомене
   - Публичный сайт не имеет доступа к CRM коду
   - API с аутентификацией и rate limiting

3. **Масштабирование**
   - Деплой Site и CRM независимо
   - Обновления не влияют друг на друга
   - Разные серверы, разные ресурсы

4. **Развитие**
   - CRM = готовый SaaS продукт
   - Можно продавать другим компаниям
   - Одна CRM → много сайтов/клиентов

---

## 📝 Следующие шаги

1. ✅ Протестировать локально (`npm run dev`)
2. ✅ Настроить Vercel проекты
3. ✅ Добавить environment variables
4. ✅ Deploy обоих приложений
5. ✅ Проверить домены и API

---

## 🎉 Готово!

Ваш проект теперь **production-ready монорепо** с четким разделением Site и CRM!

🚀 **Удачи с деплоем!**

