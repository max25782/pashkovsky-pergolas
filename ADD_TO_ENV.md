# Добавьте в .env для работы S3 в Client Components

Для того чтобы изображения загружались из S3 во всех компонентах (включая Client Components), добавьте эти переменные в `.env`:

```env
# AWS S3 - Server-side (для миграции и загрузки)
AWS_S3_BUCKET_NAME=pashkovsky-gallery
AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# AWS S3 - Client-side (для загрузки изображений в браузере)
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
```

## Почему нужны NEXT_PUBLIC_ переменные?

- **Server Components** (pergulas, profiles) используют `process.env.AWS_S3_BUCKET_NAME`
- **Client Components** (fences, rails, windows, models) используют `process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME`

Next.js не передает обычные переменные окружения в браузер по соображениям безопасности. Только переменные с префиксом `NEXT_PUBLIC_` доступны в Client Components.

## После добавления:

1. Перезапустите dev server:
```powershell
npm run dev
```

2. Откройте любую страницу (fences, rails, windows, etc.)

3. Проверьте в DevTools → Network:
```
Request URL: https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/fancy/...
Remote Address: 52.218.xxx.xxx (AWS)
```

## Безопасность:

✅ **Безопасно**: `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` и `NEXT_PUBLIC_AWS_S3_REGION` - это только имя bucket и регион, не секретные данные
❌ **НЕ добавляйте**: `NEXT_PUBLIC_AWS_ACCESS_KEY_ID` или `NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY` - это секретные ключи!

Секретные ключи используются только на сервере для загрузки изображений в S3, они не нужны для чтения публичных изображений.

