# Проверка содержимого папок в S3

## ✅ Подтверждено: Все папки существуют

Из скриншота AWS Console видно, что в `images/` есть все нужные папки:
- ✅ `dgamim/`
- ✅ `fancy/`
- ✅ `fromShetah/`
- ✅ `mestor/`
- ✅ `pergulot/`
- ✅ `rails/`
- ✅ `services/`
- ✅ `windows/`

## Следующий шаг: Проверить содержимое папок

### Через AWS Console:

1. Откройте каждую папку и проверьте, есть ли файлы внутри:
   - `images/mestor/` → Должны быть `.webp` или `.jpg` файлы
   - `images/rails/` → Должны быть файлы
   - `images/windows/` → Должны быть файлы
   - И т.д.

2. Особенно важно проверить `images/mestor/`, так как `MediaGallery` возвращает 0 items для этой категории.

### Через AWS CLI:

```bash
# Проверить содержимое mestor
aws s3 ls s3://pashkovsky-gallery/images/mestor/ --recursive

# Проверить содержимое rails
aws s3 ls s3://pashkovsky-gallery/images/rails/ --recursive

# Проверить содержимое windows
aws s3 ls s3://pashkovsky-gallery/images/windows/ --recursive
```

### Через тестовый API (если сервер запущен):

```
http://localhost:3000/api/gallery/test-s3?prefix=images/mestor/
http://localhost:3000/api/gallery/test-s3?prefix=images/rails/
http://localhost:3000/api/gallery/test-s3?prefix=images/windows/
```

## Если папки пустые

Если папки существуют, но пустые, нужно:

1. **Загрузить файлы в S3** из локальной папки `public/images/`:
   ```bash
   # Пример для mestor
   aws s3 sync public/images/mestor/ s3://pashkovsky-gallery/images/mestor/
   
   # Или для всех категорий
   aws s3 sync public/images/ s3://pashkovsky-gallery/images/ --exclude "*.DS_Store"
   ```

2. **Или использовать статические данные** (компоненты уже имеют fallback)

## Если папки не пустые, но API возвращает 0 items

Тогда проблема в:

1. **AWS Credentials** - проверьте `apps/site/.env.local`:
   ```env
   NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
   NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```

2. **Bucket Policy** - должна быть применена для публичного доступа (см. `FIX_403_FORBIDDEN_S3.md`)

3. **Проверьте логи сервера** при запросе к API - должны быть сообщения о количестве найденных файлов

