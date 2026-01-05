# Исправление проблемы с получением изображений из S3

## Проблема
MediaGallery и DgamimCarousel получают 0 items, хотя изображения есть в S3.

## Диагностика

### Шаг 1: Проверьте переменные окружения

Убедитесь, что в `.env.local` или в Vercel установлены:

```env
# Для Site приложения
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Шаг 2: Используйте тестовый endpoint

Откройте в браузере:
```
http://localhost:3000/api/gallery/test-s3?prefix=images/dgamim/
```

Или для другой категории:
```
http://localhost:3000/api/gallery/test-s3?prefix=images/rails/
```

Это покажет:
- Правильно ли настроен S3 клиент
- Какие файлы найдены в S3
- Структуру папок

### Шаг 3: Проверьте структуру S3

Убедитесь, что в S3 bucket структура такая:

```
pashkovsky-gallery/
├── images/
│   ├── dgamim/          ← Модели (для DgamimCarousel)
│   │   ├── atlas/
│   │   │   ├── image1.webp
│   │   │   └── image2.webp
│   │   ├── venice/
│   │   │   └── image1.webp
│   │   └── ...
│   ├── rails/          ← Перила
│   │   ├── image1.webp
│   │   └── image2.webp
│   ├── pergulot/       ← Перголы
│   ├── windows/        ← Окна
│   └── ...
```

## Решения

### Решение 1: Проверьте логи сервера

После добавления логирования, проверьте консоль сервера при запросе:
```
GET /api/gallery/models
GET /api/gallery/dgamim
```

Вы увидите:
- Настроен ли S3 клиент
- Сколько объектов найдено
- Какие ключи возвращает S3

### Решение 2: Проверьте права доступа AWS

Убедитесь, что AWS ключи имеют права:
- `s3:ListBucket` для bucket
- `s3:GetObject` для объектов

### Решение 3: Проверьте регион

Убедитесь, что `NEXT_PUBLIC_AWS_S3_REGION` соответствует региону вашего bucket.

## Что было добавлено

1. ✅ **Расширенное логирование** в `/api/gallery/models` и `/api/gallery/[category]`
2. ✅ **Тестовый endpoint** `/api/gallery/test-s3` для диагностики
3. ✅ **Детальная информация** о конфигурации S3

## Следующие шаги

1. Откройте `/api/gallery/test-s3?prefix=images/dgamim/` в браузере
2. Проверьте логи сервера при загрузке страницы
3. Убедитесь, что переменные окружения установлены правильно
4. Проверьте структуру файлов в S3 bucket

