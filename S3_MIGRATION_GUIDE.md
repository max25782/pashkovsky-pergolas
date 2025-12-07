# Миграция изображений с Supabase Storage на AWS S3

## Зачем переходить на S3?

- ✅ **Масштабируемость**: Неограниченное хранилище
- ✅ **Производительность**: CDN интеграция (CloudFront)
- ✅ **Стоимость**: Дешевле для больших объемов
- ✅ **Надежность**: 99.999999999% (11 девяток)

## Шаг 1: Создание S3 Bucket

### Через AWS Console:

1. Зайдите в [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Нажмите **Create bucket**
3. Настройки:
   - **Bucket name**: `pashkovsky-gallery` (или свое название)
   - **Region**: выберите ближайший регион (например, `eu-north-1` для Стокгольма)
   - **Object Ownership**: **ACLs disabled (recommended)** ← оставьте по умолчанию
     - Современные bucket используют Bucket Policy вместо ACLs
   - **Block Public Access**: Снимите все галочки (чтобы изображения были публичными)
     - ⚠️ Подтвердите, что понимаете риски (для публичной галереи это нормально)
   - **Bucket Versioning**: Disable (не нужно для изображений)
   - **Default encryption**: 
     - **Encryption type**: Выберите **SSE-S3** (бесплатно, достаточно для публичных изображений)
     - **Bucket Key**: Disable (не нужно для SSE-S3)
4. Нажмите **Create bucket**

### Настройка публичного доступа:

1. Выберите созданный bucket
2. Перейдите в **Permissions**

#### Шаг 3.1: Bucket Policy

1. **Bucket Policy** → **Edit** → Вставьте ТОЛЬКО это:

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

⚠️ **Важно**: 
- Замените `pashkovsky-gallery` на имя вашего bucket
- Это должна быть ТОЛЬКО Bucket Policy, без CORS конфигурации
- После вставки нажмите **Save changes**

#### Шаг 3.2: CORS Configuration (отдельно!)

1. В том же разделе **Permissions** найдите **Cross-origin resource sharing (CORS)**
2. Нажмите **Edit**
3. Вставьте:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

4. Нажмите **Save changes**

⚠️ **Важно**: 
- Bucket Policy и CORS - это РАЗНЫЕ настройки
- CORS настраивается в отдельном разделе, не внутри Bucket Policy
- Если видите ошибку синтаксиса - убедитесь, что в Bucket Policy только JSON из шага 3.1

## Шаг 2: Создание IAM User

1. Зайдите в [IAM Console](https://console.aws.amazon.com/iam/)
2. **Users** → **Add users** (или **Create user**)

### Шаг 2.1: Specify user details

3. **User name**: `pashkovsky-s3-user` (любое имя)

4. **Select AWS credential type**: 
   - ✅ **ВАЖНО**: Отметьте **Access key - Programmatic access**
   - ❌ **НЕ отмечайте** "Password - AWS Management Console access" (не нужно для S3 API)
   - ⚠️ Если вы уже отметили "Provide user access to the AWS Management Console" - это не критично, но для S3 API нужен именно Access Key

5. Нажмите **Next: Permissions**

### Шаг 2.2: Set permissions

6. **Set permissions**:
   - Выберите **Attach existing policies directly**
   - Найдите и отметьте **AmazonS3FullAccess**
   - (Или создайте более ограниченную политику - см. ниже)

7. Нажмите **Next: Tags** (можно пропустить)

8. Нажмите **Next: Review**

9. Нажмите **Create user**

### Шаг 2.3: Создание Access Key

10. После создания пользователя вы увидите страницу "Retrieve access keys":
    - Если вы выбрали "Access key - Programmatic access" на шаге 1, ключи будут показаны сразу
    - Если нет - нажмите **Create access key**

11. **Выберите use case**: 
    - Выберите **Application running outside AWS**
    - Нажмите **Next**

12. **ВАЖНО - Сохраните ключи!**:
    - **Access key ID**: Выглядит как `AKIAIOSFODNN7EXAMPLE` (20 символов, начинается с `AKIA`)
    - **Secret access key**: Выглядит как `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` (40 символов)
    - ⚠️ **Secret access key показывается только один раз!** Сохраните его сразу!
    - Скопируйте оба ключа в безопасное место (например, `.env.local`)

### Альтернативный способ (если ключи не показались):

Если вы не создали Access Key при создании пользователя:

1. Зайдите в **Users** → выберите вашего пользователя (`pashkovsky-s3-user`)
2. Перейдите на вкладку **Security credentials**
3. Прокрутите до раздела **Access keys**
4. Нажмите **Create access key**
5. Выберите **Application running outside AWS**
6. Нажмите **Next** → **Create access key**
7. Сохраните оба ключа!

### Что такое Access Key ID?

**Access Key ID** - это НЕ ваш email и НЕ пароль. Это:
- 🔑 Уникальный идентификатор для доступа к AWS API
- 📝 Выглядит как: `AKIAIOSFODNN7EXAMPLE` (20 символов, начинается с `AKIA`)
- 🔒 Используется вместе с Secret Access Key для аутентификации
- 💻 Используется только для программного доступа (не для входа в консоль)

**Secret Access Key** - это:
- 🔐 Секретный ключ (как пароль, но для API)
- 📝 Выглядит как: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` (40 символов)
- ⚠️ Показывается только один раз при создании!
- 🔒 Храните в секрете, не коммитьте в git!

### Более безопасная политика (опционально):

Вместо `AmazonS3FullAccess` можно создать ограниченную политику:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::pashkovsky-gallery",
        "arn:aws:s3:::pashkovsky-gallery/*"
      ]
    }
  ]
}
```

Это даст доступ только к вашему bucket, а не ко всем S3 ресурсам.

## Шаг 3: Установка зависимостей

```bash
npm install @aws-sdk/client-s3 dotenv
```

## Шаг 4: Настройка переменных окружения

Добавьте в `.env.local`:

```env
# AWS S3 Configuration
AWS_S3_BUCKET_NAME=pashkovsky-gallery
AWS_S3_REGION=eu-central-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Где взять значения:**

1. **AWS_S3_BUCKET_NAME**: Имя вашего bucket (например, `pashkovsky-gallery`)
2. **AWS_S3_REGION**: Регион bucket (например, `eu-central-1`, `us-east-1`)
3. **AWS_ACCESS_KEY_ID**: Access Key ID из шага 2 (начинается с `AKIA...`)
4. **AWS_SECRET_ACCESS_KEY**: Secret Access Key из шага 2 (40 символов)

**Пример реальных значений:**
```env
AWS_S3_BUCKET_NAME=pashkovsky-gallery
AWS_S3_REGION=eu-central-1
AWS_ACCESS_KEY_ID=AKIAEXAMPLE1234567890
AWS_SECRET_ACCESS_KEY=abc123xyz789def456ghi012jkl345mno678pqr
```

⚠️ **Важно**: Замените примеры на ваши реальные ключи из IAM!

# Existing variables
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_TOKEN=...
```

Добавьте в `.env` (для production):

```env
AWS_S3_BUCKET_NAME=pashkovsky-gallery
AWS_S3_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

## Шаг 5: Миграция существующих изображений

```bash
node scripts/migrate-to-s3.mjs
```

Скрипт:
1. Получит все изображения из базы данных
2. Скачает их из Supabase Storage
3. Загрузит в S3
4. Обновит URL в базе данных

## Шаг 6: Обновление кода для загрузки

Файл: `app/admin-api/gallery/upload/route.ts`

Замените логику загрузки с Supabase на S3 (см. обновленный код ниже).

## Шаг 7: Тестирование

1. Запустите миграцию: `node scripts/migrate-to-s3.mjs`
2. Проверьте S3 bucket — должны появиться изображения
3. Откройте админку галереи — изображения должны загружаться с S3
4. Загрузите новое изображение — должно попасть в S3

## Шаг 8: CloudFront (опционально)

Для еще лучшей производительности настройте CloudFront CDN:

1. Зайдите в [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. **Create Distribution**
3. **Origin Domain**: Выберите ваш S3 bucket
4. **Viewer Protocol Policy**: Redirect HTTP to HTTPS
5. **Create Distribution**
6. Обновите URL в коде на CloudFront URL

## Откат (если что-то пошло не так)

Скрипт не удаляет изображения из Supabase, поэтому можно откатиться:

1. В базе данных выполните:
```sql
-- Вернуть старые URL (если сохранили backup)
UPDATE gallery_images SET url = old_url, storage_path = old_storage_path;
```

2. Или просто перезапустите миграцию

## Стоимость

Примерная стоимость AWS S3:
- Хранилище: $0.023 за GB/месяц
- Запросы GET: $0.0004 за 1000 запросов
- Передача данных: первые 100 GB бесплатно

Для 1000 изображений (~5 GB):
- Хранилище: ~$0.12/месяц
- Запросы (100K views): ~$0.04/месяц
- **Итого**: ~$0.16/месяц

## Мониторинг

Проверьте использование в AWS Console:
- S3 → Bucket → Metrics
- CloudWatch для детальной аналитики
- Billing Dashboard для стоимости

## Безопасность

✅ **Что настроено**:
- Публичный доступ только для чтения (GET)
- IAM пользователь с ограниченными правами
- Шифрование SSE-S3 (изображения шифруются при хранении)

⚠️ **Рекомендации**:
- Не коммитьте `.env.local` в git
- Храните AWS ключи в безопасности
- Используйте разные ключи для dev/prod
- Включите MFA для AWS аккаунта

### О шифровании:

**SSE-S3** (выбрано):
- ✅ Бесплатно
- ✅ Автоматическое шифрование всех объектов
- ✅ Прозрачная работа (не нужно ничего менять в коде)
- ✅ Достаточно для публичной галереи

**SSE-KMS** (не нужно):
- 💰 Платно ($0.03 за 10,000 запросов)
- 🔐 Для конфиденциальных данных
- 📊 Детальный аудит доступа
- ❌ Избыточно для публичных изображений

**DSSE-KMS** (не нужно):
- 💰💰 Очень дорого
- 🔐🔐 Двойное шифрование
- 🏢 Для критичных корпоративных данных
- ❌ Избыточно для публичных изображений

## Troubleshooting

### "Access Denied" при загрузке:
- Проверьте Bucket Policy
- Проверьте IAM permissions
- Проверьте правильность ключей

### Изображения не загружаются:
- Проверьте CORS настройки
- Проверьте URL (должен быть публичным)
- Проверьте Content-Type

### Миграция падает:
- Проверьте лимиты S3
- Проверьте интернет соединение
- Запустите миграцию по частям

