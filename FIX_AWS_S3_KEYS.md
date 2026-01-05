# Исправление ошибки InvalidAccessKeyId для S3

## Проблема

Ошибка: `InvalidAccessKeyId` - AWS ключ доступа недействителен.

## Решение

### Вариант 1: Обновить AWS ключи (Рекомендуется)

1. **Создайте новые AWS ключи:**
   - Зайдите в AWS Console → IAM → Users
   - Выберите пользователя или создайте нового
   - Security credentials → Create access key
   - Сохраните `Access Key ID` и `Secret Access Key`

2. **Обновите переменные окружения:**

   **В `.env.local` (для локальной разработки):**
   ```env
   AWS_ACCESS_KEY_ID=your-new-access-key-id
   AWS_SECRET_ACCESS_KEY=your-new-secret-access-key
   NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
   NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
   ```

   **В Vercel (для production):**
   - Settings → Environment Variables
   - Обновите `AWS_ACCESS_KEY_ID` и `AWS_SECRET_ACCESS_KEY`

3. **Проверьте права доступа:**
   
   Убедитесь, что IAM пользователь имеет политику:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:ListBucket",
           "s3:GetObject"
         ],
         "Resource": [
           "arn:aws:s3:::pashkovsky-gallery",
           "arn:aws:s3:::pashkovsky-gallery/*"
         ]
       }
     ]
   }
   ```

### Вариант 2: Сделать S3 bucket публичным (Альтернатива)

Если вы хотите получать изображения без авторизации:

1. **В AWS Console:**
   - S3 → ваш bucket → Permissions
   - Block public access → Edit → Отключите блокировку
   - Bucket policy → Добавьте:

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

2. **Обновите код для использования публичных URL:**

   Если bucket публичный, можно использовать прямые URL без ListObjects:
   ```
   https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/atlas/image1.webp
   ```

### Вариант 3: Использовать статические данные (Временное решение)

Пока AWS ключи не исправлены, компоненты будут использовать статические данные из `dgamim.json`.

## Проверка

После обновления ключей:

1. Перезапустите сервер:
   ```bash
   npm run dev
   ```

2. Откройте тестовый endpoint:
   ```
   http://localhost:3000/api/gallery/test-s3?prefix=images/dgamim/
   ```

3. Проверьте логи сервера - не должно быть ошибок `InvalidAccessKeyId`

## Важно

⚠️ **Безопасность:**
- Никогда не коммитьте AWS ключи в git
- Используйте переменные окружения
- Регулярно ротируйте ключи
- Используйте минимальные необходимые права

## Текущий статус

- ❌ AWS ключ `AKIA4PFZSZFMBYZSLE7L` недействителен
- ✅ Компоненты используют статические данные как fallback
- ✅ Добавлено логирование для диагностики

