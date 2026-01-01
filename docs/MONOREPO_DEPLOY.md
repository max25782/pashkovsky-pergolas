# 🚀 Vercel Deployment Guide - Monorepo

Инструкция по деплою Site и CRM на Vercel.

---

## 📋 Prerequisite

1. ✅ GitHub repository с монорепо структурой
2. ✅ Vercel account
3. ✅ Environment variables готовы

---

## 1️⃣ Deploy SITE

### Шаг 1: Создать новый Vercel Project

1. Зайти в Vercel Dashboard
2. **New Project** → Import Git Repository
3. Выбрать ваш GitHub repo

### Шаг 2: Настроить Site Project

**Framework Preset**: `Next.js`

**Root Directory**: `apps/site`

**Build Settings**:
- **Build Command**: `cd ../.. && npm install && npm run build:site`
- **Output Directory**: `apps/site/.next`
- **Install Command**: `npm install`

### Шаг 3: Environment Variables (Site)

```bash
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
NEXT_PUBLIC_CRM_API_URL=https://crm.pashkovsky-group.com
CRM_SITE_TOKEN=<your-secret-token>
```

### Шаг 4: Deploy

Нажмите **Deploy** ✅

**Domain**: `pashkovsky-group.com`

---

## 2️⃣ Deploy CRM

### Шаг 1: Создать второй Vercel Project

1. Vercel Dashboard → **Add New Project**
2. Import тот же GitHub repo

### Шаг 2: Настроить CRM Project

**Framework Preset**: `Next.js`

**Root Directory**: `apps/crm`

**Build Settings**:
- **Build Command**: `cd ../.. && npm install && npm run build:crm`
- **Output Directory**: `apps/crm/.next`
- **Install Command**: `npm install`

### Шаг 3: Environment Variables (CRM)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>

# JWT
JWT_SECRET=<your-jwt-secret>

# AWS S3
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>

# Public API
CRM_SITE_TOKEN=<same-as-site-token>
DEFAULT_COMPANY_ID=<your-default-company-id>

# Google OAuth (optional)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
NEXT_PUBLIC_APP_URL=https://crm.pashkovsky-group.com
```

### Шаг 4: Deploy

Нажмите **Deploy** ✅

**Domain**: `crm.pashkovsky-group.com`

---

## 3️⃣ Настроить домены

### Site (pashkovsky-group.com)

1. Vercel Dashboard → Site Project → **Settings** → **Domains**
2. Добавить домен: `pashkovsky-group.com`
3. Добавить алиас: `www.pashkovsky-group.com`

**DNS настройки** (в вашем регистраторе):
```
A     @       76.76.21.21
CNAME www     cname.vercel-dns.com
```

### CRM (crm.pashkovsky-group.com)

1. Vercel Dashboard → CRM Project → **Settings** → **Domains**
2. Добавить поддомен: `crm.pashkovsky-group.com`

**DNS настройки**:
```
CNAME crm     cname.vercel-dns.com
```

---

## 4️⃣ Auto-Deploy

Vercel автоматически деплоит при пуше в `main`:

- **Site**: Обновляется только при изменениях в `apps/site/`
- **CRM**: Обновляется только при изменениях в `apps/crm/`

### Ignore Build Step (optional)

Чтобы не деплоить без изменений:

**Settings** → **Git** → **Ignored Build Step**:
```bash
# For Site project
git diff HEAD^ HEAD --quiet ./apps/site

# For CRM project
git diff HEAD^ HEAD --quiet ./apps/crm
```

---

## 5️⃣ Проверка

### Site
```bash
curl https://pashkovsky-group.com
```

### CRM
```bash
curl https://crm.pashkovsky-group.com/api/health
```

---

## 🔒 Безопасность

1. ✅ Все secrets в Vercel Environment Variables
2. ✅ Never commit `.env` files
3. ✅ Different env variables for Site vs CRM
4. ✅ `CRM_SITE_TOKEN` должен совпадать в обоих проектах

---

## 🐛 Troubleshooting

### Build fails

**Ошибка**: `Module not found`

**Решение**: Проверьте что в Build Command указан `cd ../.. && npm install`

### Environment variables not working

**Ошибка**: Variables не применяются

**Решение**: Vercel Dashboard → **Settings** → **Environment Variables** → **Redeploy**

### Wrong domain routing

**Ошибка**: CRM открывает Site или наоборот

**Решение**: Проверьте **Root Directory** в настройках проекта

---

## 📧 Support

Вопросы: [your-email@example.com](mailto:your-email@example.com)

