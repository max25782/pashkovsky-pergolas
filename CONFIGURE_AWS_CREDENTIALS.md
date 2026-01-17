# 🔐 Настройка AWS CLI Credentials

## Проблема

```
Unable to locate credentials. You can configure credentials by running "aws login".
```

AWS CLI установлен, но не настроены credentials.

## Решение

### Шаг 1: Настроить credentials

Выполните в терминале:

```bash
aws configure
```

Вам понадобятся:
- **AWS Access Key ID:** ваш ключ (из `.env.local` или Vercel)
- **AWS Secret Access Key:** ваш секрет (из `.env.local` или Vercel)
- **Default region name:** `eu-north-1` (или ваш регион)
- **Default output format:** `json` (или просто нажмите Enter)

---

## Где взять credentials?

### Вариант 1: Из .env.local

Если у вас есть файл `apps/crm/.env.local`:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/crm
cat .env.local | grep AWS
```

Скопируйте:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Вариант 2: Из Vercel Dashboard

1. Откройте Vercel Dashboard → CRM проект
2. Settings → Environment Variables
3. Найдите:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
4. Скопируйте значения

### Вариант 3: Создать новые credentials

Если у вас нет ключей или они не работают:

1. Откройте AWS Console: https://console.aws.amazon.com/iam/
2. Users → ваш пользователь → Security credentials
3. Create access key
4. Скопируйте Access Key ID и Secret Access Key

---

## После настройки

Проверьте что credentials работают:

```bash
aws s3 ls
```

Должен показать список ваших S3 buckets (включая `pashkovsky-gallery`).

---

## Затем сделайте файл публичным

После успешной настройки:

```bash
aws s3api put-object-acl \
  --bucket pashkovsky-gallery \
  --key images/dgamim/santa-fe/1.jpg \
  --acl public-read
```

Или для всех файлов в папке:

```bash
aws s3 sync s3://pashkovsky-gallery/images/dgamim/santa-fe/ \
  s3://pashkovsky-gallery/images/dgamim/santa-fe/ \
  --acl public-read
```

---

## Альтернатива: Использовать переменные окружения

Если не хотите сохранять credentials в `~/.aws/credentials`:

```bash
export AWS_ACCESS_KEY_ID="ваш_ключ"
export AWS_SECRET_ACCESS_KEY="ваш_секрет"
export AWS_DEFAULT_REGION="eu-north-1"

aws s3api put-object-acl \
  --bucket pashkovsky-gallery \
  --key images/dgamim/santa-fe/1.jpg \
  --acl public-read
```

Но `aws configure` проще для постоянного использования.

