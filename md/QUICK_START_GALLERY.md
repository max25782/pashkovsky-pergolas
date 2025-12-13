# Быстрый старт: Админка галереи

## Что нужно сделать перед использованием

### 1. Выполнить SQL миграции в Supabase

Откройте Supabase Dashboard → SQL Editor и выполните:

1. `supabase/migrations/create_gallery_categories.sql`
2. `supabase/migrations/create_gallery_images.sql`

### 2. Создать Storage Bucket

1. Supabase Dashboard → Storage
2. Создайте bucket с именем `gallery-images`
3. Сделайте его публичным для чтения (Settings → Public bucket)

### 3. Настроить политики доступа (опционально)

Если нужны более строгие политики, используйте SQL из `SETUP_GALLERY_ADMIN.md`

### 4. Готово!

Откройте `/he/admin/gallery` (или `/ru/admin/gallery`) и начните использовать админку.

## Функции

- ✅ Просмотр всех категорий галереи
- ✅ Создание новых категорий
- ✅ Редактирование категорий (названия на 3 языках)
- ✅ Загрузка фотографий в категории (drag & drop)
- ✅ Автоматическая оптимизация изображений (WebP, сжатие)
- ✅ Просмотр всех изображений категории
- ✅ Удаление изображений
- ✅ Автоматический подсчет количества изображений

## Структура файлов

```
app/admin-api/gallery/
  ├── categories/route.ts    # CRUD для категорий
  ├── upload/route.ts         # Загрузка изображений
  └── images/route.ts         # Управление изображениями

components/admin/
  ├── GalleryCategories.tsx  # Главный компонент
  ├── CategoryModal.tsx       # Модалка категории
  ├── PhotoUploadModal.tsx    # Модалка загрузки
  ├── GalleryImagesList.tsx  # Список изображений
  ├── gallery-types.ts        # TypeScript типы
  └── gallery-api.ts          # API функции

app/[locale]/admin/gallery/
  └── page.tsx                # Страница админки
```


