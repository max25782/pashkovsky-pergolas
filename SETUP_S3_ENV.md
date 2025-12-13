# Инструкция: Настройка переменных окружения для S3

## Проблема
Переменные `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` и `NEXT_PUBLIC_AWS_S3_REGION` должны быть доступны в браузере для работы с S3 изображениями.

## Решение

### Вариант 1: Создать `.env.local` (РЕКОМЕНДУЕТСЯ)

1. Создайте файл `.env.local` в корне проекта
2. Добавьте следующие строки:

```env
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
```

### Вариант 2: Обновить `.env`

Убедитесь, что в `.env` файле есть эти строки БЕЗ пробелов вокруг `=`:

```env
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
```

## Важно!

1. **Перезапустите dev server** после изменения `.env` или `.env.local`:
   ```powershell
   # Остановите текущий (Ctrl+C)
   # Очистите кеш
   Remove-Item -Recurse -Force .next
   # Запустите заново
   npm run dev
   ```

2. **Проверьте в браузере** (откройте консоль):
   ```javascript
   console.log('Bucket:', process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME)
   console.log('Region:', process.env.NEXT_PUBLIC_AWS_S3_REGION)
   ```
   
   Если видите `undefined` - переменные не загружены. Перезапустите dev server.

3. **Формат переменных**:
   - ✅ Правильно: `NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery`
   - ❌ Неправильно: `NEXT_PUBLIC_AWS_S3_BUCKET_NAME = pashkovsky-gallery` (пробелы)
   - ❌ Неправильно: `# NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery` (закомментировано)

## После настройки

После перезапуска dev server:
- ✅ Изображения будут загружаться из S3
- ✅ Hero видео будет работать
- ✅ Ошибки 400 исчезнут


