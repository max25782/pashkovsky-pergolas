# 🚀 Vercel Deployment - CRM App

## ⚠️ ВАЖНО: Это настройки для CRM приложения!

Для деплоя CRM системы `crm.pashkovsky-group.com`

---

## Настройки в Vercel Dashboard

### 1. General Settings

- **Project Name**: `pashkovsky-crm` (или любое другое)
- **Framework Preset**: Next.js
- **Root Directory**: `apps/crm` ⚠️ **КРИТИЧНО!**
- **Node Version**: 18.x

### 2. Build & Development Settings

**Build Command:**
```bash
npm run build
```

**Output Directory:**
```
.next
```

**Install Command:**
```bash
npm install
```

**Development Command:**
```bash
npm run dev
```

### 3. Environment Variables

Добавьте в Vercel все переменные из `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-jwt-secret

# AWS S3
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Public API Token
CRM_SITE_TOKEN=your-secret-token
DEFAULT_COMPANY_ID=your-company-uuid

# Google OAuth (опционально)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## ✅ Проверьте что деплоится именно CRM:

После деплоя должны быть доступны:
- ✅ `/login` - страница входа
- ✅ `/app/admin` - админ панель
- ✅ `/api/auth/login` - API аутентификации
- ✅ `/api/public/leads` - API для приёма лидов

❌ НЕ должно быть:
- `/he/pergulas` (это site)
- Публичных страниц галереи

---

## Важные замечания:

1. **Создайте отдельный проект** для CRM в Vercel
2. **Root Directory** должен быть `apps/crm`
3. **Не используйте** один проект для site и crm
4. **Настройте домен**: `crm.pashkovsky-group.com`

---

## Если деплоится SITE вместо CRM:

1. **Проверьте Root Directory**: должно быть `apps/crm`
2. **Убедитесь** что выбран правильный проект
3. **Redeploy** проект



