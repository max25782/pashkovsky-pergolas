# Добавление изображений Railings из S3 в Supabase

## Проблема
Страница `/railings` не показывает изображения, потому что:
1. `rails.json` пустой
2. Таблица `gallery_images` в Supabase пуста для категории `rails`

## Решение

### Вариант 1: Автоматический импорт (Рекомендуется)

Используйте Node.js скрипт для автоматического импорта всех изображений из S3:

```bash
# Убедитесь, что файл .env.local содержит все необходимые переменные
node scripts/import-gallery-from-s3.js rails
```

**Требуемые переменные окружения:**
- `AWS_ACCESS_KEY_ID` - AWS Access Key
- `AWS_SECRET_ACCESS_KEY` - AWS Secret Key
- `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` - Имя S3 bucket (например, `pashkovsky-gallery`)
- `NEXT_PUBLIC_AWS_S3_REGION` - Регион S3 (например, `eu-north-1`)
- `SUPABASE_URL` - URL Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key Supabase

**Что делает скрипт:**
1. Сканирует S3 bucket по пути `images/rails/`
2. Находит все изображения и видео (`.webp`, `.jpg`, `.png`, `.mp4`, и т.д.)
3. Добавляет их в таблицу `gallery_images` в Supabase
4. Пропускает уже существующие файлы
5. Показывает статистику

**Пример вывода:**
```
🚀 Импорт изображений для категории: rails
   S3 Bucket: pashkovsky-gallery
   S3 Region: eu-north-1

📂 Сканирование S3: pashkovsky-gallery/images/rails/
✅ Найдено 25 медиафайлов в S3

📤 Загрузка 25 изображений в Supabase...
✅ Добавлено: railing-1.webp
✅ Добавлено: railing-2.webp
...

📊 Результат:
   ✅ Добавлено: 25
   ⏭️  Пропущено: 0
   ❌ Ошибок: 0

📈 Всего изображений в категории 'rails': 25
✨ Готово!
```

---

### Вариант 2: Ручное добавление через SQL

Если предпочитаете ручной контроль:

1. Откройте **Supabase SQL Editor**
2. Используйте файл `supabase/migrations/add_railings_images.sql`
3. Замените примеры URL на ваши реальные URL из S3
4. Запустите SQL скрипт

**Формат URL:**
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/filename.webp
```

**Пример SQL:**
```sql
INSERT INTO gallery_images (category_key, filename, url, storage_path)
VALUES
  ('rails', 'railing-1.webp', 
   'https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/railing-1.webp',
   'images/rails/railing-1.webp'),
  ('rails', 'railing-2.webp', 
   'https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/railing-2.webp',
   'images/rails/railing-2.webp')
ON CONFLICT (category_key, filename) DO NOTHING;
```

---

## Структура таблиц

### `gallery_categories`
```sql
key TEXT       -- 'rails', 'pergulot', 'windows', и т.д.
name_he TEXT   -- 'מעקות'
name_ru TEXT   -- 'Перила'
name_en TEXT   -- 'Rails'
image_count INTEGER  -- Автоматически обновляется
```

### `gallery_images`
```sql
id UUID
category_key TEXT       -- 'rails'
filename TEXT           -- 'railing-1.webp'
url TEXT                -- Полный URL S3
storage_path TEXT       -- 'images/rails/railing-1.webp'
size INTEGER            -- Размер файла в байтах (опционально)
width INTEGER           -- Ширина изображения (опционально)
height INTEGER          -- Высота изображения (опционально)
mime_type TEXT          -- 'image/webp' (опционально)
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

## Как работает страница Railings

Файл: `apps/site/app/[locale]/railings/page.tsx`

```typescript
// 1. Пытается загрузить из Supabase
const dbItems = await getGalleryImages('rails', { limit: 100 })

// 2. Fallback на статический JSON (если БД пуста)
const staticItems = (rails as { items: MediaItem[] }).items

// 3. Использует то, что доступно
const items = dbItems.length > 0 ? dbItems : staticItems

// 4. Передает в MediaGallery
<MediaGallery title="..." items={items} />
```

**Функция `getGalleryImages`:**
- Находится в `apps/site/lib/gallery/get-gallery-images.ts`
- Использует `SUPABASE_SERVICE_ROLE_KEY` для server-side запросов
- Автоматически формирует полные S3 URL
- Определяет тип файла (изображение или видео)

---

## Импорт других категорий

Используйте тот же скрипт для других категорий:

```bash
# Импорт пергол
node scripts/import-gallery-from-s3.js pergulot

# Импорт окон
node scripts/import-gallery-from-s3.js windows

# Импорт мисторов
node scripts/import-gallery-from-s3.js mestor

# Импорт fancy
node scripts/import-gallery-from-s3.js fancy

# Импорт с площадки
node scripts/import-gallery-from-s3.js fromShetah

# Импорт моделей
node scripts/import-gallery-from-s3.js dgamim
```

---

## Проверка результата

После импорта:

1. Откройте страницу: `http://localhost:3000/he/railings`
2. Изображения должны отобразиться
3. Проверьте консоль браузера на ошибки

**Проверка в Supabase:**
```sql
-- Статистика по категории
SELECT 
  category_key,
  COUNT(*) as total_images,
  MIN(created_at) as first_added,
  MAX(created_at) as last_added
FROM gallery_images 
WHERE category_key = 'rails'
GROUP BY category_key;

-- Первые 10 изображений
SELECT filename, url, created_at
FROM gallery_images
WHERE category_key = 'rails'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Ошибка: "Category not found"
```bash
# Запустите миграцию для создания категорий
# В Supabase SQL Editor:
supabase/migrations/create_gallery_categories.sql
```

### Ошибка: "AWS credentials not found"
```bash
# Проверьте .env.local:
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

### Ошибка: "Supabase not configured"
```bash
# Проверьте .env.local:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Изображения не отображаются
1. Проверьте консоль браузера (F12)
2. Убедитесь, что S3 URLs доступны публично
3. Проверьте CORS настройки S3 bucket
4. Проверьте `next.config.js` - должны быть `remotePatterns` для S3

---

## Следующие шаги

После успешного импорта:

1. Удалите пустой `rails.json` (или оставьте как fallback)
2. Импортируйте другие категории
3. Настройте автоматическую синхронизацию S3 → Supabase (опционально)

