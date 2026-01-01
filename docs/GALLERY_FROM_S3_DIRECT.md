# Прямой доступ к галерее из S3 (без Supabase)

## Преимущества

✅ **Проще** — не нужно добавлять данные в Supabase  
✅ **Быстрее** — меньше запросов, один источник данных  
✅ **Дешевле** — не используются Supabase read units  
✅ **Актуальнее** — изображения всегда синхронизированы с S3  

## Как работает

### 1. API Route
`apps/site/app/api/gallery/[category]/route.ts`

Универсальный API endpoint для любой категории:
- `/api/gallery/rails` → `images/rails/` в S3
- `/api/gallery/pergulot` → `images/pergulot/` в S3
- `/api/gallery/windows` → `images/windows/` в S3

```typescript
// Сканирует S3 bucket
const command = new ListObjectsV2Command({
  Bucket: S3_BUCKET,
  Prefix: `images/${category}/`,
})

// Возвращает массив MediaItem[]
return NextResponse.json({ items })
```

### 2. Страница Railings
`apps/site/app/[locale]/railings/page.tsx`

```typescript
async function getRailsImages(): Promise<MediaItem[]> {
  const response = await fetch(`${baseUrl}/api/gallery/rails`, {
    next: { revalidate: 3600 } // Кеш на 1 час
  })
  return data.items || []
}
```

### 3. Компонент MediaGallery
`apps/site/components/generic/MediaGallery.tsx`

Принимает массив `MediaItem[]` и отображает галерею с лайтбоксом.

## Структура S3

```
pashkovsky-gallery/
├── images/
│   ├── rails/           ← Изображения railings
│   │   ├── railing-1.webp
│   │   ├── railing-2.webp
│   │   └── video-1.mp4
│   ├── pergulot/        ← Изображения пергол
│   │   ├── pergola-1.webp
│   │   └── pergola-2.webp
│   ├── windows/         ← Изображения окон
│   ├── mestor/          ← Мисторы
│   ├── fancy/           ← Фенси
│   ├── fromShetah/      ← С площадки
│   └── dgamim/          ← Модели
```

## Настройка

### Переменные окружения

**Site (`apps/site/.env.local`):**
```env
# AWS S3
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# App URL (для server-side fetch)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Next.js Config

`apps/site/next.config.js` должен включать S3 в `remotePatterns`:

```javascript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: `${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_S3_REGION}.amazonaws.com`,
      pathname: '/**',
    },
  ],
}
```

## Добавление новой категории

### Шаг 1: Загрузите файлы в S3
```bash
# Структура:
images/[category]/image1.webp
images/[category]/image2.webp
```

### Шаг 2: Создайте страницу
`apps/site/app/[locale]/[category]/page.tsx`

```typescript
import { MediaGallery } from '@/components/generic/MediaGallery'

async function getCategoryImages(): Promise<MediaItem[]> {
  const response = await fetch(`${baseUrl}/api/gallery/[category]`, {
    next: { revalidate: 3600 }
  })
  return (await response.json()).items || []
}

export default async function Page({ params: { locale } }) {
  const items = await getCategoryImages()
  
  return (
    <main className="container py-16">
      <MediaGallery title="..." items={items} />
    </main>
  )
}
```

### Шаг 3: Готово!
API автоматически найдет файлы в S3.

## Кеширование

```typescript
fetch(`/api/gallery/rails`, {
  next: { 
    revalidate: 3600  // Кеш на 1 час
  }
})
```

**Преимущества:**
- Снижает нагрузку на S3
- Быстрее загружает страницы
- Экономит AWS запросы

**Обновление кеша:**
- Автоматически через 1 час
- Вручную: перезапустите dev server
- В продакшене: `revalidatePath('/railings')`

## Сравнение подходов

### Через Supabase (старый подход)
```
Page → getGalleryImages() → Supabase DB → S3 URLs
```

**Минусы:**
- 2 источника данных (Supabase + S3)
- Нужно вручную добавлять URL в БД
- Дополнительные запросы к Supabase
- Может быть несинхронизировано

### Напрямую из S3 (новый подход)
```
Page → API /api/gallery/[category] → S3 → URLs
```

**Плюсы:**
- 1 источник данных (только S3)
- Автоматическое обновление
- Меньше запросов
- Всегда синхронизировано

## Использование для других страниц

### Windows
`apps/site/app/[locale]/windows/page.tsx`
```typescript
const items = await fetch('/api/gallery/windows').then(r => r.json()).then(d => d.items)
```

### Pergulot
`apps/site/app/[locale]/pergulas/page.tsx`
```typescript
const items = await fetch('/api/gallery/pergulot').then(r => r.json()).then(d => d.items)
```

### Mestor
`apps/site/app/[locale]/mistora/page.tsx`
```typescript
const items = await fetch('/api/gallery/mestor').then(r => r.json()).then(d => d.items)
```

## Проверка

### 1. Проверьте S3
```bash
# AWS CLI
aws s3 ls s3://pashkovsky-gallery/images/rails/
```

### 2. Проверьте API
```bash
curl http://localhost:3000/api/gallery/rails
```

**Ожидаемый ответ:**
```json
{
  "items": [
    { "src": "https://...", "type": "image" },
    { "src": "https://...", "type": "video" }
  ]
}
```

### 3. Проверьте страницу
```
http://localhost:3000/he/railings
```

Изображения должны отобразиться в галерее.

## Troubleshooting

### Нет изображений
1. Проверьте S3 bucket — есть ли файлы в `images/rails/`?
2. Проверьте переменные окружения — правильные ли AWS credentials?
3. Проверьте S3 CORS — разрешен ли публичный доступ?
4. Проверьте консоль браузера (F12) — есть ли ошибки?

### Ошибка 403 Forbidden
- Проверьте AWS credentials
- Убедитесь, что у IAM пользователя есть `s3:ListBucket` permission

### Ошибка CORS
Добавьте CORS политику в S3 bucket:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### Изображения не загружаются
Проверьте `next.config.js` — должен быть `remotePatterns` для S3.

## Миграция с Supabase на S3

Если у вас уже есть данные в Supabase:

1. **Оставьте как есть** — можно использовать оба подхода
2. **Или мигрируйте** — обновите страницы на новый подход
3. **Или гибрид** — используйте Supabase для метаданных, S3 для файлов

**Текущий подход:**
```typescript
// Старый (Supabase)
const items = await getGalleryImages('rails')

// Новый (S3)
const items = await fetch('/api/gallery/rails').then(...)
```

## Рекомендации

✅ **Используйте S3 напрямую** для:
- Простых галерей
- Статических изображений
- Когда не нужны метаданные

⚠️ **Используйте Supabase** для:
- Сложных фильтров
- Метаданных (описания, теги, alt text)
- User-generated content
- Модерации контента

## Следующие шаги

1. ✅ Railings теперь работает напрямую с S3
2. Обновите другие страницы галереи (windows, pergulot, и т.д.)
3. Удалите неиспользуемые `getGalleryImages()` вызовы
4. Опционально: удалите таблицы `gallery_images` и `gallery_categories` из Supabase

