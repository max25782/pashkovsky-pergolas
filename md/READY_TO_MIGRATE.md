# ✅ Код обновлен для S3

Все компоненты теперь используют хелпер `getImageUrl()` для загрузки изображений.

## Что было обновлено:

### 1. Компоненты ✅
- ✅ `components/home/services-section.tsx` - сервисы на главной
- ✅ `components/home/partners-logos.tsx` - логотипы партнеров
- ✅ `components/dgamim/dgamim-carousel.tsx` - карусель моделей
- ✅ `components/pergulas/ProjectsGallery.tsx` - галерея пергол
- ✅ `app/[locale]/pergulas/[id]/page.tsx` - страницы проектов
- ✅ `app/[locale]/profiles/page.tsx` - страница профилей

### 2. Хелперы ✅
- ✅ `lib/image-url.ts` - основной хелпер для URL
- ✅ `lib/image-url-array.ts` - хелпер для массивов изображений

### 3. Next.js конфиг ✅
- ✅ `next.config.js` - обновлен для поддержки S3

## Как это работает:

### Автоматическое переключение:

```typescript
// Если AWS_S3_BUCKET_NAME настроен:
getImageUrl('/images/pergulot/ashdod/1.webp')
// → 'https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/pergulot/ashdod/1.webp'

// Если НЕ настроен:
getImageUrl('/images/pergulot/ashdod/1.webp')
// → '/images/pergulot/ashdod/1.webp' (локально из public/)
```

## Следующий шаг: Миграция

### 1. Запустите миграцию:

```powershell
npm run migrate:public-to-s3
```

Это загрузит **все ~800+ файлов** из `public/images/` в S3:
- Изображения пергол (~400 файлов)
- Модели (~60 файлов)
- Профили (~45 файлов)
- Логотипы (~6 файлов)
- Видео и постеры (~100+ файлов)
- И другие категории

### 2. После успешной миграции изображения автоматически будут загружаться из S3!

Проверьте в DevTools → Network:

**До миграции:**
```
Request URL: http://localhost:3000/_next/image?url=%2Fimages%2Fdgamim%2Fsanta%20fe%2F1.jpg
Remote Address: [::1]:3000
```

**После миграции:**
```
Request URL: https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/1.jpg
Remote Address: 52.218.xxx.xxx (AWS)
Cache-Control: max-age=31536000
```

## Проверка работы:

### 1. Dev server:

```powershell
npm run dev
```

Откройте http://localhost:3000/he и проверьте:
- ✅ Главная страница (сервисы, партнеры)
- ✅ Галерея пергол (/he/pergulas)
- ✅ Галерея моделей (/he/models)
- ✅ Профили (/he/profiles)

### 2. Production build:

```powershell
npm run build
npm start
```

Проверьте, что все изображения загружаются корректно.

## Откат (если нужно):

Если что-то пошло не так, просто удалите переменные S3 из `.env`:

```env
# Закомментируйте или удалите:
# AWS_S3_BUCKET_NAME=pashkovsky-gallery
# AWS_S3_REGION=eu-north-1
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=...
```

Перезапустите dev server - изображения будут загружаться локально.

## FAQ:

### Нужно ли обновлять код при изменении S3 bucket?

Нет! Просто обновите `.env`:
```env
AWS_S3_BUCKET_NAME=new-bucket-name
```

### Можно ли использовать S3 только в production?

Да! В `.env.local` (для dev) не добавляйте AWS переменные, а в production добавьте их в Vercel Environment Variables.

### Что делать с локальными изображениями после миграции?

См. `MIGRATE_PUBLIC_TO_S3.md` → раздел "Шаг 6: Удаление локальных изображений"

## Готово! 🎉

Код полностью готов к использованию S3. Просто запустите миграцию:

```powershell
npm run migrate:public-to-s3
```

И все изображения автоматически начнут загружаться из S3!

