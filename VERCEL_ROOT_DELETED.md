# ⚠️ ВАЖНО: Файл vercel.json удалён из корня

Этот файл мешал правильной работе монорепо в Vercel.

## Правильная настройка:

В Vercel Dashboard для каждого проекта:

### Site Project:
- Root Directory: `apps/site`
- Build Command: `npm run build`
- Output Directory: `.next`

### CRM Project:
- Root Directory: `apps/crm`
- Build Command: `npm run build`
- Output Directory: `.next`

## Если всё ещё не работает:

Проверьте что в Vercel Dashboard:
1. Settings → General → Root Directory = `apps/site` (для site проекта)
2. Settings → Build & Development Settings → Build Command = `npm run build`
3. Нажмите "Save"
4. Redeploy

## Если проблема сохраняется:

Попробуйте явно указать в Build Command:

```bash
npm install && npm run build
```

Или даже:

```bash
cd /vercel/path0/apps/site && npm install && npm run build
```

