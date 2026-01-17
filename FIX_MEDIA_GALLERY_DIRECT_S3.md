# ✅ Исправлено: MediaGallery получает 0 items

## Проблема

`[MediaGallery] Received items: 0` - все галереи возвращали пустой массив.

## Причина

Server Components делали `fetch` к собственному API (`/api/gallery/[category]`), что приводило к проблемам:

1. **Двойной запрос:** Server Component → API Route → S3
2. **NEXT_PUBLIC_APP_URL не установлен:** В production `baseUrl` был пустой или неверный
3. **Ненадежность:** `fetch` к `localhost` не работает в некоторых окружениях

## Решение

Переписал все страницы галереи для **прямого обращения к S3**:
- ✅ `apps/site/app/[locale]/mistora/page.tsx`
- ✅ `apps/site/app/[locale]/railings/page.tsx`
- ✅ `apps/site/app/[locale]/windows/page.tsx`
- ✅ `apps/site/app/[locale]/fromShetah/page.tsx`

### Было (неправильно):
```typescript
async function getMestoraImages(): Promise<MediaItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  (typeof window === 'undefined' ? 'http://localhost:3000' : '')
  const url = `${baseUrl}/api/gallery/mestor`
  
  const response = await fetch(url, {
    next: { revalidate: 3600 }
  })
  
  const data = await response.json()
  return data.items || []
}
```

### Стало (правильно):
```typescript
const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'

function getS3Client() {
  if (!S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return null
  }
  
  return new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

async function getMestoraImages(): Promise<MediaItem[]> {
  const s3Client = getS3Client()
  
  if (!S3_BUCKET || !s3Client) {
    console.warn('[Mistora] S3 not configured')
    return []
  }

  try {
    const prefix = 'images/mestor/'
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
    })

    const response = await s3Client.send(command)
    const contents = response.Contents || []

    const items: MediaItem[] = contents
      .filter(item => {
        const key = item.Key || ''
        return /\.(webp|jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(key)
      })
      .map(item => {
        const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${item.Key}`
        const isVideo = /\.(mp4|webm|mov|avi)$/i.test(item.Key || '')
        
        return {
          src: url,
          type: (isVideo ? 'video' : 'image') as 'video' | 'image'
        }
      })
      .sort((a, b) => a.src.localeCompare(b.src))

    return items
  } catch (error: any) {
    console.error('[Mistora] Error fetching from S3:', error.message)
    return []
  }
}
```

## Преимущества нового подхода

1. ✅ **Прямое обращение к S3** - без промежуточных API
2. ✅ **Работает в любом окружении** - не зависит от `NEXT_PUBLIC_APP_URL`
3. ✅ **Быстрее** - один запрос вместо двух
4. ✅ **Надежнее** - меньше точек отказа
5. ✅ **Лучшая отладка** - логи прямо в Server Component

## Что нужно проверить

1. **AWS Credentials:** Убедитесь, что в `apps/site/.env.local` есть:
   ```env
   NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
   NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   ```

2. **Для Vercel:** Добавьте те же переменные в Settings → Environment Variables

3. **Bucket Policy:** Примените публичную политику (см. `FIX_403_FORBIDDEN_S3.md`)

## Проверка

После перезапуска сервера (`npm run dev`):

1. Откройте `/mistora`
2. Проверьте консоль сервера - должно быть:
   ```
   [Mistora] Listing S3 objects with prefix: images/mestor/
   [Mistora] S3 Response: { totalObjects: X, ... }
   [Mistora] Returning X items from S3
   [Mistora Page] Rendering with items: X
   ```
3. Проверьте консоль браузера:
   ```
   [MediaGallery] Received items: X
   [MediaGallery] Videos: 0 Images: X
   ```

Где `X` > 0.

## Fallback

Если AWS credentials не настроены, функции вернут пустой массив `[]`, и `MediaGallery` покажет пустую галерею (но без ошибок).

Для полного fallback на статические данные можно добавить:
```typescript
const items = await getMestoraImages()
if (items.length === 0) {
  // Fallback to static data
  const staticItems = [
    { src: '/images/mestor/image1.webp', type: 'image' as const },
    // ...
  ]
  return <MediaGallery items={staticItems} />
}
```

## API Routes больше не нужны

API routes (`/api/gallery/[category]`) все еще работают для обратной совместимости, но теперь не используются Server Components. Их можно оставить для клиентских компонентов или удалить.

