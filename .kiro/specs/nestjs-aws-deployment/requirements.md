# Требования к деплою NestJS приложения на AWS

## Введение

Данный документ описывает требования к развёртыванию NestJS API (profiles-api) на AWS с учётом специфики монорепозитория, интеграции с существующей инфраструктурой (Vercel CRM, Supabase, S3) и необходимости выбора оптимального варианта деплоя.

## Глоссарий

- **Profiles_API**: NestJS приложение для управления каталогом алюминиевых профилей, работающее на порту 3002
- **CRM**: Next.js приложение для управления бизнес-процессами, развёрнутое на Vercel
- **Monorepo**: Монорепозиторий на базе Turbo, содержащий несколько приложений (CRM, Site, Profiles_API, Profiles_Store)
- **Supabase**: Backend-as-a-Service платформа, используемая для базы данных PostgreSQL и аутентификации
- **S3_Bucket**: AWS S3 хранилище (pashkovsky-gallery) для изображений профилей
- **Deployment_Option**: Вариант развёртывания приложения на AWS (App Runner, ECS Fargate, Lambda, EC2, Elastic Beanstalk)
- **CI_CD_Pipeline**: Автоматизированный процесс сборки и развёртывания приложения
- **Health_Check**: Эндпоинт для проверки работоспособности приложения
- **Environment_Variables**: Переменные окружения, необходимые для работы приложения (Supabase URL, JWT Secret, AWS credentials)
- **Docker_Image**: Контейнеризированный образ приложения для развёртывания
- **ECR**: Amazon Elastic Container Registry для хранения Docker образов
- **RLS**: Row Level Security политики в Supabase для изоляции данных по компаниям
- **CORS**: Cross-Origin Resource Sharing настройки для взаимодействия с фронтенд приложениями
- **CDK_Bootstrap**: Процесс инициализации AWS CDK в AWS аккаунте, создающий необходимые ресурсы (S3 bucket, ECR repo, IAM roles)
- **IAM_Policy**: Документ определяющий разрешения для AWS ресурсов
- **SSM_Parameter_Store**: AWS Systems Manager Parameter Store для хранения конфигурационных данных

## Требования

### Требование 1: Анализ вариантов деплоя

**User Story:** Как DevOps инженер, я хочу получить сравнительный анализ всех доступных вариантов деплоя NestJS на AWS, чтобы выбрать оптимальное решение для проекта.

#### Acceptance Criteria

1. THE System SHALL предоставить описание пяти основных вариантов деплоя: AWS App Runner, ECS Fargate, AWS Lambda, EC2, Elastic Beanstalk
2. FOR EACH Deployment_Option, THE System SHALL указать преимущества и недостатки
3. FOR EACH Deployment_Option, THE System SHALL оценить примерную стоимость при нагрузке 1000-5000 запросов в день
4. FOR EACH Deployment_Option, THE System SHALL указать сложность настройки (низкая, средняя, высокая)
5. FOR EACH Deployment_Option, THE System SHALL указать возможности масштабирования (вертикальное, горизонтальное, автоматическое)
6. THE System SHALL предоставить рекомендацию по выбору варианта с учётом специфики проекта (монорепозиторий, существующий Dockerfile, интеграция с Supabase и S3)

### Требование 2: Контейнеризация приложения

**User Story:** Как разработчик, я хочу иметь оптимизированный Docker образ для Profiles_API, чтобы обеспечить быстрый деплой и минимальный размер образа.

#### Acceptance Criteria

1. THE Docker_Image SHALL использовать multi-stage build для минимизации размера финального образа
2. THE Docker_Image SHALL содержать только production зависимости в финальном stage
3. THE Docker_Image SHALL использовать Node.js 20 Alpine образ для минимального размера
4. WHEN Docker_Image собирается, THE System SHALL копировать только необходимые файлы из монорепозитория
5. THE Docker_Image SHALL экспонировать порт 3002
6. THE Docker_Image SHALL запускать приложение командой "node dist/main.js"
7. THE Docker_Image SHALL иметь размер не более 200MB в сжатом виде
8. THE Dockerfile SHALL включать .dockerignore для исключения ненужных файлов (node_modules, .git, .env)

### Требование 3: Управление переменными окружения

**User Story:** Как DevOps инженер, я хочу безопасно управлять переменными окружения для Profiles_API, чтобы обеспечить безопасность и гибкость конфигурации.

#### Acceptance Criteria

1. THE System SHALL хранить чувствительные Environment_Variables (JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY, AWS_SECRET_ACCESS_KEY) в AWS Secrets Manager или AWS Systems Manager Parameter Store
2. THE System SHALL предоставить список всех необходимых Environment_Variables для работы Profiles_API
3. FOR EACH Environment_Variables, THE System SHALL указать назначение и пример значения
4. THE System SHALL обеспечить инъекцию Environment_Variables в контейнер при запуске
5. WHEN Environment_Variables изменяются, THE System SHALL позволить обновить их без пересборки Docker_Image
6. THE System SHALL валидировать наличие обязательных Environment_Variables при старте приложения
7. THE System SHALL логировать ошибку и останавливать запуск, IF обязательные Environment_Variables отсутствуют

### Требование 4: Интеграция с ECR

**User Story:** Как DevOps инженер, я хочу автоматически публиковать Docker образы в ECR, чтобы обеспечить централизованное хранение и версионирование образов.

#### Acceptance Criteria

1. THE System SHALL создать ECR репозиторий с именем "pashkovsky-profiles-api" в регионе eu-north-1
2. THE System SHALL настроить lifecycle policy для автоматического удаления старых образов (хранить последние 10 версий)
3. WHEN Docker_Image собирается локально, THE System SHALL предоставить команды для аутентификации в ECR
4. WHEN Docker_Image собирается локально, THE System SHALL предоставить команды для тегирования образа
5. WHEN Docker_Image собирается локально, THE System SHALL предоставить команды для публикации образа в ECR
6. THE System SHALL использовать семантическое версионирование для тегов образов (latest, v1.0.0, commit-sha)
7. THE System SHALL сканировать Docker_Image на уязвимости при публикации в ECR

### Требование 5: Настройка выбранного варианта деплоя

**User Story:** Как DevOps инженер, я хочу получить пошаговую инструкцию по настройке выбранного варианта деплоя, чтобы быстро развернуть Profiles_API на AWS.

#### Acceptance Criteria

1. WHERE AWS App Runner выбран, THE System SHALL предоставить инструкцию по созданию App Runner сервиса из ECR образа
2. WHERE AWS App Runner выбран, THE System SHALL настроить автоматическое масштабирование (min 1, max 5 инстансов)
3. WHERE AWS App Runner выбран, THE System SHALL настроить Health_Check на эндпоинт /health
4. WHERE ECS Fargate выбран, THE System SHALL предоставить инструкцию по созданию ECS Cluster, Task Definition и Service
5. WHERE ECS Fargate выбран, THE System SHALL настроить Application Load Balancer для HTTPS трафика
6. WHERE AWS Lambda выбран, THE System SHALL адаптировать NestJS приложение для работы в serverless режиме через AWS Lambda Adapter
7. THE System SHALL настроить автоматический перезапуск контейнера при падении
8. THE System SHALL настроить ресурсы (CPU: 0.25-1 vCPU, Memory: 0.5-2 GB) в зависимости от нагрузки
9. THE System SHALL предоставить URL развёрнутого сервиса после успешного деплоя

### Требование 6: Настройка сети и безопасности

**User Story:** Как DevOps инженер, я хочу обеспечить безопасный доступ к Profiles_API, чтобы защитить данные и предотвратить несанкционированный доступ.

#### Acceptance Criteria

1. THE System SHALL настроить HTTPS для публичного доступа к Profiles_API
2. THE System SHALL настроить CORS для разрешения запросов только от доверенных доменов (crm.pashkovsky-group.com, profiles.pashkovsky-group.com, localhost)
3. WHERE ECS Fargate или EC2 используются, THE System SHALL настроить Security Groups для ограничения входящего трафика (только порты 80, 443)
4. THE System SHALL настроить IAM роль для контейнера с минимальными необходимыми правами (доступ к S3_Bucket, Secrets Manager)
5. THE System SHALL запретить публичный доступ к ECR репозиторию
6. THE System SHALL включить логирование всех API запросов для аудита
7. IF запрос приходит без валидного JWT токена к защищённым эндпоинтам, THEN THE System SHALL вернуть HTTP 401 Unauthorized

### Требование 7: Настройка кастомного домена

**User Story:** Как DevOps инженер, я хочу настроить кастомный домен для Profiles_API, чтобы обеспечить профессиональный вид и упростить интеграцию с CRM.

#### Acceptance Criteria

1. THE System SHALL предоставить инструкцию по настройке кастомного домена (например, api.pashkovsky-group.com) через Route 53
2. THE System SHALL создать SSL/TLS сертификат через AWS Certificate Manager для кастомного домена
3. THE System SHALL настроить DNS записи (A или CNAME) для привязки домена к развёрнутому сервису
4. WHEN кастомный домен настроен, THE System SHALL автоматически перенаправлять HTTP трафик на HTTPS
5. THE System SHALL валидировать SSL сертификат перед активацией домена
6. THE System SHALL обновить CORS настройки в Profiles_API для включения кастомного домена

### Требование 8: CI/CD автоматизация

**User Story:** Как разработчик, я хочу автоматизировать процесс деплоя Profiles_API, чтобы ускорить релизы и минимизировать ручные ошибки.

#### Acceptance Criteria

1. THE CI_CD_Pipeline SHALL запускаться автоматически при push в ветку main с изменениями в директории apps/profiles-api
2. THE CI_CD_Pipeline SHALL собирать Docker_Image из исходного кода
3. THE CI_CD_Pipeline SHALL запускать тесты (unit, integration) перед деплоем
4. IF тесты проваливаются, THEN THE CI_CD_Pipeline SHALL остановить деплой и уведомить разработчиков
5. WHEN тесты проходят успешно, THE CI_CD_Pipeline SHALL публиковать Docker_Image в ECR с тегом commit SHA
6. THE CI_CD_Pipeline SHALL обновлять развёрнутый сервис новым образом
7. THE CI_CD_Pipeline SHALL выполнять Health_Check после деплоя для проверки работоспособности
8. IF Health_Check проваливается, THEN THE CI_CD_Pipeline SHALL выполнить rollback к предыдущей версии
9. THE CI_CD_Pipeline SHALL отправлять уведомления в Slack или email о статусе деплоя
10. THE System SHALL предоставить GitHub Actions workflow или альтернативный CI/CD конфиг (GitLab CI, CircleCI)

### Требование 9: Мониторинг и логирование

**User Story:** Как DevOps инженер, я хочу мониторить работу Profiles_API и анализировать логи, чтобы быстро выявлять и устранять проблемы.

#### Acceptance Criteria

1. THE System SHALL интегрировать CloudWatch Logs для централизованного сбора логов приложения
2. THE System SHALL настроить retention policy для логов (хранить 30 дней)
3. THE System SHALL логировать все HTTP запросы с информацией: timestamp, method, path, status code, response time, user_id
4. THE System SHALL логировать все ошибки с полным stack trace
5. THE System SHALL настроить CloudWatch Metrics для отслеживания: CPU usage, Memory usage, Request count, Error rate, Response time (p50, p95, p99)
6. THE System SHALL создать CloudWatch Dashboard для визуализации ключевых метрик
7. THE System SHALL настроить CloudWatch Alarms для критических событий: Error rate > 5%, Response time p95 > 2000ms, Memory usage > 80%
8. WHEN CloudWatch Alarm срабатывает, THE System SHALL отправлять уведомление в SNS topic
9. THE System SHALL интегрировать AWS X-Ray для distributed tracing запросов между Profiles_API, Supabase и S3
10. THE System SHALL предоставить инструкцию по доступу к логам и метрикам через AWS Console

### Требование 10: Интеграция с существующей инфраструктурой

**User Story:** Как разработчик, я хочу обеспечить бесшовную интеграцию Profiles_API с CRM на Vercel, Supabase и S3, чтобы все компоненты системы работали согласованно.

#### Acceptance Criteria

1. WHEN Profiles_API развёрнут, THE System SHALL обновить переменную окружения PROFILES_API_URL в Vercel CRM с новым URL
2. THE System SHALL использовать те же Supabase credentials (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY), что и CRM
3. THE System SHALL использовать тот же JWT_SECRET, что и CRM, для валидации токенов
4. THE System SHALL использовать тот же S3_Bucket (pashkovsky-gallery) для загрузки изображений профилей
5. THE System SHALL использовать IAM роль с правами на чтение/запись в S3_Bucket в директории profiles/
6. THE System SHALL соблюдать те же RLS политики Supabase для изоляции данных по компаниям
7. THE System SHALL использовать тот же PASHKOVSKY_COMPANY_ID для feature flag проверки доступа к модулю профилей
8. WHEN CRM делает запрос к Profiles_API, THE System SHALL валидировать JWT токен и извлекать user_id и company_id
9. THE System SHALL возвращать данные только для той компании, к которой принадлежит пользователь
10. IF пользователь не принадлежит к Pashkovsky компании, THEN THE System SHALL вернуть HTTP 403 Forbidden при попытке доступа к эндпоинтам профилей

### Требование 11: Health Check и готовность к production

**User Story:** Как DevOps инженер, я хочу иметь надёжный Health_Check эндпоинт, чтобы автоматически определять работоспособность Profiles_API.

#### Acceptance Criteria

1. THE Profiles_API SHALL предоставить эндпоинт GET /health для проверки работоспособности
2. WHEN GET /health вызывается, THE System SHALL проверить подключение к Supabase
3. WHEN GET /health вызывается, THE System SHALL проверить доступность S3_Bucket
4. WHEN все зависимости доступны, THE System SHALL вернуть HTTP 200 OK с JSON: {"status": "healthy", "timestamp": "ISO-8601", "dependencies": {"supabase": "ok", "s3": "ok"}}
5. IF Supabase недоступен, THEN THE System SHALL вернуть HTTP 503 Service Unavailable с JSON: {"status": "unhealthy", "dependencies": {"supabase": "error", "s3": "ok"}}
6. IF S3_Bucket недоступен, THEN THE System SHALL вернуть HTTP 503 Service Unavailable с JSON: {"status": "unhealthy", "dependencies": {"supabase": "ok", "s3": "error"}}
7. THE Health_Check SHALL выполняться за время не более 3 секунд
8. THE System SHALL настроить load balancer или App Runner для использования /health эндпоинта с интервалом проверки 30 секунд
9. IF Health_Check проваливается 3 раза подряд, THEN THE System SHALL перезапустить контейнер

### Требование 12: Масштабирование и производительность

**User Story:** Как DevOps инженер, я хочу настроить автоматическое масштабирование Profiles_API, чтобы обеспечить стабильную работу при росте нагрузки.

#### Acceptance Criteria

1. THE System SHALL настроить автоматическое горизонтальное масштабирование на основе CPU usage
2. WHEN CPU usage превышает 70% в течение 2 минут, THE System SHALL запустить дополнительный инстанс
3. WHEN CPU usage падает ниже 30% в течение 5 минут, THE System SHALL остановить лишний инстанс
4. THE System SHALL поддерживать минимум 1 инстанс и максимум 5 инстансов
5. THE System SHALL настроить connection pooling для Supabase с максимум 10 соединениями на инстанс
6. THE System SHALL использовать HTTP keep-alive для соединений с S3
7. THE System SHALL кэшировать статические данные (список активных профилей) на 5 минут
8. THE System SHALL обрабатывать минимум 100 запросов в секунду на одном инстансе
9. THE System SHALL иметь response time p95 не более 500ms для GET запросов
10. THE System SHALL иметь response time p95 не более 1000ms для POST/PATCH запросов с загрузкой изображений

### Требование 13: Backup и disaster recovery

**User Story:** Как DevOps инженер, я хочу иметь план восстановления Profiles_API после сбоя, чтобы минимизировать downtime.

#### Acceptance Criteria

1. THE System SHALL хранить все Docker_Image версии в ECR с тегами для возможности rollback
2. THE System SHALL предоставить команду для быстрого rollback к предыдущей версии
3. THE System SHALL документировать процедуру восстановления сервиса при полном отказе AWS региона
4. THE System SHALL использовать Supabase для хранения данных (база данных автоматически реплицируется Supabase)
5. THE System SHALL использовать S3 для хранения изображений (S3 автоматически реплицирует данные в пределах региона)
6. THE System SHALL иметь RTO (Recovery Time Objective) не более 30 минут
7. THE System SHALL иметь RPO (Recovery Point Objective) не более 5 минут
8. THE System SHALL предоставить runbook с пошаговыми инструкциями для восстановления сервиса

### Требование 14: Стоимость и оптимизация

**User Story:** Как владелец продукта, я хочу оптимизировать стоимость инфраструктуры AWS, чтобы минимизировать расходы при сохранении необходимой производительности.

#### Acceptance Criteria

1. THE System SHALL предоставить калькуляцию ежемесячной стоимости для выбранного варианта деплоя
2. THE System SHALL использовать минимальные ресурсы (0.25 vCPU, 0.5 GB RAM) для начального деплоя
3. THE System SHALL настроить автоматическое масштабирование для оптимизации стоимости (scale down при низкой нагрузке)
4. THE System SHALL использовать AWS Free Tier где возможно (CloudWatch Logs, ECR)
5. THE System SHALL настроить lifecycle policy для ECR для удаления старых образов и экономии хранилища
6. THE System SHALL настроить CloudWatch Logs retention на 30 дней для экономии хранилища
7. THE System SHALL предоставить рекомендации по оптимизации стоимости (использование Spot Instances для ECS, Reserved Instances для EC2)
8. THE System SHALL мониторить ежемесячные расходы через AWS Cost Explorer
9. THE System SHALL настроить AWS Budget Alert для уведомления при превышении бюджета $50/месяц

### Требование 15: Документация и знания

**User Story:** Как разработчик, я хочу иметь полную документацию по деплою и эксплуатации Profiles_API на AWS, чтобы быстро разобраться в инфраструктуре.

#### Acceptance Criteria

1. THE System SHALL предоставить README с описанием архитектуры деплоя
2. THE System SHALL предоставить пошаговую инструкцию по первоначальному деплою
3. THE System SHALL предоставить инструкцию по обновлению приложения (manual и через CI/CD)
4. THE System SHALL предоставить инструкцию по rollback к предыдущей версии
5. THE System SHALL предоставить инструкцию по масштабированию ресурсов (увеличение CPU/Memory)
6. THE System SHALL предоставить инструкцию по доступу к логам и метрикам
7. THE System SHALL предоставить troubleshooting guide с распространёнными проблемами и решениями
8. THE System SHALL предоставить диаграмму архитектуры с указанием всех компонентов (Profiles_API, ECR, Load Balancer, Supabase, S3, CloudWatch)
9. THE System SHALL предоставить список всех AWS ресурсов с их назначением и стоимостью
10. THE System SHALL предоставить контакты и ссылки на AWS документацию для дополнительной информации

### Требование 16: Настройка IAM прав для CDK деплоя

**User Story:** Как DevOps инженер, я хочу иметь правильно настроенные IAM права для CDK деплоя, чтобы успешно создавать и управлять инфраструктурой через AWS CDK.

#### Acceptance Criteria

1. THE System SHALL предоставить IAM_Policy для CDK деплоя с минимальными необходимыми правами
2. THE IAM User или Role SHALL иметь права на ssm:GetParameter для проверки CDK_Bootstrap версии
3. THE IAM User или Role SHALL иметь права на sts:AssumeRole для CDK deploy role
4. THE IAM User или Role SHALL иметь права на CloudFormation операции (CreateStack, UpdateStack, DeleteStack, DescribeStacks)
5. THE IAM User или Role SHALL иметь права на создание и управление ECR репозиториями
6. THE IAM User или Role SHALL иметь права на создание и управление App Runner сервисами
7. THE IAM User или Role SHALL иметь права на создание и управление IAM ролями для App Runner
8. THE IAM User или Role SHALL иметь права на создание и управление Secrets Manager секретами
9. THE IAM User или Role SHALL иметь права на создание и управление CloudWatch ресурсами
10. THE System SHALL предоставить команды для проверки текущих IAM прав пользователя
11. THE System SHALL предоставить инструкцию по созданию нового IAM пользователя с правильными правами
12. IF IAM права недостаточны, THEN THE System SHALL вернуть понятное сообщение об ошибке с указанием недостающих прав
13. THE System SHALL предоставить альтернативный способ деплоя без CDK (через AWS CLI) для случаев когда CDK права недоступны
