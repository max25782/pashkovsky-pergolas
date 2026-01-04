# 🚀 Vercel Deployment - SITE App (Public Website)

## ⚠️ ВАЖНО: Это настройки для SITE приложения!

Для деплоя публичного сайта `pashkovsky-group.com`

---

## Настройки в Vercel Dashboard

### 1. General Settings

- **Project Name**: `pashkovsky-site` (или любое другое)
- **Framework Preset**: Next.js
- **Root Directory**: `apps/site` ⚠️ **КРИТИЧНО!**
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

Добавьте в Vercel:

```env
# AWS S3 (для изображений галереи)
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here

# Опционально: CRM API для отправки лидов
NEXT_PUBLIC_CRM_API_URL=https://crm.pashkovsky-group.com
CRM_SITE_TOKEN=your-secret-token
```

> ⚠️ **ВАЖНО**: Замените `your_aws_access_key_here` и `your_aws_secret_key_here` на реальные ключи из AWS IAM Console

---

## ✅ Проверьте что деплоится именно SITE:

После деплоя должны быть доступны:
- ✅ `/he` - главная страница
- ✅ `/he/pergulas` - галерея пергол
- ✅ `/he/contact` - контакты
- ✅ `/api/gallery/models` - API моделей

❌ НЕ должно быть:
- `/app/admin` (это CRM)
- `/api/auth/login` (это CRM)

---

## Если деплоится CRM вместо SITE:

1. **Проверьте Root Directory**: должно быть `apps/site`
2. **Удалите** корневой `vercel.json` если есть
3. **Redeploy** проект

---

## Отдельный проект для CRM

Создайте **отдельный проект** в Vercel для CRM:
- Project Name: `pashkovsky-crm`
- Root Directory: `apps/crm`
- Domain: `crm.pashkovsky-group.com`

**НЕ используйте один проект для обоих приложений!**
