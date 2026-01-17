# 🔒 Исправление: Access Denied для изображения в S3

## Проблема

```
URL: pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
Error: AccessDenied - Access Denied
```

Файл существует в S3, но нет публичного доступа к нему.

## Решение

### Вариант 1: Сделать файл публичным (Быстрое решение)

1. **Откройте AWS S3 Console:**
   - https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery
   - Перейдите в папку: `images/dgamim/santa-fe/`
   - Найдите файл: `1.jpg`

2. **Сделайте файл публичным:**
   - Выберите файл `1.jpg`
   - Нажмите "Actions" → "Make public using ACL"
   - Подтвердите

### Вариант 2: Настроить Bucket Policy для публичного доступа (Рекомендуется)

Это позволит всем файлам в bucket быть публично доступными:

1. **Откройте AWS S3 Console:**
   - https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions

2. **Bucket Policy:**
   - Перейдите в "Bucket Policy"
   - Добавьте следующую политику:

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

3. **Block Public Access:**
   - Убедитесь что "Block Public Access" НЕ блокирует чтение
   - Или отключите "Block all public access" для чтения

### Вариант 3: Использовать CloudFront (Для продакшена)

Если не хотите делать bucket полностью публичным:

1. Создайте CloudFront Distribution
2. Настройте Origin Access Control (OAC)
3. Используйте CloudFront URL вместо прямого S3 URL

---

## Быстрое решение прямо сейчас

### Через AWS CLI:

```bash
aws s3api put-object-acl \
  --bucket pashkovsky-gallery \
  --key images/dgamim/santa-fe/1.jpg \
  --acl public-read
```

### Или для всех файлов в папке:

```bash
aws s3 sync s3://pashkovsky-gallery/images/dgamim/santa-fe/ \
  s3://pashkovsky-gallery/images/dgamim/santa-fe/ \
  --acl public-read
```

---

## Проверка после исправления

1. Откройте URL в браузере:
   ```
   https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
   ```
2. Должно открыться изображение (без ошибки Access Denied)

---

## Рекомендация

**Используйте Вариант 2 (Bucket Policy)** - это самое правильное решение для публичной галереи изображений. Все файлы в bucket будут доступны для чтения, но только чтения (нельзя удалять или изменять).

---

## Если используете CloudFront

После настройки CloudFront, обновите код чтобы использовать CloudFront URL вместо прямого S3 URL:

```typescript
// Вместо:
const S3_BASE_URL = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`

// Используйте:
const S3_BASE_URL = `https://your-cloudfront-domain.cloudfront.net`
```

Но для быстрого решения сейчас - используйте Вариант 1 или 2.

