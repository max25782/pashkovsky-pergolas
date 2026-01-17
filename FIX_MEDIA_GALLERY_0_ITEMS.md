# Исправление: MediaGallery получает 0 items

## Проблема
`[MediaGallery] Received items: 0` - API возвращает пустой массив.

## Причины

### 1. AWS Credentials не настроены

API `/api/gallery/[category]` требует:
- `NEXT_PUBLIC_AWS_S3_BUCKET_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Проверка:**

Добавьте в `apps/site/.env.local`:
```env
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

**Для Vercel:**
Добавьте те же переменные в Settings → Environment Variables для проекта `@pashkovsky/site`.

---

### 2. Папка не существует в S3

API ищет файлы в `images/mestor/` для категории "mistora".

**Проверка:**

Откройте в браузере (локально):
```
http://localhost:3000/api/gallery/test-s3?prefix=images/mestor/
```

Или проверьте через AWS Console:
https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/images/mestor/

**Если папки нет:**
- Загрузите файлы в S3 в папку `images/mestor/`
- Или измените категорию в коде, если папка называется по-другому

---

### 3. Проверка логов сервера

При запросе к `/api/gallery/mestor` проверьте логи сервера. Должны быть сообщения:

```
[Gallery API] Request for category: mestor
[Gallery API] S3 Configuration: { bucket: '...', region: '...', hasAccessKey: true, hasSecretKey: true }
[Gallery API] Listing S3 objects with prefix: images/mestor/
[Gallery API] S3 Response for mestor: { totalObjects: X, ... }
```

**Если видите:**
- `S3 not configured` → Добавьте AWS credentials
- `totalObjects: 0` → Папка пустая или не существует
- `InvalidAccessKeyId` → Неверные AWS credentials

---

## Решение

### Шаг 1: Проверьте переменные окружения

**Локально (`apps/site/.env.local`):**
```env
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

**В Vercel:**
1. Откройте проект `@pashkovsky/site`
2. Settings → Environment Variables
3. Добавьте те же переменные

---

### Шаг 2: Проверьте структуру S3

Убедитесь, что в S3 есть папка:
```
pashkovsky-gallery/
└── images/
    └── mestor/
        ├── image1.webp
        ├── image2.webp
        └── ...
```

---

### Шаг 3: Используйте тестовый endpoint

Откройте в браузере:
```
http://localhost:3000/api/gallery/test-s3?prefix=images/mestor/
```

Это покажет:
- Правильно ли настроен S3 клиент
- Какие файлы найдены
- Ошибки, если есть

---

### Шаг 4: Проверьте логи сервера

При открытии страницы `/mistora` проверьте консоль сервера. Должны быть логи:
```
[Mistora] Fetching from: http://localhost:3000/api/gallery/mestor
[Gallery API] Request for category: mestor
[Gallery API] S3 Response for mestor: { totalObjects: X, ... }
[Mistora] Got items: X
```

---

## Альтернатива: Использовать статические данные

Если S3 не настроен, можно использовать статические данные из `public/images/`:

```typescript
// apps/site/app/[locale]/mistora/page.tsx
async function getMestoraImages(): Promise<MediaItem[]> {
  // Fallback to static images if API fails
  const staticImages = [
    { src: '/images/mestor/image1.webp', type: 'image' as const },
    { src: '/images/mestor/image2.webp', type: 'image' as const },
    // ...
  ]
  
  try {
    const response = await fetch(`${baseUrl}/api/gallery/mestor`)
    if (response.ok) {
      const data = await response.json()
      if (data.items && data.items.length > 0) {
        return data.items
      }
    }
  } catch (error) {
    console.warn('[Mistora] API failed, using static images')
  }
  
  return staticImages
}
```

---

## Быстрая диагностика

Выполните в терминале:

```bash
# Проверить переменные окружения (локально)
cd apps/site
cat .env.local | grep AWS

# Проверить через API (если сервер запущен)
curl http://localhost:3000/api/gallery/test-s3?prefix=images/mestor/
```

---

## После исправления

После добавления AWS credentials и проверки структуры S3:
1. Перезапустите dev server (`npm run dev`)
2. Откройте страницу `/mistora`
3. Проверьте консоль браузера - должно быть `[MediaGallery] Received items: X` где X > 0

