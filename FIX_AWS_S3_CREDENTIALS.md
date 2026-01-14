# 🔧 Исправление ошибки AWS S3 Credentials

## ❌ Текущая ошибка

```
InvalidAccessKeyId: The AWS Access Key Id you provided does not exist in our records.
AWSAccessKeyId: AAKIA4PFZSZFMCYNRASVZ
```

## 🔍 Причина

**Важно:** В AWS IAM консоли показан ключ `AKIA4PFZSZFMCYNRASVZ` (с одним 'A'), но в ошибке указан `AAKIA4PFZSZFMCYNRASVZ` (с двойным 'A'). 

Возможные причины:
1. **Опечатка в переменной окружения** - лишний символ 'A' в начале
2. **Неправильный Secret Access Key** - ключ существует, но секретный ключ неверный
3. **Несоответствие региона** - bucket находится в другом регионе, чем указано в конфигурации
4. **Bucket не существует** или имя bucket указано неверно

## ✅ Решение

### Шаг 1: Проверьте текущие ключи в AWS IAM

1. Откройте [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Перейдите в **Users** → найдите пользователя `pashkovsky-s3` (или вашего S3 пользователя)
3. Откройте вкладку **Security credentials**
4. Проверьте список **Access keys**:
   - ✅ **Active** ключи должны быть видны
   - ❌ Если ключ `AAKIA4PFZSZFMCYNRASVZ` отсутствует → он был удален

### Шаг 2: Получите Secret Access Key

**Ключ `AKIA4PFZSZFMCYNRASVZ` существует и активен**, но показывает "Never used. 9 days old."

Это означает, что:
- ✅ Access Key ID правильный
- ❓ **Secret Access Key может быть неправильным или потерянным**

**Вариант A: Если у вас есть Secret Access Key**
- Проверьте, что он скопирован полностью (40 символов)
- Убедитесь, что нет лишних пробелов или переносов строк

**Вариант B: Если Secret Access Key потерян**
1. В AWS IAM → Users → `pashkovsky-s3` → Security credentials
2. Найдите Access Key `AKIA4PFZSZFMCYNRASVZ`
3. Нажмите **"Delete"** (старый ключ без Secret Key бесполезен)
4. Нажмите **"Create access key"**
5. Выберите **Application running outside AWS**
6. **ВАЖНО:** Сохраните оба значения:
   - **Access Key ID** (например: `AKIA...`)
   - **Secret Access Key** ⚠️ **Показывается только один раз!**

### Шаг 3: Проверьте текущую конфигурацию

Откройте в браузере диагностический endpoint:
```
http://localhost:3001/api/debug/s3-config
```

Это покажет:
- Какие переменные окружения установлены
- Правильно ли настроен Access Key ID
- Есть ли несоответствия в регионе или bucket

### Шаг 4: Обновите переменные окружения

#### Для локальной разработки (`apps/crm/.env.local`):

```env
# AWS S3 Configuration
AWS_S3_BUCKET_NAME=pashkovsky-gallery  # ← Проверьте правильное имя bucket
AWS_S3_REGION=us-east-1  # ← Должен совпадать с регионом bucket и IAM пользователя
AWS_ACCESS_KEY_ID=AKIA4PFZSZFMCYNRASVZ  # ← БЕЗ двойного 'A' в начале!
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here  # ← Получите из AWS IAM (показывается только один раз!)
```

**⚠️ КРИТИЧНО:** 
- Access Key ID должен начинаться с `AKIA` (один 'A'), НЕ `AAKIA` (два 'A')
- Secret Access Key можно получить только при создании ключа. Если потеряли - создайте новый ключ

#### Для Vercel (Production):

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект **pashkovsky-crm**
3. Перейдите в **Settings** → **Environment Variables**
4. Обновите или создайте:
   - `AWS_ACCESS_KEY_ID` = ваш новый Access Key ID
   - `AWS_SECRET_ACCESS_KEY` = ваш новый Secret Access Key
   - `AWS_S3_BUCKET_NAME` = `pashkovsky-gallery`
   - `AWS_S3_REGION` = `eu-north-1` (или `us-east-1`)

5. **Важно:** После обновления переменных → **Redeploy** проект!

### Шаг 5: Перезапустите локальный сервер

```bash
# Остановите текущий процесс (Ctrl+C)
# Затем запустите снова
npm run dev
```

### Шаг 6: Проверьте логи и диагностику

После перезапуска:

1. **Проверьте диагностический endpoint:**
   ```
   http://localhost:3001/api/debug/s3-config
   ```
   Должно показать правильную конфигурацию без предупреждений.

2. **При попытке загрузить PDF, в логах должно появиться:**
   ```
   [S3 Upload] Configuration: {
     bucket: 'pashkovsky-gallery',
     region: 'us-east-1',
     accessKeyId: 'AKIA4PFZ...ASVZ',  # ← Маскированный ключ (должен начинаться с AKIA)
     hasSecretKey: true
   }
   ```

3. **Если ошибка `InvalidAccessKeyId` все еще появляется:**
   - ✅ Проверьте, что Access Key ID начинается с `AKIA` (один 'A'), не `AAKIA`
   - ✅ Убедитесь, что Secret Access Key скопирован полностью (без лишних пробелов, переносов строк)
   - ✅ Проверьте, что bucket существует в указанном регионе (`us-east-1`)
   - ✅ Убедитесь, что у пользователя `pashkovsky-s3` есть политика `AmazonS3FullAccess`
   - ✅ Проверьте, что bucket name правильный (может быть `pashkovsky-gallery` или другое имя)

## 🔐 Проверка прав доступа

Убедитесь, что IAM пользователь имеет политику:

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
        "arn:aws:s3:::pashkovsky-gallery/*",
        "arn:aws:s3:::pashkovsky-gallery"
      ]
    }
  ]
}
```

Или используйте готовую политику `AmazonS3FullAccess` (менее безопасно, но проще).

## 📝 Примечания

- ⚠️ **Безопасность:** Никогда не коммитьте `.env.local` в git
- ⚠️ **Secret Key:** Показывается только один раз при создании
- 🔄 **Ротация:** Рекомендуется менять ключи каждые 90 дней
- 🗑️ **Удаление:** После создания нового ключа, удалите старый неработающий

## ✅ После исправления

После обновления ключей:
1. ✅ Ошибка `InvalidAccessKeyId` исчезнет
2. ✅ PDF генерация будет работать
3. ✅ Загрузка файлов в S3 будет успешной

