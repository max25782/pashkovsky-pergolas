# Проверка Supabase Storage Bucket

## Шаг 1: Создание Bucket

1. Откройте Supabase Dashboard → **Storage**
2. Нажмите **"New bucket"**
3. Имя bucket: `gallery-images`
4. **Важно**: Отметьте **"Public bucket"** (чтобы изображения были доступны публично)
5. Нажмите **"Create bucket"**

## Шаг 2: Проверка политик доступа

После создания bucket, перейдите в **Storage** → **Policies** → `gallery-images`

Должны быть следующие политики:

### Политика для чтения (Public):
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'gallery-images');
```

### Политика для записи (Service Role):
```sql
CREATE POLICY "Service Role Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gallery-images');
```

### Политика для удаления (Service Role):
```sql
CREATE POLICY "Service Role Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'gallery-images');
```

## Шаг 3: Проверка через SQL

Выполните в SQL Editor:

```sql
-- Проверка существования bucket
SELECT * FROM storage.buckets WHERE name = 'gallery-images';

-- Должен вернуть одну строку с bucket 'gallery-images'
```

## Если bucket не создан

Если вы видите ошибку типа "Bucket not found" или "The resource was not found", значит bucket не создан. Создайте его через Dashboard как описано выше.


