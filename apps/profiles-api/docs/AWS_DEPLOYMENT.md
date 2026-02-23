# Деплой Profiles API на AWS

Руководство по развёртыванию NestJS Profiles API на AWS App Runner.

## Вариант 1: AWS App Runner (рекомендуется)

App Runner — managed-сервис для контейнеров. Автоматическое масштабирование, HTTPS, минимальная настройка.

### Предварительные требования

- AWS CLI настроен (`aws configure`)
- Docker установлен
- Репозиторий в GitHub (для CI/CD) или ручной деплой

### Шаг 1: Создать ECR репозиторий

```bash
aws ecr create-repository \
  --repository-name pashkovsky-profiles-api \
  --region eu-north-1
```

Сохраните URI репозитория (например: `123456789.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api`).

### Шаг 2: Собрать и запушить образ

```bash
# Из корня монорепо
cd /path/to/pashkovsky-pergolas_starter

# Логин в ECR
aws ecr get-login-password --region eu-north-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.eu-north-1.amazonaws.com

# Сборка (контекст = apps/profiles-api)
docker build -t pashkovsky-profiles-api -f apps/profiles-api/Dockerfile apps/profiles-api

# Тег для ECR
docker tag pashkovsky-profiles-api:latest \
  123456789.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:latest

# Пуш
docker push 123456789.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:latest
```

### Шаг 3: Создать App Runner сервис

**Через консоль AWS:**

1. App Runner → Create service
2. Source: **Container registry** → Amazon ECR
3. Выбрать образ `pashkovsky-profiles-api:latest`
4. Deployment: Manual (или настроить auto-deploy из ECR)
5. Service settings:
   - Service name: `profiles-api`
   - Port: `3002`
   - CPU: 0.25 vCPU, Memory: 0.5 GB (для старта)
6. Environment variables (переменные из `.env`):

   | Key | Value |
   |-----|-------|
   | `SUPABASE_URL` | Ваш Supabase URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
   | `SUPABASE_ANON_KEY` | Anon key |
   | `JWT_SECRET` | Тот же, что в CRM |
   | `PASHKOVSKY_COMPANY_ID` | Ваш company_id |
   | `PORT` | 3002 |
   | `NODE_ENV` | production

   Для S3 (загрузка изображений профилей):

   | Key | Value |
   |-----|-------|
   | `AWS_S3_BUCKET_NAME` | pashkovsky-gallery |
   | `AWS_S3_REGION` | eu-north-1 |
   | `AWS_ACCESS_KEY_ID` | Ваш ключ |
   | `AWS_SECRET_ACCESS_KEY` | Ваш секрет |

7. Create service

После создания App Runner выдаст URL вида: `https://xxxxx.eu-north-1.awsapprunner.com`

### Шаг 4: Обновить Vercel (CRM)

В Vercel → Settings → Environment Variables:

```
PROFILES_API_URL=https://xxxxx.eu-north-1.awsapprunner.com
```

### Шаг 5: CORS

В `main.ts` уже добавлены `https://crm.pashkovsky-group.com` и `https://profiles.pashkovsky-group.com`. Если нужен кастомный домен App Runner — добавьте его в `origin` массив.

---

## Вариант 2: GitHub Actions (CI/CD)

Автоматический деплой при push в main.

Создайте `.github/workflows/deploy-profiles-api.yml`:

```yaml
name: Deploy Profiles API to AWS

on:
  push:
    branches: [main]
    paths:
      - 'apps/profiles-api/**'

env:
  AWS_REGION: eu-north-1
  ECR_REPOSITORY: pashkovsky-profiles-api

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: apps/profiles-api
          file: apps/profiles-api/Dockerfile
          push: true
          images: ${{ steps.ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest

      - name: Deploy to App Runner
        run: |
          aws apprunner start-deployment \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }} \
            --region ${{ env.AWS_REGION }}
```

В GitHub Secrets добавьте: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `APP_RUNNER_SERVICE_ARN`.

---

## Вариант 3: ECS Fargate (больше контроля)

Если нужен больший контроль над инфраструктурой:

1. Создать ECR и пушить образ (как в шаге 1–2)
2. Создать ECS Cluster
3. Создать Task Definition (Fargate, образ из ECR)
4. Создать Service (ALB для HTTPS)
5. Настроить домен через Route 53

Подробнее: [AWS ECS Fargate](https://docs.aws.amazon.com/ecs/latest/developerguide/getting-started-fargate.html)

---

## Проверка

```bash
curl https://YOUR_APP_RUNNER_URL/profiles?company_id=YOUR_COMPANY_ID
```

Должен вернуть JSON (массив профилей или пустой массив).
