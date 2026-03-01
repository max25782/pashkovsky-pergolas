# Дизайн деплоя NestJS приложения на AWS

## Обзор

Данный документ описывает архитектурное решение для развёртывания NestJS API (profiles-api) на AWS с использованием контейнеризации и современных облачных сервисов. Решение учитывает специфику монорепозитория на базе Turbo, интеграцию с существующей инфраструктурой (Vercel CRM, Supabase, S3) и требования к масштабируемости, безопасности и стоимости.

### Цели проекта

- Развернуть Profiles API на AWS с минимальными затратами и максимальной надёжностью
- Обеспечить автоматизацию деплоя через CI/CD pipeline
- Настроить мониторинг и логирование для быстрого выявления проблем
- Обеспечить безопасную интеграцию с Supabase, S3 и Vercel CRM
- Предоставить возможность горизонтального масштабирования при росте нагрузки

### Контекст

**Текущая инфраструктура:**
- CRM (Next.js) развёрнут на Vercel
- База данных PostgreSQL в Supabase с RLS политиками
- Изображения профилей хранятся в S3 bucket (pashkovsky-gallery)
- Монорепозиторий на базе Turbo содержит 4 приложения
- Profiles API работает на порту 3002 локально

**Технический стек:**
- Runtime: Node.js 20
- Framework: NestJS 10
- Database: Supabase (PostgreSQL)
- Storage: AWS S3
- Region: eu-north-1 (Stockholm)

## Архитектура

### Высокоуровневая диаграмма

```mermaid
graph TB
    subgraph "Клиенты"
        CRM[Vercel CRM<br/>Next.js]
        Store[Profiles Store<br/>Next.js]
    end
    
    subgraph "AWS Cloud - eu-north-1"
        subgraph "Compute"
            AppRunner[AWS App Runner<br/>Auto-scaling: 1-5 instances]
        end
        
        subgraph "Container Registry"
            ECR[Amazon ECR<br/>pashkovsky-profiles-api]
        end
        
        subgraph "Security & Config"
            SM[AWS Secrets Manager<br/>Environment Variables]
            IAM[IAM Role<br/>S3 + Secrets Access]
        end
        
        subgraph "Monitoring"
            CW[CloudWatch Logs<br/>30 days retention]
            CWM[CloudWatch Metrics<br/>CPU, Memory, Requests]
            CWD[CloudWatch Dashboard]
            CWA[CloudWatch Alarms<br/>SNS Notifications]
            XRay[AWS X-Ray<br/>Distributed Tracing]
        end
        
        subgraph "Networking"
            R53[Route 53<br/>api.pashkovsky-group.com]
            ACM[AWS Certificate Manager<br/>SSL/TLS Certificate]
        end
    end
    
    subgraph "External Services"
        Supabase[Supabase<br/>PostgreSQL + Auth]
        S3[AWS S3<br/>pashkovsky-gallery]
    end
    
    subgraph "CI/CD"
        GHA[GitHub Actions<br/>Build → Test → Deploy]
    end
    
    CRM -->|HTTPS/JWT| R53
    Store -->|HTTPS/JWT| R53
    R53 -->|SSL Termination| AppRunner
    AppRunner -->|Pull Image| ECR
    AppRunner -->|Get Secrets| SM
    AppRunner -->|Assume Role| IAM
    AppRunner -->|Query Data| Supabase
    AppRunner -->|Upload/Download| S3
    AppRunner -->|Send Logs| CW
    AppRunner -->|Send Metrics| CWM
    AppRunner -->|Send Traces| XRay
    CWM --> CWD
    CWM --> CWA
    GHA -->|Push Image| ECR
    GHA -->|Deploy| AppRunner
    
    style AppRunner fill:#FF9900
    style ECR fill:#FF9900
    style SM fill:#FF9900
    style CW fill:#FF9900
```

### Компоненты системы

#### 1. AWS App Runner (Рекомендуемый вариант)

Полностью управляемый сервис для контейнерных приложений с автоматическим масштабированием, балансировкой нагрузки и HTTPS.

**Преимущества:**
- Минимальная настройка (не требуется VPC, Load Balancer, Auto Scaling Group)
- Автоматическое HTTPS с управляемым сертификатом
- Встроенный автоскейлинг на основе CPU и запросов
- Простая интеграция с ECR
- Оплата только за используемые ресурсы

**Недостатки:**
- Меньше контроля над сетевой конфигурацией
- Ограниченная кастомизация (нельзя использовать custom VPC)

#### 2. Amazon ECR (Elastic Container Registry)

Приватный Docker registry для хранения образов приложения с автоматическим сканированием уязвимостей.

**Функции:**
- Хранение версионированных Docker образов
- Lifecycle policy для автоматического удаления старых образов
- Сканирование на уязвимости при push
- Интеграция с IAM для контроля доступа

#### 3. AWS Secrets Manager

Безопасное хранение чувствительных данных (JWT secrets, API keys, database credentials).

**Преимущества:**
- Автоматическая ротация секретов
- Шифрование at-rest и in-transit
- Аудит доступа через CloudTrail
- Версионирование секретов

#### 4. CloudWatch (Logs, Metrics, Alarms, Dashboard)

Централизованная система мониторинга и логирования.

**Компоненты:**
- **Logs**: Сбор логов приложения с retention 30 дней
- **Metrics**: CPU, Memory, Request Count, Error Rate, Response Time
- **Alarms**: Уведомления при превышении порогов
- **Dashboard**: Визуализация ключевых метрик

#### 5. AWS X-Ray

Distributed tracing для анализа производительности и отладки запросов между сервисами.

#### 6. Route 53 + ACM

DNS управление и SSL/TLS сертификаты для кастомного домена.

## Сравнение вариантов деплоя

### Таблица сравнения

| Критерий | App Runner | ECS Fargate | Lambda | EC2 | Elastic Beanstalk |
|----------|-----------|-------------|--------|-----|-------------------|
| **Стоимость (1000-5000 req/day)** | $15-30/мес | $25-50/мес | $5-15/мес | $30-60/мес | $30-60/мес |
| **Сложность настройки** | Низкая | Средняя | Высокая | Высокая | Средняя |
| **Время до первого деплоя** | 15 мин | 45 мин | 60 мин | 60 мин | 30 мин |
| **Автоскейлинг** | Встроенный | Настраиваемый | Автоматический | Настраиваемый | Настраиваемый |
| **Cold Start** | Нет | Нет | Да (1-3 сек) | Нет | Нет |
| **Управление инфраструктурой** | Полностью управляемый | Частично управляемый | Полностью управляемый | Ручное | Частично управляемый |
| **Поддержка WebSocket** | Да | Да | Ограниченная | Да | Да |
| **Минимальные ресурсы** | 0.25 vCPU, 0.5 GB | 0.25 vCPU, 0.5 GB | 128 MB | t3.micro | t3.micro |
| **Максимальные ресурсы** | 4 vCPU, 12 GB | Без ограничений | 10 GB | Без ограничений | Без ограничений |
| **HTTPS из коробки** | Да | Нет (нужен ALB) | Нет (нужен API Gateway) | Нет | Да |
| **Подходит для монорепо** | Да | Да | Требует адаптации | Да | Да |

### Детальное сравнение

#### 1. AWS App Runner ⭐ (Рекомендуется)

**Описание:** Полностью управляемый сервис для запуска контейнерных приложений.

**Преимущества:**
- Минимальная конфигурация (один файл конфигурации)
- Автоматический HTTPS с управляемым сертификатом
- Встроенный автоскейлинг (CPU и concurrent requests)
- Нет необходимости в VPC, Load Balancer, Auto Scaling Group
- Простая интеграция с ECR
- Автоматические health checks
- Оплата только за активное время работы

**Недостатки:**
- Нельзя использовать custom VPC (ограничение для некоторых корпоративных сценариев)
- Меньше контроля над сетевой конфигурацией
- Нет поддержки Spot Instances для экономии

**Стоимость (примерная для 1000-5000 req/day):**
- Compute: 0.25 vCPU × 1 instance × 730 hours × $0.007/vCPU-hour = $1.28
- Memory: 0.5 GB × 1 instance × 730 hours × $0.0008/GB-hour = $0.29
- Requests: 5000 req/day × 30 days = 150,000 req/month (в пределах Free Tier)
- **Итого: ~$2-5/мес** (с учётом автоскейлинга и пиковых нагрузок)

**Когда использовать:**
- Простые API без сложных сетевых требований
- Быстрый старт проекта
- Ограниченный бюджет
- Не требуется VPC integration

#### 2. ECS Fargate

**Описание:** Serverless compute для контейнеров с полным контролем над сетевой конфигурацией.

**Преимущества:**
- Полный контроль над VPC, Security Groups, Subnets
- Интеграция с Application Load Balancer для advanced routing
- Поддержка Service Discovery
- Spot Instances для экономии до 70%
- Более гибкая конфигурация ресурсов

**Недостатки:**
- Требуется настройка VPC, ALB, Target Groups, Security Groups
- Более сложная конфигурация
- Дороже чем App Runner при малой нагрузке
- Нужно управлять Task Definitions

**Стоимость (примерная):**
- Fargate: 0.25 vCPU × 730 hours × $0.04656/vCPU-hour = $8.50
- Memory: 0.5 GB × 730 hours × $0.00511/GB-hour = $1.87
- ALB: $16.20/мес (фиксированная стоимость)
- **Итого: ~$25-30/мес**

**Когда использовать:**
- Требуется VPC integration (например, RDS в private subnet)
- Нужен advanced routing через ALB
- Требуется Service Mesh (AWS App Mesh)
- Корпоративные требования к сетевой безопасности

#### 3. AWS Lambda

**Описание:** Serverless функции с оплатой за выполнение.

**Преимущества:**
- Самая низкая стоимость при малой нагрузке
- Автоматическое масштабирование до тысяч инстансов
- Нет необходимости управлять серверами
- Оплата только за время выполнения

**Недостатки:**
- Cold start (1-3 секунды для первого запроса)
- Требуется адаптация NestJS приложения (AWS Lambda Adapter)
- Ограничение на размер пакета (250 MB unzipped)
- Ограничение на время выполнения (15 минут)
- Сложнее отладка и мониторинг
- WebSocket поддержка через API Gateway (дополнительная сложность)

**Стоимость (примерная):**
- Invocations: 150,000 req/month × $0.20 per 1M requests = $0.03
- Compute: 150,000 × 200ms × 512MB × $0.0000166667 = $0.50
- API Gateway: 150,000 requests × $0.0000035 = $0.53
- **Итого: ~$1-2/мес**

**Когда использовать:**
- Очень низкая нагрузка (< 1000 req/day)
- Спорадические запросы
- Бюджет критичен
- Cold start приемлем

#### 4. EC2

**Описание:** Виртуальные серверы с полным контролем.

**Преимущества:**
- Полный контроль над ОС и конфигурацией
- Можно использовать Reserved Instances для экономии
- Подходит для долгосрочных workloads
- Нет ограничений на ресурсы

**Недостатки:**
- Требуется управление ОС (патчи, обновления)
- Нужно настраивать Auto Scaling Group, Load Balancer
- Оплата за весь месяц даже при низкой нагрузке
- Высокая сложность настройки

**Стоимость (примерная):**
- t3.micro: $0.0104/hour × 730 hours = $7.59
- ALB: $16.20/мес
- EBS: 20 GB × $0.10/GB = $2.00
- **Итого: ~$25-30/мес**

**Когда использовать:**
- Требуется полный контроль над ОС
- Специфические требования к производительности
- Долгосрочный проект (можно купить Reserved Instances)

#### 5. Elastic Beanstalk

**Описание:** Platform-as-a-Service для быстрого деплоя приложений.

**Преимущества:**
- Автоматическая настройка Load Balancer, Auto Scaling
- Поддержка Docker, Node.js из коробки
- Встроенный мониторинг
- Простой rollback

**Недостатки:**
- Абстракция может скрывать проблемы
- Меньше контроля чем ECS
- Дороже чем App Runner
- Устаревающая технология (AWS фокусируется на App Runner и ECS)

**Стоимость:** Аналогична EC2 + ALB (~$25-30/мес)

**Когда использовать:**
- Быстрый старт без глубоких знаний AWS
- Нужен баланс между простотой и контролем
- Уже используется в организации

### Рекомендация

**Для данного проекта рекомендуется AWS App Runner** по следующим причинам:

1. **Минимальная стоимость**: $2-5/мес при текущей нагрузке
2. **Простота настройки**: Деплой за 15 минут без сложной конфигурации
3. **Автоматический HTTPS**: Не нужно настраивать ALB и ACM вручную
4. **Встроенный автоскейлинг**: Автоматически масштабируется при росте нагрузки
5. **Подходит для монорепо**: Работает с существующим Dockerfile
6. **WebSocket поддержка**: Profiles API использует Socket.IO
7. **Нет cold start**: В отличие от Lambda

**Альтернатива:** ECS Fargate - если в будущем потребуется VPC integration или более сложная сетевая конфигурация.

## Компоненты и интерфейсы

### 1. Docker контейнер

**Dockerfile (существующий):**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig*.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3002
CMD ["node", "dist/main.js"]
```

**Оптимизации:**
- Multi-stage build для минимизации размера образа
- Alpine Linux для минимального footprint
- Только production зависимости в финальном образе
- Ожидаемый размер: ~150-180 MB (сжатый)

**.dockerignore:**
```
node_modules
.git
.env
.env.local
dist
coverage
*.md
.turbo
.next
```

### 2. Environment Variables

**Обязательные переменные (хранятся в AWS Secrets Manager):**

| Переменная | Описание | Пример значения |
|-----------|----------|----------------|
| `NODE_ENV` | Окружение | `production` |
| `PORT` | Порт приложения | `3002` |
| `SUPABASE_URL` | URL Supabase проекта | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Публичный ключ Supabase | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Сервисный ключ Supabase (чувствительный) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `JWT_SECRET` | Секрет для валидации JWT (должен совпадать с CRM) | `your-secret-key-min-32-chars` |
| `AWS_REGION` | AWS регион | `eu-north-1` |
| `AWS_S3_BUCKET` | S3 bucket для изображений | `pashkovsky-gallery` |
| `AWS_ACCESS_KEY_ID` | AWS Access Key (или IAM Role) | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key (или IAM Role) | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `PASHKOVSKY_COMPANY_ID` | ID компании Pashkovsky для feature flag | `uuid` |
| `CORS_ORIGINS` | Разрешённые origins для CORS | `https://crm.pashkovsky-group.com,https://profiles.pashkovsky-group.com` |

**Примечание:** При использовании IAM Role для App Runner, `AWS_ACCESS_KEY_ID` и `AWS_SECRET_ACCESS_KEY` не требуются.

### 3. Health Check эндпоинт

**Путь:** `GET /health`

**Ответ при успехе (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "dependencies": {
    "supabase": "ok",
    "s3": "ok"
  }
}
```

**Ответ при ошибке (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "dependencies": {
    "supabase": "error",
    "s3": "ok"
  },
  "errors": {
    "supabase": "Connection timeout"
  }
}
```

**Требования:**
- Время выполнения: < 3 секунды
- Проверяет подключение к Supabase (простой SELECT 1)
- Проверяет доступность S3 (HEAD request к bucket)
- Не требует аутентификации

### 4. API эндпоинты

**Базовый URL:** `https://api.pashkovsky-group.com` (после настройки кастомного домена)

**Аутентификация:** JWT токен в заголовке `Authorization: Bearer <token>`

**Основные эндпоинты:**
- `GET /profiles` - Список профилей
- `GET /profiles/:id` - Детали профиля
- `POST /profiles` - Создание профиля
- `PATCH /profiles/:id` - Обновление профиля
- `DELETE /profiles/:id` - Удаление профиля
- `POST /profiles/:id/images` - Загрузка изображения
- `WebSocket /socket.io` - Real-time обновления

**CORS конфигурация:**
```typescript
app.enableCors({
  origin: [
    "https://crm.pashkovsky-group.com",
    "https://profiles.pashkovsky-group.com",
  ],
  credentials: true,
});
```

## Модели данных

### AWS App Runner Service Configuration

```json
{
  "ServiceName": "pashkovsky-profiles-api",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "<account-id>.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3002",
        "RuntimeEnvironmentSecrets": {
          "SUPABASE_URL": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/supabase-url",
          "SUPABASE_ANON_KEY": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/supabase-anon-key",
          "SUPABASE_SERVICE_ROLE_KEY": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/supabase-service-role-key",
          "JWT_SECRET": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/jwt-secret"
        },
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3002",
          "AWS_REGION": "eu-north-1",
          "AWS_S3_BUCKET": "pashkovsky-gallery"
        }
      }
    },
    "AutoDeploymentsEnabled": true
  },
  "InstanceConfiguration": {
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB",
    "InstanceRoleArn": "arn:aws:iam::<account-id>:role/ProfilesApiInstanceRole"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 30,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 3
  },
  "AutoScalingConfigurationArn": "arn:aws:apprunner:eu-north-1:<account-id>:autoscalingconfiguration/ProfilesApiAutoScaling"
}
```

### Auto Scaling Configuration

```json
{
  "AutoScalingConfigurationName": "ProfilesApiAutoScaling",
  "MaxConcurrency": 100,
  "MinSize": 1,
  "MaxSize": 5
}
```

### IAM Role Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::pashkovsky-gallery/profiles/*",
        "arn:aws:s3:::pashkovsky-gallery"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/*"
      ]
    }
  ]
}
```

### ECR Lifecycle Policy

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

## Correctness Properties

*Свойство (property) - это характеристика или поведение, которое должно выполняться для всех валидных выполнений системы - по сути, формальное утверждение о том, что система должна делать. Свойства служат мостом между человекочитаемыми спецификациями и машинно-проверяемыми гарантиями корректности.*

### Property 1: Docker образ имеет приемлемый размер

*Для любого* собранного Docker образа profiles-api, размер сжатого образа должен быть не более 200MB.

**Validates: Requirements 2.7**

### Property 2: Environment variables валидируются при старте

*Для любого* запуска приложения без обязательных environment variables (SUPABASE_URL, JWT_SECRET, AWS_S3_BUCKET), приложение должно логировать ошибку и завершиться с ненулевым exit code.

**Validates: Requirements 3.6, 3.7**

### Property 3: Теги Docker образов следуют семантическому версионированию

*Для любого* Docker образа, опубликованного в ECR, теги должны соответствовать формату семантического версионирования (v1.0.0, latest, commit-sha).

**Validates: Requirements 4.6**

### Property 4: CORS разрешает только доверенные домены

*Для любого* HTTP запроса с Origin заголовком, не входящим в список разрешённых доменов, сервер должен вернуть ответ без Access-Control-Allow-Origin заголовка или с ошибкой CORS.

**Validates: Requirements 6.2**

### Property 5: Неавторизованные запросы возвращают 401

*Для любого* защищённого эндпоинта, запрос без валидного JWT токена должен вернуть HTTP 401 Unauthorized.

**Validates: Requirements 6.7**

### Property 6: HTTP автоматически перенаправляется на HTTPS

*Для любого* HTTP запроса к кастомному домену, сервер должен вернуть HTTP 301 или 302 редирект на HTTPS версию того же URL.

**Validates: Requirements 7.4**

### Property 7: HTTP запросы логируются с полной информацией

*Для любого* HTTP запроса к API, в логах должна присутствовать запись содержащая: timestamp, method, path, status code, response time, user_id (если аутентифицирован).

**Validates: Requirements 9.3**

### Property 8: Ошибки логируются с stack trace

*Для любой* необработанной ошибки в приложении, в логах должна присутствовать запись содержащая полный stack trace.

**Validates: Requirements 9.4**

### Property 9: JWT токены валидируются корректно

*Для любого* запроса с JWT токеном, приложение должно валидировать токен используя тот же JWT_SECRET что и CRM, и извлекать user_id и company_id из payload.

**Validates: Requirements 10.8**

### Property 10: Данные изолированы по компаниям

*Для любого* запроса к эндпоинтам профилей, возвращаемые данные должны принадлежать только той компании, к которой принадлежит аутентифицированный пользователь.

**Validates: Requirements 10.9**

### Property 11: Неавторизованные компании получают 403

*Для любого* пользователя, не принадлежащего к Pashkovsky компании (company_id != PASHKOVSKY_COMPANY_ID), запрос к эндпоинтам профилей должен вернуть HTTP 403 Forbidden.

**Validates: Requirements 10.10**

### Property 12: Health check возвращает корректный статус при успехе

*Для любого* вызова GET /health когда все зависимости (Supabase, S3) доступны, ответ должен иметь HTTP 200 OK и JSON с полями: status="healthy", timestamp, dependencies.supabase="ok", dependencies.s3="ok".

**Validates: Requirements 11.4**

### Property 13: Health check возвращает 503 при недоступности зависимостей

*Для любого* вызова GET /health когда хотя бы одна зависимость (Supabase или S3) недоступна, ответ должен иметь HTTP 503 Service Unavailable и JSON с полем status="unhealthy".

**Validates: Requirements 11.5, 11.6**

### Property 14: Health check выполняется быстро

*Для любого* вызова GET /health, время выполнения должно быть не более 3 секунд.

**Validates: Requirements 11.7**

### Property 15: Статические данные кэшируются

*Для любого* запроса к эндпоинту списка профилей, при повторном запросе в течение 5 минут, данные должны возвращаться из кэша без обращения к базе данных.

**Validates: Requirements 12.7**

### Property 16: API обрабатывает достаточную нагрузку

*Для любого* одного инстанса приложения, он должен успешно обрабатывать минимум 100 запросов в секунду без ошибок.

**Validates: Requirements 12.8**

### Property 17: GET запросы имеют приемлемое время ответа

*Для любого* GET запроса к API, 95-й перцентиль времени ответа (p95) должен быть не более 500ms.

**Validates: Requirements 12.9**

### Property 18: POST/PATCH запросы имеют приемлемое время ответа

*Для любого* POST или PATCH запроса с загрузкой изображения, 95-й перцентиль времени ответа (p95) должен быть не более 1000ms.

**Validates: Requirements 12.10**

## Обработка ошибок

### Стратегия обработки ошибок

1. **Валидация входных данных**
   - Использование class-validator для DTO валидации
   - Автоматический возврат 400 Bad Request при невалидных данных
   - Детальные сообщения об ошибках валидации

2. **Аутентификация и авторизация**
   - 401 Unauthorized при отсутствии или невалидном JWT токене
   - 403 Forbidden при попытке доступа к ресурсам другой компании
   - Логирование всех попыток неавторизованного доступа

3. **Ошибки внешних сервисов**
   - Retry логика для временных сбоев Supabase (3 попытки с exponential backoff)
   - Retry логика для S3 (встроенная в AWS SDK)
   - Circuit breaker для предотвращения каскадных сбоев
   - Graceful degradation (возврат кэшированных данных при недоступности БД)

4. **Внутренние ошибки**
   - Глобальный exception filter для перехвата необработанных ошибок
   - Логирование полного stack trace в CloudWatch
   - Возврат 500 Internal Server Error с generic сообщением (без раскрытия деталей)
   - Отправка алертов в SNS при критических ошибках

5. **Health Check ошибки**
   - Timeout для проверок зависимостей (2 секунды на каждую)
   - Возврат 503 Service Unavailable при недоступности критических зависимостей
   - Детальная информация о статусе каждой зависимости в ответе

### Коды ошибок

| HTTP Code | Сценарий | Пример |
|-----------|----------|--------|
| 400 | Невалидные входные данные | Отсутствует обязательное поле в DTO |
| 401 | Отсутствует или невалидный JWT токен | Authorization header отсутствует |
| 403 | Доступ запрещён | Пользователь пытается получить профили другой компании |
| 404 | Ресурс не найден | Профиль с указанным ID не существует |
| 409 | Конфликт | Попытка создать профиль с уже существующим артикулом |
| 413 | Слишком большой файл | Изображение превышает 10MB |
| 429 | Слишком много запросов | Rate limit превышен |
| 500 | Внутренняя ошибка сервера | Необработанное исключение |
| 503 | Сервис недоступен | Supabase или S3 недоступны |

### Логирование ошибок

**Формат лога ошибки:**
```json
{
  "level": "error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Failed to fetch profile",
  "context": {
    "profileId": "uuid",
    "userId": "uuid",
    "companyId": "uuid"
  },
  "error": {
    "name": "SupabaseError",
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at SupabaseClient.query..."
  },
  "request": {
    "method": "GET",
    "path": "/profiles/uuid",
    "ip": "1.2.3.4",
    "userAgent": "Mozilla/5.0..."
  }
}
```

## Стратегия тестирования

### Dual Testing Approach

Проект использует комбинацию unit тестов и property-based тестов для обеспечения максимального покрытия:

- **Unit тесты**: Проверяют конкретные примеры, edge cases и интеграционные точки
- **Property-based тесты**: Проверяют универсальные свойства на большом количестве сгенерированных входных данных

### Unit Testing

**Фреймворк:** Jest

**Покрытие:**
- Controllers: Тестирование HTTP эндпоинтов с mock сервисами
- Services: Бизнес-логика с mock репозиториев
- Guards: Аутентификация и авторизация
- Pipes: Валидация и трансформация данных
- Filters: Обработка исключений

**Примеры unit тестов:**
```typescript
describe('ProfilesController', () => {
  it('should return 401 when JWT token is missing', async () => {
    const response = await request(app.getHttpServer())
      .get('/profiles')
      .expect(401);
  });

  it('should return profiles for authenticated user', async () => {
    const token = generateValidToken({ userId: 'uuid', companyId: 'uuid' });
    const response = await request(app.getHttpServer())
      .get('/profiles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(response.body).toBeInstanceOf(Array);
  });
});
```

### Property-Based Testing

**Библиотека:** fast-check (для TypeScript/JavaScript)

**Конфигурация:**
- Минимум 100 итераций на каждый property тест
- Seed для воспроизводимости тестов
- Shrinking для минимизации failing examples

**Примеры property тестов:**

```typescript
import * as fc from 'fast-check';

describe('Property Tests', () => {
  /**
   * Feature: nestjs-aws-deployment, Property 2: Environment variables валидируются при старте
   */
  it('should fail to start without required environment variables', () => {
    fc.assert(
      fc.property(
        fc.record({
          SUPABASE_URL: fc.option(fc.string(), { nil: undefined }),
          JWT_SECRET: fc.option(fc.string(), { nil: undefined }),
          AWS_S3_BUCKET: fc.option(fc.string(), { nil: undefined }),
        }),
        async (env) => {
          // Если хотя бы одна обязательная переменная отсутствует
          const hasAllRequired = env.SUPABASE_URL && env.JWT_SECRET && env.AWS_S3_BUCKET;
          
          if (!hasAllRequired) {
            // Приложение должно упасть при старте
            await expect(bootstrapApp(env)).rejects.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: nestjs-aws-deployment, Property 4: CORS разрешает только доверенные домены
   */
  it('should reject requests from untrusted origins', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // Генерирует случайные URL
        async (origin) => {
          const trustedOrigins = [
            'https://crm.pashkovsky-group.com',
            'https://profiles.pashkovsky-group.com',
          ];
          
          const response = await request(app.getHttpServer())
            .get('/profiles')
            .set('Origin', origin)
            .set('Authorization', `Bearer ${validToken}`);
          
          if (!trustedOrigins.includes(origin)) {
            // Для недоверенных origins не должно быть CORS заголовка
            expect(response.headers['access-control-allow-origin']).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: nestjs-aws-deployment, Property 10: Данные изолированы по компаниям
   */
  it('should return only profiles belonging to user company', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // company_id
        fc.uuid(), // user_id
        async (companyId, userId) => {
          const token = generateValidToken({ userId, companyId });
          
          const response = await request(app.getHttpServer())
            .get('/profiles')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          
          // Все возвращённые профили должны принадлежать компании пользователя
          const profiles = response.body;
          expect(profiles.every(p => p.companyId === companyId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: nestjs-aws-deployment, Property 14: Health check выполняется быстро
   */
  it('should complete health check within 3 seconds', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // Не нужны входные данные
        async () => {
          const startTime = Date.now();
          
          await request(app.getHttpServer())
            .get('/health');
          
          const duration = Date.now() - startTime;
          expect(duration).toBeLessThan(3000);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Цель:** Проверить взаимодействие с реальными внешними сервисами (Supabase, S3).

**Подход:**
- Использование тестовой базы данных Supabase
- Использование отдельного S3 bucket для тестов
- Запуск в CI/CD pipeline перед деплоем

**Примеры:**
```typescript
describe('Integration Tests', () => {
  it('should upload image to S3 and save metadata to Supabase', async () => {
    const file = createTestImageFile();
    const token = generateValidToken({ userId: testUserId, companyId: testCompanyId });
    
    const response = await request(app.getHttpServer())
      .post('/profiles/test-profile-id/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', file)
      .expect(201);
    
    // Проверяем что файл загружен в S3
    const s3Object = await s3Client.headObject({
      Bucket: 'pashkovsky-gallery-test',
      Key: response.body.imageKey,
    });
    expect(s3Object).toBeDefined();
    
    // Проверяем что метаданные сохранены в Supabase
    const { data } = await supabase
      .from('profile_images')
      .select('*')
      .eq('id', response.body.id)
      .single();
    expect(data).toBeDefined();
  });
});
```

### Performance Testing

**Инструменты:** Artillery, k6

**Сценарии:**
- Load test: 100 req/s в течение 5 минут
- Stress test: Постепенное увеличение нагрузки до 500 req/s
- Spike test: Резкий скачок с 10 до 200 req/s

**Метрики:**
- Response time (p50, p95, p99)
- Error rate
- Throughput (req/s)
- Resource utilization (CPU, Memory)

### E2E Testing

**Инструменты:** Playwright (для тестирования интеграции с CRM)

**Сценарии:**
- Создание профиля через CRM → проверка в Profiles API
- Загрузка изображения → проверка отображения в CRM
- Обновление профиля → проверка real-time обновления через WebSocket

## Детальный дизайн для AWS App Runner

### Шаг 1: Создание ECR репозитория

**AWS CLI команды:**
```bash
# Создание ECR репозитория
aws ecr create-repository \
  --repository-name pashkovsky-profiles-api \
  --region eu-north-1 \
  --image-scanning-configuration scanOnPush=true

# Настройка lifecycle policy
aws ecr put-lifecycle-policy \
  --repository-name pashkovsky-profiles-api \
  --region eu-north-1 \
  --lifecycle-policy-text file://ecr-lifecycle-policy.json
```

**ecr-lifecycle-policy.json:**
```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

### Шаг 2: Создание секретов в AWS Secrets Manager

**AWS CLI команды:**
```bash
# Создание секретов
aws secretsmanager create-secret \
  --name profiles-api/supabase-url \
  --secret-string "https://xxx.supabase.co" \
  --region eu-north-1

aws secretsmanager create-secret \
  --name profiles-api/supabase-anon-key \
  --secret-string "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --region eu-north-1

aws secretsmanager create-secret \
  --name profiles-api/supabase-service-role-key \
  --secret-string "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --region eu-north-1

aws secretsmanager create-secret \
  --name profiles-api/jwt-secret \
  --secret-string "your-secret-key-min-32-chars" \
  --region eu-north-1

aws secretsmanager create-secret \
  --name profiles-api/pashkovsky-company-id \
  --secret-string "uuid" \
  --region eu-north-1
```

### Шаг 3: Создание IAM роли для App Runner

**IAM Policy (profiles-api-instance-policy.json):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::pashkovsky-gallery/profiles/*",
        "arn:aws:s3:::pashkovsky-gallery"
      ]
    },
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:eu-north-1:*:secret:profiles-api/*"
      ]
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:eu-north-1:*:log-group:/aws/apprunner/*"
    },
    {
      "Sid": "XRayAccess",
      "Effect": "Allow",
      "Action": [
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords"
      ],
      "Resource": "*"
    }
  ]
}
```

**AWS CLI команды:**
```bash
# Создание IAM роли
aws iam create-role \
  --role-name ProfilesApiInstanceRole \
  --assume-role-policy-document file://trust-policy.json

# Прикрепление политики
aws iam put-role-policy \
  --role-name ProfilesApiInstanceRole \
  --policy-name ProfilesApiInstancePolicy \
  --policy-document file://profiles-api-instance-policy.json
```

**trust-policy.json:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "tasks.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### Шаг 4: Локальная сборка и публикация Docker образа

**Команды:**
```bash
# Переход в директорию profiles-api
cd apps/profiles-api

# Аутентификация в ECR
aws ecr get-login-password --region eu-north-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-north-1.amazonaws.com

# Сборка образа
docker build -t pashkovsky-profiles-api:latest .

# Тегирование образа
docker tag pashkovsky-profiles-api:latest \
  <account-id>.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:latest

docker tag pashkovsky-profiles-api:latest \
  <account-id>.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:v1.0.0

# Публикация образа
docker push <account-id>.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:latest
docker push <account-id>.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:v1.0.0
```

### Шаг 5: Создание Auto Scaling конфигурации

**AWS CLI команда:**
```bash
aws apprunner create-auto-scaling-configuration \
  --auto-scaling-configuration-name ProfilesApiAutoScaling \
  --max-concurrency 100 \
  --min-size 1 \
  --max-size 5 \
  --region eu-north-1
```

**Параметры:**
- `max-concurrency`: Максимальное количество одновременных запросов на один инстанс (100)
- `min-size`: Минимальное количество инстансов (1)
- `max-size`: Максимальное количество инстансов (5)

**Логика автоскейлинга:**
- Когда concurrent requests > 70 (70% от max-concurrency), запускается новый инстанс
- Когда concurrent requests < 30 в течение 5 минут, останавливается лишний инстанс
- Масштабирование происходит автоматически без простоя

### Шаг 6: Создание App Runner сервиса

**apprunner-service.json:**
```json
{
  "ServiceName": "pashkovsky-profiles-api",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "<account-id>.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "3002",
        "RuntimeEnvironmentSecrets": {
          "SUPABASE_URL": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/supabase-url",
          "SUPABASE_ANON_KEY": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/supabase-anon-key",
          "SUPABASE_SERVICE_ROLE_KEY": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/supabase-service-role-key",
          "JWT_SECRET": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/jwt-secret",
          "PASHKOVSKY_COMPANY_ID": "arn:aws:secretsmanager:eu-north-1:<account-id>:secret:profiles-api/pashkovsky-company-id"
        },
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3002",
          "AWS_REGION": "eu-north-1",
          "AWS_S3_BUCKET": "pashkovsky-gallery"
        }
      }
    },
    "AutoDeploymentsEnabled": true
  },
  "InstanceConfiguration": {
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB",
    "InstanceRoleArn": "arn:aws:iam::<account-id>:role/ProfilesApiInstanceRole"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 30,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 3
  },
  "AutoScalingConfigurationArn": "arn:aws:apprunner:eu-north-1:<account-id>:autoscalingconfiguration/ProfilesApiAutoScaling/1/00000000000000000000000000000001"
}
```

**AWS CLI команда:**
```bash
aws apprunner create-service \
  --cli-input-json file://apprunner-service.json \
  --region eu-north-1
```

**Получение URL сервиса:**
```bash
aws apprunner describe-service \
  --service-arn <service-arn> \
  --region eu-north-1 \
  --query 'Service.ServiceUrl' \
  --output text
```

### Шаг 7: Настройка кастомного домена (опционально)

**Создание SSL сертификата в ACM:**
```bash
aws acm request-certificate \
  --domain-name api.pashkovsky-group.com \
  --validation-method DNS \
  --region eu-north-1
```

**Валидация сертификата:**
1. Получить CNAME записи для валидации:
```bash
aws acm describe-certificate \
  --certificate-arn <cert-arn> \
  --region eu-north-1
```

2. Добавить CNAME записи в Route 53 или DNS провайдер

**Привязка кастомного домена к App Runner:**
```bash
aws apprunner associate-custom-domain \
  --service-arn <service-arn> \
  --domain-name api.pashkovsky-group.com \
  --region eu-north-1
```

**Создание DNS записи в Route 53:**
```bash
# Получить validation records от App Runner
aws apprunner describe-custom-domains \
  --service-arn <service-arn> \
  --region eu-north-1

# Создать CNAME запись в Route 53
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch file://route53-change.json
```

**route53-change.json:**
```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.pashkovsky-group.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "<apprunner-domain>.awsapprunner.com"
          }
        ]
      }
    }
  ]
}
```

### Шаг 8: Настройка CloudWatch мониторинга

**Создание CloudWatch Dashboard:**
```bash
aws cloudwatch put-dashboard \
  --dashboard-name ProfilesApiDashboard \
  --dashboard-body file://dashboard.json \
  --region eu-north-1
```

**dashboard.json:**
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/AppRunner", "RequestCount", {"stat": "Sum"}],
          [".", "2xxStatusResponses", {"stat": "Sum"}],
          [".", "4xxStatusResponses", {"stat": "Sum"}],
          [".", "5xxStatusResponses", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "eu-north-1",
        "title": "HTTP Requests"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/AppRunner", "RequestLatency", {"stat": "Average"}],
          ["...", {"stat": "p95"}],
          ["...", {"stat": "p99"}]
        ],
        "period": 300,
        "region": "eu-north-1",
        "title": "Response Time"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/AppRunner", "CPUUtilization", {"stat": "Average"}],
          [".", "MemoryUtilization", {"stat": "Average"}]
        ],
        "period": 300,
        "region": "eu-north-1",
        "title": "Resource Utilization"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/AppRunner", "ActiveInstances", {"stat": "Average"}]
        ],
        "period": 300,
        "region": "eu-north-1",
        "title": "Active Instances"
      }
    }
  ]
}
```

**Создание CloudWatch Alarms:**
```bash
# Alarm для высокого error rate
aws cloudwatch put-metric-alarm \
  --alarm-name ProfilesApi-HighErrorRate \
  --alarm-description "Error rate > 5%" \
  --metric-name 5xxStatusResponses \
  --namespace AWS/AppRunner \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --region eu-north-1

# Alarm для высокого response time
aws cloudwatch put-metric-alarm \
  --alarm-name ProfilesApi-HighLatency \
  --alarm-description "Response time p95 > 2000ms" \
  --metric-name RequestLatency \
  --namespace AWS/AppRunner \
  --statistic p95 \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 2000 \
  --comparison-operator GreaterThanThreshold \
  --region eu-north-1

# Alarm для высокого memory usage
aws cloudwatch put-metric-alarm \
  --alarm-name ProfilesApi-HighMemory \
  --alarm-description "Memory usage > 80%" \
  --metric-name MemoryUtilization \
  --namespace AWS/AppRunner \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --region eu-north-1
```

**Создание SNS topic для уведомлений:**
```bash
# Создание SNS topic
aws sns create-topic \
  --name ProfilesApiAlerts \
  --region eu-north-1

# Подписка на email уведомления
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-north-1:<account-id>:ProfilesApiAlerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region eu-north-1

# Привязка alarms к SNS topic
aws cloudwatch put-metric-alarm \
  --alarm-name ProfilesApi-HighErrorRate \
  --alarm-actions arn:aws:sns:eu-north-1:<account-id>:ProfilesApiAlerts \
  ... (остальные параметры)
```

### Шаг 9: Настройка AWS X-Ray (опционально)

**Включение X-Ray в App Runner:**
```bash
aws apprunner update-service \
  --service-arn <service-arn> \
  --observability-configuration '{"XRayEnabled": true}' \
  --region eu-north-1
```

**Интеграция X-Ray в NestJS приложение:**
```typescript
// src/main.ts
import * as AWSXRay from 'aws-xray-sdk-core';
import * as AWS from 'aws-sdk';

// Wrap AWS SDK
AWSXRay.captureAWS(AWS);

// Wrap HTTP requests
AWSXRay.captureHTTPsGlobal(require('http'));
AWSXRay.captureHTTPsGlobal(require('https'));

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // X-Ray middleware
  app.use(AWSXRay.express.openSegment('ProfilesAPI'));
  
  // ... остальная конфигурация
  
  app.use(AWSXRay.express.closeSegment());
  
  await app.listen(3002);
}
```

## CI/CD Pipeline

### GitHub Actions Workflow

**Файл:** `.github/workflows/deploy-profiles-api.yml`

```yaml
name: Deploy Profiles API to AWS App Runner

on:
  push:
    branches:
      - main
    paths:
      - 'apps/profiles-api/**'
      - '.github/workflows/deploy-profiles-api.yml'

env:
  AWS_REGION: eu-north-1
  ECR_REPOSITORY: pashkovsky-profiles-api
  APP_RUNNER_SERVICE: pashkovsky-profiles-api

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd apps/profiles-api
          npm ci
      
      - name: Run unit tests
        run: |
          cd apps/profiles-api
          npm run test
      
      - name: Run integration tests
        run: |
          cd apps/profiles-api
          npm run test:e2e
        env:
          SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
          AWS_S3_BUCKET: ${{ secrets.TEST_S3_BUCKET }}
```

  build-and-deploy:
    name: Build and Deploy
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd apps/profiles-api
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT
      
      - name: Deploy to App Runner
        id: deploy-apprunner
        run: |
          aws apprunner update-service \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }} \
            --source-configuration "ImageRepository={ImageIdentifier=${{ steps.build-image.outputs.image }},ImageRepositoryType=ECR}" \
            --region ${{ env.AWS_REGION }}
          
          echo "Waiting for deployment to complete..."
          aws apprunner wait service-updated \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }} \
            --region ${{ env.AWS_REGION }}
      
      - name: Get service URL
        id: get-url
        run: |
          SERVICE_URL=$(aws apprunner describe-service \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }} \
            --region ${{ env.AWS_REGION }} \
            --query 'Service.ServiceUrl' \
            --output text)
          echo "url=https://$SERVICE_URL" >> $GITHUB_OUTPUT
      
      - name: Health check
        run: |
          echo "Waiting 30 seconds for service to stabilize..."
          sleep 30
          
          HEALTH_URL="${{ steps.get-url.outputs.url }}/health"
          echo "Checking health at $HEALTH_URL"
          
          RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
          
          if [ $RESPONSE -eq 200 ]; then
            echo "✅ Health check passed"
          else
            echo "❌ Health check failed with status $RESPONSE"
            exit 1
          fi
      
      - name: Rollback on failure
        if: failure()
        run: |
          echo "Deployment failed, rolling back..."
          
          # Получаем предыдущую версию образа
          PREVIOUS_IMAGE=$(aws apprunner list-operations \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }} \
            --region ${{ env.AWS_REGION }} \
            --query 'OperationSummaryList[1].TargetArn' \
            --output text)
          
          # Откатываемся к предыдущей версии
          aws apprunner update-service \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }} \
            --source-configuration "ImageRepository={ImageIdentifier=$PREVIOUS_IMAGE,ImageRepositoryType=ECR}" \
            --region ${{ env.AWS_REGION }}
      
      - name: Send Slack notification
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          payload: |
            {
              "text": "Profiles API Deployment ${{ job.status }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Profiles API Deployment*\nStatus: ${{ job.status }}\nCommit: ${{ github.sha }}\nURL: ${{ steps.get-url.outputs.url }}"
                  }
                }
              ]
            }
```

### Этапы CI/CD Pipeline

1. **Test** (5-10 минут)
   - Установка зависимостей
   - Запуск unit тестов
   - Запуск integration тестов
   - Если тесты падают → остановка pipeline

2. **Build** (3-5 минут)
   - Сборка Docker образа
   - Тегирование образа (commit SHA + latest)
   - Push в ECR
   - Сканирование на уязвимости

3. **Deploy** (2-3 минуты)
   - Обновление App Runner сервиса новым образом
   - Ожидание завершения деплоя
   - App Runner автоматически выполняет rolling update

4. **Health Check** (30 секунд)
   - Ожидание стабилизации сервиса
   - Проверка /health эндпоинта
   - Если health check падает → rollback

5. **Rollback** (при ошибке)
   - Автоматический откат к предыдущей версии образа
   - Уведомление команды

6. **Notification**
   - Отправка уведомления в Slack/Email
   - Статус деплоя (success/failure)
   - Ссылка на сервис

### Rollback стратегия

**Автоматический rollback:**
- Триггер: Health check падает после деплоя
- Действие: Откат к предыдущей версии образа в ECR
- Время: ~2-3 минуты

**Ручной rollback:**
```bash
# Получить список предыдущих версий
aws apprunner list-operations \
  --service-arn <service-arn> \
  --region eu-north-1

# Откатиться к конкретной версии
aws apprunner update-service \
  --service-arn <service-arn> \
  --source-configuration "ImageRepository={ImageIdentifier=<account-id>.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:v1.0.0,ImageRepositoryType=ECR}" \
  --region eu-north-1
```

## Использование AWS MCP серверов

### AWS CDK MCP Server

**Описание:** MCP сервер для создания инфраструктуры через AWS CDK (Infrastructure as Code).

**Установка:**
```bash
# Установка AWS CDK CLI
npm install -g aws-cdk

# Инициализация CDK проекта
mkdir profiles-api-infra
cd profiles-api-infra
cdk init app --language typescript
```

**CDK Stack для Profiles API:**

**lib/profiles-api-stack.ts:**
```typescript
import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export class ProfilesApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECR Repository
    const repository = new ecr.Repository(this, 'ProfilesApiRepository', {
      repositoryName: 'pashkovsky-profiles-api',
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep last 10 images',
        },
      ],
    });

    // Secrets Manager
    const supabaseUrl = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SupabaseUrl',
      'profiles-api/supabase-url'
    );
    const supabaseAnonKey = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SupabaseAnonKey',
      'profiles-api/supabase-anon-key'
    );
    const supabaseServiceRoleKey = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SupabaseServiceRoleKey',
      'profiles-api/supabase-service-role-key'
    );
    const jwtSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'JwtSecret',
      'profiles-api/jwt-secret'
    );

    // IAM Role for App Runner
    const instanceRole = new iam.Role(this, 'ProfilesApiInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    });

    // Grant S3 access
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
        resources: [
          'arn:aws:s3:::pashkovsky-gallery/profiles/*',
          'arn:aws:s3:::pashkovsky-gallery',
        ],
      })
    );

    // Grant Secrets Manager access
    supabaseUrl.grantRead(instanceRole);
    supabaseAnonKey.grantRead(instanceRole);
    supabaseServiceRoleKey.grantRead(instanceRole);
    jwtSecret.grantRead(instanceRole);

    // App Runner Service
    const service = new apprunner.Service(this, 'ProfilesApiService', {
      serviceName: 'pashkovsky-profiles-api',
      source: apprunner.Source.fromEcr({
        repository: repository,
        tagOrDigest: 'latest',
        imageConfiguration: {
          port: 3002,
          environmentSecrets: {
            SUPABASE_URL: apprunner.Secret.fromSecretsManager(supabaseUrl),
            SUPABASE_ANON_KEY: apprunner.Secret.fromSecretsManager(supabaseAnonKey),
            SUPABASE_SERVICE_ROLE_KEY: apprunner.Secret.fromSecretsManager(supabaseServiceRoleKey),
            JWT_SECRET: apprunner.Secret.fromSecretsManager(jwtSecret),
          },
          environmentVariables: {
            NODE_ENV: 'production',
            PORT: '3002',
            AWS_REGION: 'eu-north-1',
            AWS_S3_BUCKET: 'pashkovsky-gallery',
          },
        },
      }),
      instanceRole: instanceRole,
      cpu: apprunner.Cpu.ONE_VCPU,
      memory: apprunner.Memory.TWO_GB,
      autoDeploymentsEnabled: true,
      healthCheck: apprunner.HealthCheck.http({
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThreshold: 1,
        unhealthyThreshold: 3,
      }),
    });

    // Auto Scaling
    const autoScaling = service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 5,
    });

    autoScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    // SNS Topic for Alarms
    const alertTopic = new sns.Topic(this, 'ProfilesApiAlerts', {
      displayName: 'Profiles API Alerts',
    });

    alertTopic.addSubscription(
      new subscriptions.EmailSubscription('your-email@example.com')
    );

    // CloudWatch Alarms
    const errorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRate', {
      metric: service.metricHttp5xxCount(),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'Error rate > 5%',
    });

    errorRateAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alertTopic));

    // Outputs
    new cdk.CfnOutput(this, 'ServiceUrl', {
      value: service.serviceUrl,
      description: 'Profiles API URL',
    });

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri,
      description: 'ECR Repository URI',
    });
  }
}
```

**Деплой через CDK:**
```bash
# Bootstrap CDK (первый раз)
cdk bootstrap aws://<account-id>/eu-north-1

# Синтез CloudFormation шаблона
cdk synth

# Деплой инфраструктуры
cdk deploy

# Удаление инфраструктуры
cdk destroy
```

**Преимущества CDK:**
- Type-safe конфигурация (TypeScript)
- Переиспользуемые конструкты
- Автоматическое управление зависимостями
- Интеграция с AWS best practices

### Terraform MCP Server (Альтернатива)

**Описание:** MCP сервер для создания инфраструктуры через Terraform.

**main.tf:**
```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "eu-north-1"
}

# ECR Repository
resource "aws_ecr_repository" "profiles_api" {
  name                 = "pashkovsky-profiles-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "profiles_api" {
  repository = aws_ecr_repository.profiles_api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# Secrets Manager
resource "aws_secretsmanager_secret" "supabase_url" {
  name = "profiles-api/supabase-url"
}

resource "aws_secretsmanager_secret" "supabase_anon_key" {
  name = "profiles-api/supabase-anon-key"
}

resource "aws_secretsmanager_secret" "supabase_service_role_key" {
  name = "profiles-api/supabase-service-role-key"
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "profiles-api/jwt-secret"
}

# IAM Role for App Runner
resource "aws_iam_role" "profiles_api_instance" {
  name = "ProfilesApiInstanceRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "tasks.apprunner.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "profiles_api_instance" {
  name = "ProfilesApiInstancePolicy"
  role = aws_iam_role.profiles_api_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::pashkovsky-gallery/profiles/*",
          "arn:aws:s3:::pashkovsky-gallery"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.supabase_url.arn,
          aws_secretsmanager_secret.supabase_anon_key.arn,
          aws_secretsmanager_secret.supabase_service_role_key.arn,
          aws_secretsmanager_secret.jwt_secret.arn
        ]
      }
    ]
  })
}

# App Runner Service
resource "aws_apprunner_service" "profiles_api" {
  service_name = "pashkovsky-profiles-api"

  source_configuration {
    image_repository {
      image_identifier      = "${aws_ecr_repository.profiles_api.repository_url}:latest"
      image_repository_type = "ECR"

      image_configuration {
        port = "3002"

        runtime_environment_secrets = {
          SUPABASE_URL                = aws_secretsmanager_secret.supabase_url.arn
          SUPABASE_ANON_KEY          = aws_secretsmanager_secret.supabase_anon_key.arn
          SUPABASE_SERVICE_ROLE_KEY  = aws_secretsmanager_secret.supabase_service_role_key.arn
          JWT_SECRET                 = aws_secretsmanager_secret.jwt_secret.arn
        }

        runtime_environment_variables = {
          NODE_ENV       = "production"
          PORT           = "3002"
          AWS_REGION     = "eu-north-1"
          AWS_S3_BUCKET  = "pashkovsky-gallery"
        }
      }
    }

    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu               = "0.25 vCPU"
    memory            = "0.5 GB"
    instance_role_arn = aws_iam_role.profiles_api_instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 3
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.profiles_api.arn
}

resource "aws_apprunner_auto_scaling_configuration_version" "profiles_api" {
  auto_scaling_configuration_name = "ProfilesApiAutoScaling"
  max_concurrency                 = 100
  min_size                        = 1
  max_size                        = 5
}

# SNS Topic for Alarms
resource "aws_sns_topic" "profiles_api_alerts" {
  name = "ProfilesApiAlerts"
}

resource "aws_sns_topic_subscription" "profiles_api_alerts_email" {
  topic_arn = aws_sns_topic.profiles_api_alerts.arn
  protocol  = "email"
  endpoint  = "your-email@example.com"
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "ProfilesApi-HighErrorRate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxStatusResponses"
  namespace           = "AWS/AppRunner"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Error rate > 5%"
  alarm_actions       = [aws_sns_topic.profiles_api_alerts.arn]
}

# Outputs
output "service_url" {
  value       = aws_apprunner_service.profiles_api.service_url
  description = "Profiles API URL"
}

output "repository_uri" {
  value       = aws_ecr_repository.profiles_api.repository_url
  description = "ECR Repository URI"
}
```

**Деплой через Terraform:**
```bash
# Инициализация Terraform
terraform init

# Планирование изменений
terraform plan

# Применение изменений
terraform apply

# Удаление инфраструктуры
terraform destroy
```

**Преимущества Terraform:**
- Декларативный синтаксис (HCL)
- Поддержка множества провайдеров (AWS, Azure, GCP)
- State management для отслеживания изменений
- Большое сообщество и модули

### AWS Documentation MCP Server

**Описание:** MCP сервер для быстрого доступа к AWS документации.

**Примеры использования:**
```bash
# Поиск документации по App Runner
mcp aws-docs search "app runner auto scaling"

# Получение примеров кода
mcp aws-docs examples "app runner nodejs"

# Получение best practices
mcp aws-docs best-practices "app runner security"
```

## Оценка стоимости

### AWS App Runner (Рекомендуемый вариант)

**Предположения:**
- Нагрузка: 1000-5000 запросов в день
- Средняя длительность запроса: 200ms
- Один инстанс работает 24/7
- Автоскейлинг до 2-3 инстансов в пиковые часы

**Расчёт:**

| Компонент | Расчёт | Стоимость/мес |
|-----------|--------|---------------|
| **Compute (vCPU)** | 0.25 vCPU × 730 hours × $0.007/vCPU-hour | $1.28 |
| **Memory** | 0.5 GB × 730 hours × $0.0008/GB-hour | $0.29 |
| **Requests** | 150,000 req/month (в пределах Free Tier) | $0.00 |
| **Auto-scaling (пиковые часы)** | +1 инстанс × 4 hours/day × 30 days × ($0.007 + $0.0008) | $0.94 |
| **Data Transfer Out** | 1 GB/month × $0.09/GB | $0.09 |
| **ECR Storage** | 5 GB × $0.10/GB | $0.50 |
| **Secrets Manager** | 4 секрета × $0.40/secret | $1.60 |
| **CloudWatch Logs** | 1 GB/month × $0.50/GB | $0.50 |
| **CloudWatch Alarms** | 3 alarms × $0.10/alarm | $0.30 |
| **SNS** | 100 notifications × $0.50/1000 | $0.05 |
| **X-Ray (опционально)** | 100,000 traces × $5/1M traces | $0.50 |
| **Route 53 (опционально)** | 1 hosted zone | $0.50 |
| **ACM Certificate** | SSL сертификат | $0.00 (бесплатно) |

**Итого: ~$6-8/мес** (без кастомного домена)
**Итого: ~$7-9/мес** (с кастомным доменом)

### ECS Fargate

**Расчёт:**

| Компонент | Расчёт | Стоимость/мес |
|-----------|--------|---------------|
| **Fargate Compute** | 0.25 vCPU × 730 hours × $0.04656/vCPU-hour | $8.50 |
| **Fargate Memory** | 0.5 GB × 730 hours × $0.00511/GB-hour | $1.87 |
| **Application Load Balancer** | 730 hours × $0.0225/hour | $16.43 |
| **ALB LCU** | ~0.5 LCU × 730 hours × $0.008/LCU-hour | $2.92 |
| **ECR Storage** | 5 GB × $0.10/GB | $0.50 |
| **Secrets Manager** | 4 секрета × $0.40/secret | $1.60 |
| **CloudWatch Logs** | 1 GB/month × $0.50/GB | $0.50 |
| **Data Transfer Out** | 1 GB/month × $0.09/GB | $0.09 |

**Итого: ~$32-35/мес**

### AWS Lambda

**Расчёт:**

| Компонент | Расчёт | Стоимость/мес |
|-----------|--------|---------------|
| **Lambda Invocations** | 150,000 req × $0.20/1M req | $0.03 |
| **Lambda Compute** | 150,000 × 200ms × 512MB × $0.0000166667 | $0.50 |
| **API Gateway** | 150,000 req × $0.0000035/req | $0.53 |
| **ECR Storage** | 5 GB × $0.10/GB | $0.50 |
| **Secrets Manager** | 4 секрета × $0.40/secret | $1.60 |
| **CloudWatch Logs** | 0.5 GB/month × $0.50/GB | $0.25 |

**Итого: ~$3-4/мес**

**Примечание:** Lambda дешевле, но требует адаптации приложения и имеет cold start.

### Рекомендации по оптимизации стоимости

1. **Используйте минимальные ресурсы на старте**
   - Начните с 0.25 vCPU и 0.5 GB RAM
   - Увеличивайте по мере роста нагрузки

2. **Настройте автоскейлинг правильно**
   - Min instances: 1 (не 0, чтобы избежать cold start)
   - Max instances: 5 (достаточно для текущей нагрузки)
   - Scale down агрессивно (при CPU < 30%)

3. **Оптимизируйте Docker образ**
   - Используйте Alpine Linux
   - Multi-stage build
   - Минимизируйте количество слоёв
   - Цель: < 150 MB

4. **Используйте CloudWatch Logs retention**
   - 30 дней для production логов
   - 7 дней для debug логов
   - Архивируйте старые логи в S3 (дешевле)

5. **Мониторьте расходы**
   - Настройте AWS Budget Alert на $10/мес
   - Еженедельно проверяйте AWS Cost Explorer
   - Отключайте неиспользуемые ресурсы

6. **Рассмотрите Reserved Instances (для долгосрочных проектов)**
   - Экономия до 30-50% при commitment на 1-3 года
   - Подходит для стабильной нагрузки

## Мониторинг и логирование

### CloudWatch Logs

**Конфигурация:**
- Log Group: `/aws/apprunner/pashkovsky-profiles-api`
- Retention: 30 дней
- Формат: JSON structured logs

**Структура лога:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "HTTP Request",
  "context": {
    "method": "GET",
    "path": "/profiles",
    "statusCode": 200,
    "responseTime": 145,
    "userId": "uuid",
    "companyId": "uuid",
    "ip": "1.2.3.4",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**Запросы к логам (CloudWatch Insights):**

```sql
-- Топ 10 самых медленных запросов
fields @timestamp, context.path, context.responseTime
| filter level = "info" and context.method = "GET"
| sort context.responseTime desc
| limit 10

-- Количество ошибок по эндпоинтам
fields context.path, count(*) as errorCount
| filter level = "error"
| stats count() by context.path
| sort errorCount desc

-- Средний response time по часам
fields @timestamp, context.responseTime
| filter level = "info"
| stats avg(context.responseTime) as avgResponseTime by bin(1h)

-- Запросы от конкретного пользователя
fields @timestamp, context.method, context.path, context.statusCode
| filter context.userId = "uuid"
| sort @timestamp desc
```

### CloudWatch Metrics

**Стандартные метрики App Runner:**
- `RequestCount` - Количество запросов
- `2xxStatusResponses` - Успешные запросы
- `4xxStatusResponses` - Клиентские ошибки
- `5xxStatusResponses` - Серверные ошибки
- `RequestLatency` - Время ответа (avg, p50, p95, p99)
- `CPUUtilization` - Использование CPU (%)
- `MemoryUtilization` - Использование памяти (%)
- `ActiveInstances` - Количество активных инстансов

**Custom метрики (через CloudWatch SDK):**
```typescript
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: 'eu-north-1' });

async function publishMetric(metricName: string, value: number) {
  await cloudwatch.putMetricData({
    Namespace: 'ProfilesAPI',
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: 'Count',
        Timestamp: new Date(),
      },
    ],
  });
}

// Примеры использования
await publishMetric('ProfileCreated', 1);
await publishMetric('ImageUploaded', 1);
await publishMetric('SupabaseQueryTime', 150); // ms
```

### CloudWatch Dashboard

**Виджеты:**

1. **HTTP Requests (Line Chart)**
   - RequestCount (Sum)
   - 2xxStatusResponses (Sum)
   - 4xxStatusResponses (Sum)
   - 5xxStatusResponses (Sum)

2. **Response Time (Line Chart)**
   - RequestLatency (Average)
   - RequestLatency (p95)
   - RequestLatency (p99)

3. **Error Rate (Number Widget)**
   - 5xxStatusResponses / RequestCount × 100

4. **Resource Utilization (Line Chart)**
   - CPUUtilization (Average)
   - MemoryUtilization (Average)

5. **Active Instances (Line Chart)**
   - ActiveInstances (Average)

6. **Custom Metrics (Line Chart)**
   - ProfileCreated (Sum)
   - ImageUploaded (Sum)
   - SupabaseQueryTime (Average)

### CloudWatch Alarms

**Критические алармы:**

1. **High Error Rate**
   - Метрика: 5xxStatusResponses
   - Порог: > 5% от RequestCount
   - Период: 5 минут
   - Evaluation periods: 2
   - Действие: SNS notification

2. **High Latency**
   - Метрика: RequestLatency (p95)
   - Порог: > 2000ms
   - Период: 5 минут
   - Evaluation periods: 2
   - Действие: SNS notification

3. **High Memory Usage**
   - Метрика: MemoryUtilization
   - Порог: > 80%
   - Период: 5 минут
   - Evaluation periods: 3
   - Действие: SNS notification + Auto-scale up

4. **Service Unavailable**
   - Метрика: HealthCheckStatus
   - Порог: < 1 (unhealthy)
   - Период: 1 минута
   - Evaluation periods: 3
   - Действие: SNS notification + Auto-restart

5. **No Traffic**
   - Метрика: RequestCount
   - Порог: = 0
   - Период: 15 минут
   - Evaluation periods: 1
   - Действие: SNS notification (может быть проблема с DNS/routing)

### AWS X-Ray

**Интеграция:**
```typescript
// package.json
{
  "dependencies": {
    "aws-xray-sdk-core": "^3.5.0"
  }
}

// src/main.ts
import * as AWSXRay from 'aws-xray-sdk-core';
import * as AWS from 'aws-sdk';

// Wrap AWS SDK
AWSXRay.captureAWS(AWS);

// Wrap HTTP requests
AWSXRay.captureHTTPsGlobal(require('http'));
AWSXRay.captureHTTPsGlobal(require('https'));

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // X-Ray middleware
  app.use(AWSXRay.express.openSegment('ProfilesAPI'));
  
  // ... остальная конфигурация
  
  app.use(AWSXRay.express.closeSegment());
  
  await app.listen(3002);
}
```

**Что отслеживает X-Ray:**
- HTTP запросы к API
- Запросы к Supabase (через HTTP)
- Запросы к S3 (через AWS SDK)
- Время выполнения каждого сегмента
- Ошибки и исключения

**Service Map:**
```
Client → App Runner → Supabase
                   → S3
```

**Trace Example:**
```
Request: GET /profiles
├─ Segment: ProfilesAPI (200ms)
│  ├─ Subsegment: JWT Validation (10ms)
│  ├─ Subsegment: Supabase Query (150ms)
│  │  └─ SQL: SELECT * FROM profiles WHERE company_id = ?
│  └─ Subsegment: Response Serialization (40ms)
└─ Total: 200ms
```

### Логирование в приложении

**NestJS Logger конфигурация:**
```typescript
// src/logger/logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class CustomLogger implements LoggerService {
  log(message: string, context?: string) {
    this.printLog('info', message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.printLog('error', message, context, { trace });
  }

  warn(message: string, context?: string) {
    this.printLog('warn', message, context);
  }

  debug(message: string, context?: string) {
    this.printLog('debug', message, context);
  }

  private printLog(level: string, message: string, context?: string, extra?: any) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      ...extra,
    };

    console.log(JSON.stringify(log));
  }
}

// src/middleware/http-logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLogger } from '../logger/logger.service';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(private logger: CustomLogger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      this.logger.log('HTTP Request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime,
        userId: req['user']?.id,
        companyId: req['user']?.companyId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });

    next();
  }
}
```

## Безопасность

### IAM Best Practices

1. **Principle of Least Privilege**
   - IAM роль имеет доступ только к необходимым ресурсам
   - S3: только директория `profiles/`
   - Secrets Manager: только секреты `profiles-api/*`

2. **No Long-term Credentials**
   - Используется IAM Role вместо Access Keys
   - Временные credentials автоматически ротируются

3. **Audit Logging**
   - CloudTrail логирует все API вызовы
   - Мониторинг подозрительной активности

### Secrets Management

1. **AWS Secrets Manager**
   - Все чувствительные данные хранятся в Secrets Manager
   - Автоматическая ротация секретов (опционально)
   - Версионирование секретов

2. **Environment Variables**
   - Публичные переменные (PORT, AWS_REGION) в environment variables
   - Чувствительные переменные (JWT_SECRET, API keys) в Secrets Manager

3. **Rotation Strategy**
   - JWT_SECRET: ротация каждые 90 дней
   - Supabase keys: ротация при компрометации
   - Координация с CRM для синхронизации JWT_SECRET

### Network Security

1. **HTTPS Only**
   - App Runner автоматически предоставляет HTTPS
   - HTTP запросы перенаправляются на HTTPS

2. **CORS Configuration**
   - Разрешены только доверенные домены
   - Credentials: true для cookie-based auth

3. **Rate Limiting**
   - Встроенный rate limiting в App Runner
   - Дополнительный rate limiting в приложении (опционально)

```typescript
// src/guards/throttle.guard.ts
import { ThrottlerGuard } from '@nestjs/throttler';

// В AppModule
ThrottlerModule.forRoot({
  ttl: 60, // 60 секунд
  limit: 100, // 100 запросов
}),
```

### Application Security

1. **Input Validation**
   - class-validator для всех DTO
   - Whitelist: true (отбрасывать неизвестные поля)
   - Transform: true (автоматическая трансформация типов)

2. **Authentication & Authorization**
   - JWT токены с коротким TTL (1 час)
   - Refresh tokens для продления сессии
   - RLS политики в Supabase для изоляции данных

3. **SQL Injection Prevention**
   - Supabase клиент использует prepared statements
   - Никогда не конкатенируем SQL запросы

4. **XSS Prevention**
   - Sanitization входных данных
   - Content-Security-Policy headers

5. **CSRF Prevention**
   - SameSite cookies
   - CSRF tokens для state-changing операций

### Compliance

1. **GDPR**
   - Логирование доступа к персональным данным
   - Возможность удаления данных пользователя
   - Data retention policies

2. **Data Encryption**
   - At-rest: S3 encryption, Secrets Manager encryption
   - In-transit: HTTPS, TLS 1.2+

3. **Backup & Recovery**
   - Supabase автоматически создаёт backups
   - S3 versioning для изображений
   - RTO: 30 минут, RPO: 5 минут

## Интеграция с существующей инфраструктурой

### Обновление Vercel CRM

После деплоя Profiles API необходимо обновить переменные окружения в Vercel CRM:

**Команды:**
```bash
# Получить URL App Runner сервиса
SERVICE_URL=$(aws apprunner describe-service \
  --service-arn <service-arn> \
  --region eu-north-1 \
  --query 'Service.ServiceUrl' \
  --output text)

# Обновить переменную в Vercel
vercel env add PROFILES_API_URL production
# Ввести: https://$SERVICE_URL

# Или через Vercel Dashboard:
# 1. Перейти в Settings → Environment Variables
# 2. Добавить PROFILES_API_URL = https://<service-url>
# 3. Redeploy CRM
```

### Синхронизация секретов

**Критически важно:** JWT_SECRET должен быть одинаковым в CRM и Profiles API.

**Проверка:**
```bash
# Получить JWT_SECRET из Vercel CRM
vercel env pull .env.production
cat .env.production | grep JWT_SECRET

# Обновить JWT_SECRET в AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id profiles-api/jwt-secret \
  --secret-string "<same-jwt-secret-as-crm>" \
  --region eu-north-1
```

### Supabase RLS политики

Profiles API должен соблюдать те же RLS политики что и CRM:

**Проверка RLS политик:**
```sql
-- Проверить что RLS включен для таблицы profiles
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Проверить политики
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

**Пример RLS политики:**
```sql
-- Пользователи видят только профили своей компании
CREATE POLICY "Users can view profiles from their company"
ON profiles FOR SELECT
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Пользователи могут создавать профили только для своей компании
CREATE POLICY "Users can create profiles for their company"
ON profiles FOR INSERT
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));
```

### S3 Bucket конфигурация

**CORS конфигурация для S3:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "https://crm.pashkovsky-group.com",
      "https://profiles.pashkovsky-group.com",
      "https://*.awsapprunner.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Применение CORS:**
```bash
aws s3api put-bucket-cors \
  --bucket pashkovsky-gallery \
  --cors-configuration file://s3-cors.json \
  --region eu-north-1
```

### Тестирование интеграции

**Сценарий 1: Создание профиля через CRM**
```bash
# 1. Логин в CRM
# 2. Создать новый профиль
# 3. Проверить что профиль создан в Supabase
# 4. Проверить что изображение загружено в S3
# 5. Проверить что профиль отображается в Profiles Store
```

**Сценарий 2: Real-time обновления через WebSocket**
```bash
# 1. Открыть CRM в двух браузерах
# 2. В первом браузере обновить профиль
# 3. Проверить что изменения отображаются во втором браузере в реальном времени
```

**Сценарий 3: Проверка изоляции данных**
```bash
# 1. Логин как пользователь компании A
# 2. Попытаться получить профили компании B
# 3. Проверить что возвращается 403 Forbidden
```

## Disaster Recovery

### Backup стратегия

1. **Docker образы**
   - Хранятся в ECR с lifecycle policy (последние 10 версий)
   - Можно откатиться к любой предыдущей версии

2. **База данных (Supabase)**
   - Автоматические daily backups
   - Point-in-time recovery (последние 7 дней)
   - Manual backups перед критическими изменениями

3. **S3 изображения**
   - S3 автоматически реплицирует данные в пределах региона
   - Versioning включен для восстановления удалённых файлов
   - Cross-region replication (опционально для критичных данных)

4. **Secrets**
   - Secrets Manager хранит версии секретов
   - Можно откатиться к предыдущей версии

### Recovery процедуры

**Сценарий 1: Приложение не отвечает**

```bash
# 1. Проверить health check
curl https://<service-url>/health

# 2. Проверить логи
aws logs tail /aws/apprunner/pashkovsky-profiles-api --follow

# 3. Проверить метрики
aws cloudwatch get-metric-statistics \
  --namespace AWS/AppRunner \
  --metric-name CPUUtilization \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# 4. Перезапустить сервис (если необходимо)
aws apprunner update-service \
  --service-arn <service-arn> \
  --region eu-north-1
```

**Сценарий 2: Плохой деплой**

```bash
# 1. Откатиться к предыдущей версии образа
aws apprunner update-service \
  --service-arn <service-arn> \
  --source-configuration "ImageRepository={ImageIdentifier=<account-id>.dkr.ecr.eu-north-1.amazonaws.com/pashkovsky-profiles-api:v1.0.0,ImageRepositoryType=ECR}" \
  --region eu-north-1

# 2. Дождаться завершения деплоя
aws apprunner wait service-updated \
  --service-arn <service-arn> \
  --region eu-north-1

# 3. Проверить health check
curl https://<service-url>/health
```

**Сценарий 3: Полный отказ AWS региона (eu-north-1)**

```bash
# 1. Создать новый App Runner сервис в другом регионе (eu-west-1)
# 2. Использовать тот же ECR образ (скопировать в новый регион)
# 3. Использовать те же Secrets Manager секреты (скопировать в новый регион)
# 4. Обновить DNS записи в Route 53 для переключения трафика
# 5. Supabase и S3 доступны из любого региона (не требуют миграции)
```

**RTO (Recovery Time Objective):** 30 минут
**RPO (Recovery Point Objective):** 5 минут

### Runbook

**Проблема: High Error Rate (5xx > 5%)**

1. Проверить CloudWatch Logs для деталей ошибок
2. Проверить доступность Supabase и S3
3. Проверить memory/CPU utilization
4. Если memory > 90% → увеличить memory в instance configuration
5. Если Supabase недоступен → проверить Supabase status page
6. Если S3 недоступен → проверить AWS status page
7. Если ошибки в коде → откатиться к предыдущей версии

**Проблема: High Latency (p95 > 2000ms)**

1. Проверить CloudWatch Logs для медленных запросов
2. Проверить X-Ray traces для bottlenecks
3. Проверить Supabase query performance
4. Проверить S3 upload/download time
5. Оптимизировать медленные запросы (добавить индексы, кэширование)
6. Увеличить CPU/Memory если необходимо

**Проблема: Service Unavailable**

1. Проверить health check endpoint
2. Проверить App Runner service status
3. Проверить CloudWatch Logs для startup errors
4. Проверить environment variables и secrets
5. Перезапустить сервис
6. Если не помогает → откатиться к предыдущей версии

## Заключение

Данный дизайн документ описывает полное решение для деплоя NestJS Profiles API на AWS с использованием AWS App Runner. Решение обеспечивает:

- **Низкую стоимость**: $6-9/мес при текущей нагрузке
- **Простоту настройки**: Деплой за 15-20 минут
- **Автоматическое масштабирование**: От 1 до 5 инстансов
- **Высокую доступность**: Health checks и автоматический перезапуск
- **Безопасность**: IAM roles, Secrets Manager, HTTPS, CORS
- **Мониторинг**: CloudWatch Logs, Metrics, Alarms, X-Ray
- **CI/CD автоматизацию**: GitHub Actions для автоматического деплоя
- **Disaster Recovery**: RTO 30 минут, RPO 5 минут

Альтернативные варианты (ECS Fargate, Lambda) также описаны для возможного использования в будущем при изменении требований.

### Следующие шаги

1. Создать AWS аккаунт (если ещё нет)
2. Настроить AWS CLI и credentials
3. Создать ECR репозиторий
4. Создать секреты в Secrets Manager
5. Собрать и опубликовать Docker образ
6. Создать App Runner сервис (через AWS CLI или CDK/Terraform)
7. Настроить CloudWatch мониторинг
8. Настроить CI/CD pipeline в GitHub Actions
9. Обновить PROFILES_API_URL в Vercel CRM
10. Протестировать интеграцию

### Полезные ссылки

- [AWS App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [AWS X-Ray SDK for Node.js](https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-nodejs.html)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
