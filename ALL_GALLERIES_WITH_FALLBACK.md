# ✅ Все галереи теперь с fallback на статические данные

## Что сделано

Переписал все 4 Server Components галерей для работы с fallback, как в `FencesGallery`:

### 1. ✅ Mistora (Мисторы)
- **Файл:** `apps/site/app/[locale]/mistora/page.tsx`
- **S3:** `images/mestor/`
- **Fallback:** `data/gallery/mestor.json`
- **Логика:**
  1. Пробует S3
  2. Если S3 не настроен → fallback на JSON
  3. Если S3 вернул 0 items → fallback на JSON
  4. Если S3 ошибка → fallback на JSON

### 2. ✅ Railings (Перила)
- **Файл:** `apps/site/app/[locale]/railings/page.tsx`
- **S3:** `images/rails/`
- **Fallback:** `data/gallery/rails.json`
- **Логика:** Аналогично Mistora

### 3. ✅ Windows (Окна)
- **Файл:** `apps/site/app/[locale]/windows/page.tsx`
- **S3:** `images/windows/`
- **Fallback:** `data/gallery/windows.json`
- **Логика:** Аналогично Mistora

### 4. ✅ From Shetah (С площадки)
- **Файл:** `apps/site/app/[locale]/fromShetah/page.tsx`
- **S3:** `images/fromShetah/`
- **Fallback:** `data/gallery/fromShetah.json`
- **Логика:** Аналогично Mistora

---

## Как это работает

### Пример кода (Mistora):

```typescript
import mestorData from '@/data/gallery/mestor.json'

async function getMestoraImages(): Promise<MediaItem[]> {
  const s3Client = getS3Client()
  
  // Если S3 не настроен → сразу fallback
  if (!S3_BUCKET || !s3Client) {
    console.log('[Mistora] S3 not configured, using static data')
    return (mestorData as { items: MediaItem[] }).items || []
  }

  try {
    // Пробуем получить из S3
    const response = await s3Client.send(command)
    const items = // ... обработка S3 ответа
    
    // Если S3 пустой → fallback
    if (items.length === 0) {
      console.log('[Mistora] S3 returned 0 items, using static fallback')
      return (mestorData as { items: MediaItem[] }).items || []
    }
    
    return items
  } catch (error) {
    // При ошибке → fallback
    console.error('[Mistora] Error fetching from S3:', error.message)
    return (mestorData as { items: MediaItem[] }).items || []
  }
}
```

---

## Преимущества

✅ **Надежность:** Галереи всегда работают, даже если S3 недоступен  
✅ **Fallback:** Автоматическое переключение на статические данные  
✅ **Гибкость:** Можно использовать только S3, только JSON, или оба  
✅ **Логирование:** Понятные сообщения о том, какой источник используется  
✅ **Производительность:** S3 если доступен, JSON если нет  

---

## Статические JSON файлы

Все файлы уже существуют в `apps/site/data/gallery/`:
- ✅ `mestor.json`
- ✅ `rails.json`
- ✅ `windows.json`
- ✅ `fromShetah.json`
- ✅ `fancy.json` (уже используется в `FencesGallery`)
- ✅ `dgamim.json` (уже используется в `DgamimCarousel`)

**Сейчас они пустые** (`{ "items": [] }`), но можно наполнить их позже.

---

## Как наполнить JSON файлы

### Вариант 1: Вручную

Отредактируйте файл (например, `apps/site/data/gallery/mestor.json`):

```json
{
  "items": [
    {
      "src": "/images/mestor/image1.webp",
      "type": "image"
    },
    {
      "src": "/images/mestor/image2.webp",
      "type": "image"
    },
    {
      "src": "/images/mestor/video1.mp4",
      "type": "video"
    }
  ]
}
```

### Вариант 2: Скопировать из S3

Если файлы уже в S3, можно скопировать их в `public/images/`:

```bash
# Скачать из S3 в public
aws s3 sync s3://pashkovsky-gallery/images/mestor/ public/images/mestor/
aws s3 sync s3://pashkovsky-gallery/images/rails/ public/images/rails/
aws s3 sync s3://pashkovsky-gallery/images/windows/ public/images/windows/
aws s3 sync s3://pashkovsky-gallery/images/fromShetah/ public/images/fromShetah/
```

Затем обновите JSON файлы с локальными путями:

```json
{
  "items": [
    { "src": "/images/mestor/IMG_12345.webp", "type": "image" },
    { "src": "/images/mestor/IMG_12346.webp", "type": "image" }
  ]
}
```

### Вариант 3: Оставить пустыми

Если S3 всегда доступен, JSON файлы могут оставаться пустыми. Они будут использоваться только как последний fallback.

---

## Проверка

### 1. С настроенным S3:
```
[Mistora] Listing S3 objects with prefix: images/mestor/
[Mistora] S3 Response: { totalObjects: 10, ... }
[Mistora] Returning 10 items from S3
[MediaGallery] Received items: 10
```

### 2. Без S3 (или пустой):
```
[Mistora] S3 not configured, using static data
[MediaGallery] Received items: 0   (если JSON пустой)
```

Или:
```
[Mistora] S3 returned 0 items, using static fallback
[MediaGallery] Received items: 5   (если JSON наполнен)
```

### 3. При ошибке S3:
```
[Mistora] Error fetching from S3: ...
[MediaGallery] Received items: 5   (fallback на JSON)
```

---

## Текущий статус

- ✅ **Mistora** - fallback готов
- ✅ **Railings** - fallback готов
- ✅ **Windows** - fallback готов
- ✅ **FromShetah** - fallback готов
- ✅ **Fences** - уже было (пример)
- ✅ **Dgamim** - уже было (пример)

---

## Следующие шаги

1. **Перезапустите сервер:**
   ```bash
   npm run dev
   ```

2. **Проверьте все страницы:**
   - `/mistora`
   - `/railings`
   - `/windows`
   - `/fromShetah`

3. **Опционально: Наполните JSON файлы** (если хотите fallback с реальными данными)

4. **Для production:** Убедитесь, что AWS credentials добавлены в Vercel

---

## Итог

Все галереи теперь работают максимально надежно:
- ✅ Приоритет: S3 (если настроен)
- ✅ Fallback: Статические JSON файлы
- ✅ Graceful degradation: Нет ошибок, всегда что-то показывается
- ✅ Логирование: Видно, какой источник используется

