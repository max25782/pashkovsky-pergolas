# Структура категорий в S3

## Текущая структура S3

```
s3://pashkovsky-gallery/
└── images/
    ├── fancy/          ✅ (существует)
    ├── mestor/         ❓ (нужно проверить)
    ├── rails/          ❓
    ├── windows/        ❓
    ├── pergulot/       ❓
    ├── fromShetah/     ❓
    └── dgamim/         ✅ (существует)
        ├── santa fe/   ✅ (с пробелом, .webp)
        ├── atlas/
        ├── nova/
        └── ...
```

## Категории в коде

### 1. ✅ Fancy (FencesGallery)
- **API:** `/api/gallery/fancy`
- **S3 путь:** `images/fancy/`
- **Компонент:** `apps/site/components/fences/FencesGallery.tsx`
- **Статус:** Работает (есть fallback на статические данные)

### 2. ❓ Mistora
- **API:** `/api/gallery/mestor`
- **S3 путь:** `images/mestor/`
- **Компонент:** `apps/site/app/[locale]/mistora/page.tsx`
- **Статус:** Возвращает 0 items (проверить наличие папки в S3)

### 3. ❓ Rails
- **API:** `/api/gallery/rails`
- **S3 путь:** `images/rails/`
- **Компонент:** `apps/site/app/[locale]/railings/page.tsx`

### 4. ❓ Windows
- **API:** `/api/gallery/windows`
- **S3 путь:** `images/windows/`
- **Компонент:** `apps/site/app/[locale]/windows/page.tsx`

### 5. ❓ From Shetah
- **API:** `/api/gallery/fromShetah`
- **S3 путь:** `images/fromShetah/`
- **Компонент:** `apps/site/app/[locale]/fromShetah/page.tsx`

### 6. ✅ Dgamim (Models)
- **API:** `/api/gallery/models`
- **S3 путь:** `images/dgamim/` (с подпапками для каждой модели)
- **Компонент:** `apps/site/components/dgamim/dgamim-carousel.tsx`
- **Статус:** Работает (есть fallback на статические данные)

---

## Проверка наличия папок в S3

### Через AWS Console:
1. Откройте: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/images/
2. Проверьте, какие папки существуют

### Через AWS CLI:
```bash
aws s3 ls s3://pashkovsky-gallery/images/
```

### Через тестовый API (если сервер запущен):
```
http://localhost:3000/api/gallery/test-s3?prefix=images/mestor/
http://localhost:3000/api/gallery/test-s3?prefix=images/rails/
http://localhost:3000/api/gallery/test-s3?prefix=images/windows/
```

---

## Если папка не существует

### Вариант 1: Загрузить файлы в S3
```bash
# Пример для mestor
aws s3 sync public/images/mestor/ s3://pashkovsky-gallery/images/mestor/
```

### Вариант 2: Использовать статические данные
Компоненты уже имеют fallback на статические данные из `public/images/` или `data/gallery/*.json`.

---

## Важно: Bucket Policy

Для всех категорий нужно применить Bucket Policy для публичного доступа:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::pashkovsky-gallery/*"
    }
  ]
}
```

И отключить Block Public Access (все 4 чекбокса).

---

## Диагностика

Если API возвращает 0 items:

1. **Проверьте AWS credentials** в `apps/site/.env.local`:
   ```env
   NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
   NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```

2. **Проверьте наличие папки** в S3 через AWS Console или CLI

3. **Проверьте логи сервера** при запросе к API:
   ```
   [Gallery API] Request for category: mestor
   [Gallery API] S3 Response for mestor: { totalObjects: X, ... }
   ```

4. **Используйте тестовый endpoint** для диагностики:
   ```
   http://localhost:3000/api/gallery/test-s3?prefix=images/mestor/
   ```

