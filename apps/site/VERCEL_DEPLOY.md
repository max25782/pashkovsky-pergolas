# Vercel Deployment - Site App

## Настройки проекта в Vercel Dashboard:

### General
- **Framework Preset**: Next.js
- **Root Directory**: `apps/site`
- **Node Version**: 18.x или выше

### Build & Development Settings

**Build Command:**
```bash
cd ../.. && npm install && npm run build:site
```

**Install Command:**
```bash
npm install
```

**Output Directory:**
```
.next
```

**Development Command:**
```bash
npm run dev
```

### Environment Variables

Добавьте эти переменные в Vercel:

```env
# AWS S3
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Optional: CRM API для отправки лидов
NEXT_PUBLIC_CRM_API_URL=https://crm.pashkovsky-group.com
CRM_SITE_TOKEN=your-token
```

## Важные замечания:

1. **Root Directory** должен быть `apps/site` (не корень репо)
2. Build command должен выполняться из корня монорепо (`cd ../..`)
3. Это обеспечит установку всех зависимостей workspace

## Альтернативный метод (без Turbo):

Если возникают проблемы с Turbo, используйте:

**Build Command:**
```bash
cd ../.. && npm install && cd apps/site && npm run build
```

## Troubleshooting:

Если получаете ошибку `routes-manifest.json`:
1. Убедитесь что Root Directory = `apps/site`
2. Убедитесь что Build Command начинается с `cd ../..`
3. Проверьте что все зависимости установлены

