# Настройка админки галереи

## Шаг 1: Создание таблиц в Supabase

Выполните SQL миграции в Supabase SQL Editor:

1. Откройте Supabase Dashboard → SQL Editor
2. Выполните `supabase/migrations/create_gallery_categories.sql`
3. Выполните `supabase/migrations/create_gallery_images.sql`

## Шаг 2: Настройка Supabase Storage

1. Откройте Supabase Dashboard → Storage
2. Создайте новый bucket с именем `gallery-images`
3. Настройте политики доступа:

### Политика для чтения (Public):
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'gallery-images');
```

### Политика для записи (Admin only):
```sql
CREATE POLICY "Admin Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'gallery-images' AND
  auth.role() = 'service_role'
);
```

### Политика для удаления (Admin only):
```sql
CREATE POLICY "Admin Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'gallery-images' AND
  auth.role() = 'service_role'
);
```

## Шаг 3: Переменные окружения

Убедитесь, что в `.env.local` есть:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_TOKEN=your_admin_token
```

## Шаг 4: Использование

1. Откройте `/he/admin/gallery` (или `/ru/admin/gallery`, `/en/admin/gallery`)
2. Введите admin token
3. Вы увидите список категорий галереи
4. Кликните на категорию, чтобы увидеть изображения
5. Используйте кнопку "Загрузить фото" для загрузки новых изображений

## Особенности

- Изображения автоматически оптимизируются (конвертация в WebP, сжатие, изменение размера)
- Максимальный размер файла: 10MB
- Поддерживаемые форматы: JPEG, PNG, WebP, GIF
- Изображения сохраняются в структуре: `gallery-images/{category}/{filename}.webp`
- Счетчик изображений обновляется автоматически

## Миграция существующих изображений

Существующие изображения в `public/images/` остаются доступными. Новые загруженные изображения будут храниться в Supabase Storage.

Для миграции существующих изображений можно создать скрипт, который:
1. Читает файлы из `public/images/{category}/`
2. Загружает их в Supabase Storage
3. Создает записи в таблице `gallery_images`


