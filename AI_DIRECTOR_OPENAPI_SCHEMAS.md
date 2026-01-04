# OpenAPI Schemas для AWS Bedrock Action Groups

## 📋 Инструкция по применению

Для каждого Action Group в AWS Bedrock Console:

1. Перейдите в **Action Groups** → выберите нужный Action Group
2. Нажмите **Edit**
3. В разделе **API Schema** выберите **Define with in-line OpenAPI schema editor**
4. Скопируйте соответствующую схему ниже
5. Замените `YOUR_DEPLOYED_URL` на ваш реальный URL (например, `https://your-app.vercel.app` или ngrok URL)
6. Нажмите **Save**

---

## 1️⃣ Action Group: `get_deals_data`

**Endpoint URL**: `https://nonshipping-harrison-quadrilingual.ngrok-free.dev/api/ai-director/data/deals`

```yaml
openapi: 3.0.0
info:
  title: CRM Deals Data API
  version: 1.0.0
  description: API для получения данных о сделках из CRM
paths:
  /api/ai-director/data/deals:
    get:
      summary: Получить список сделок
      operationId: getDeals
      parameters:
        - name: company_id
          in: query
          required: true
          schema:
            type: string
          description: ID компании (берётся из session attributes)
          x-amazon-bedrock-session-attribute: company_id
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [lead, negotiation, contract, production, installation, completed, cancelled]
          description: Фильтр по статусу сделки
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 50
          description: Максимальное количество записей
        - name: offset
          in: query
          required: false
          schema:
            type: integer
            default: 0
          description: Смещение для пагинации
      security:
        - ApiTokenAuth: []
      responses:
        '200':
          description: Список сделок
          content:
            application/json:
              schema:
                type: object
                properties:
                  deals:
                    type: array
                    items:
                      type: object
                  total:
                    type: integer
        '401':
          description: Unauthorized
        '500':
          description: Internal Server Error
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: x-api-token
      x-amazon-bedrock-session-attribute: api_token
```

---

## 2️⃣ Action Group: `get_leads_data`

**Endpoint URL**: `https://nonshipping-harrison-quadrilingual.ngrok-free.dev/api/ai-director/data/leads`

```yaml
openapi: 3.0.0
info:
  title: CRM Leads Data API
  version: 1.0.0
  description: API для получения данных о лидах из CRM
paths:
  /api/ai-director/data/leads:
    get:
      summary: Получить список лидов
      operationId: getLeads
      parameters:
        - name: company_id
          in: query
          required: true
          schema:
            type: string
          description: ID компании (берётся из session attributes)
          x-amazon-bedrock-session-attribute: company_id
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [new, contacted, qualified, unqualified]
          description: Фильтр по статусу лида
        - name: source
          in: query
          required: false
          schema:
            type: string
          description: Фильтр по источнику лида
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 50
          description: Максимальное количество записей
        - name: offset
          in: query
          required: false
          schema:
            type: integer
            default: 0
          description: Смещение для пагинации
      security:
        - ApiTokenAuth: []
      responses:
        '200':
          description: Список лидов
          content:
            application/json:
              schema:
                type: object
                properties:
                  leads:
                    type: array
                    items:
                      type: object
                  total:
                    type: integer
        '401':
          description: Unauthorized
        '500':
          description: Internal Server Error
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: x-api-token
      x-amazon-bedrock-session-attribute: api_token
```

---

## 3️⃣ Action Group: `get_workers_data`

**Endpoint URL**: `https://nonshipping-harrison-quadrilingual.ngrok-free.dev/api/ai-director/data/workers`

```yaml
openapi: 3.0.0
info:
  title: CRM Workers Data API
  version: 1.0.0
  description: API для получения данных о работниках и сменах из CRM
paths:
  /api/ai-director/data/workers:
    get:
      summary: Получить список работников и их смен
      operationId: getWorkers
      parameters:
        - name: company_id
          in: query
          required: true
          schema:
            type: string
          description: ID компании (берётся из session attributes)
          x-amazon-bedrock-session-attribute: company_id
        - name: include_shifts
          in: query
          required: false
          schema:
            type: boolean
            default: false
          description: Включить информацию о рабочих сменах
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 50
          description: Максимальное количество записей
        - name: offset
          in: query
          required: false
          schema:
            type: integer
            default: 0
          description: Смещение для пагинации
      security:
        - ApiTokenAuth: []
      responses:
        '200':
          description: Список работников
          content:
            application/json:
              schema:
                type: object
                properties:
                  workers:
                    type: array
                    items:
                      type: object
                  total:
                    type: integer
        '401':
          description: Unauthorized
        '500':
          description: Internal Server Error
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: x-api-token
      x-amazon-bedrock-session-attribute: api_token
```

---

## 4️⃣ Action Group: `get_analytics_data`

**Endpoint URL**: `https://nonshipping-harrison-quadrilingual.ngrok-free.dev/api/ai-director/data/analytics`

```yaml
openapi: 3.0.0
info:
  title: CRM Analytics Data API
  version: 1.0.0
  description: API для получения аналитических данных из CRM
paths:
  /api/ai-director/data/analytics:
    description: Endpoint для получения аналитических данных из CRM, включая доходы, сделки, лиды и статистику за указанный период
    get:
      summary: Получить аналитические данные
      operationId: getAnalytics
      parameters:
        - name: company_id
          in: query
          required: true
          schema:
            type: string
          description: ID компании (берётся из session attributes)
          x-amazon-bedrock-session-attribute: company_id
        - name: period
          in: query
          required: false
          schema:
            type: string
            enum: [week, month, quarter, year, all_time, all]
            default: month
          description: Период для аналитики (week, month, quarter, year, all_time для всех данных)
        - name: start_date
          in: query
          required: false
          schema:
            type: string
            format: date-time
          description: Начальная дата для кастомного периода (ISO 8601)
        - name: end_date
          in: query
          required: false
          schema:
            type: string
            format: date-time
          description: Конечная дата для кастомного периода (ISO 8601)
      security:
        - ApiTokenAuth: []
      responses:
        '200':
          description: Аналитические данные
          content:
            application/json:
              schema:
                type: object
                properties:
                  period:
                    type: object
                    properties:
                      start:
                        type: string
                      end:
                        type: string
                      type:
                        type: string
                  revenue:
                    type: object
                    properties:
                      total:
                        type: number
                        description: Общая сумма доходов
                      from_offers:
                        type: number
                        description: Доходы из одобренных предложений
                      from_deals:
                        type: number
                        description: Доходы из завершенных сделок
                      approved_offers_count:
                        type: integer
                        description: Количество одобренных предложений
                      completed_deals_count:
                        type: integer
                        description: Количество завершенных сделок
                  deals:
                    type: object
                  leads:
                    type: object
        '401':
          description: Unauthorized
        '500':
          description: Internal Server Error
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: x-api-token
      x-amazon-bedrock-session-attribute: api_token
```

---

## 5️⃣ Action Group: `get_gallery_data`

**Endpoint URL**: `https://nonshipping-harrison-quadrilingual.ngrok-free.dev/api/ai-director/data/gallery`

```yaml
openapi: 3.0.0
info:
  title: CRM Gallery Data API
  version: 1.0.0
  description: API для получения данных о галерее и проектах из CRM
paths:
  /api/ai-director/data/gallery:
    get:
      summary: Получить данные галереи и проектов
      operationId: getGallery
      parameters:
        - name: company_id
          in: query
          required: true
          schema:
            type: string
          description: ID компании (берётся из session attributes)
          x-amazon-bedrock-session-attribute: company_id
        - name: category
          in: query
          required: false
          schema:
            type: string
          description: Фильтр по категории галереи
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 50
          description: Максимальное количество записей
        - name: offset
          in: query
          required: false
          schema:
            type: integer
            default: 0
          description: Смещение для пагинации
      security:
        - ApiTokenAuth: []
      responses:
        '200':
          description: Данные галереи и проектов
          content:
            application/json:
              schema:
                type: object
                properties:
                  categories:
                    type: array
                    items:
                      type: object
                  images:
                    type: array
                    items:
                      type: object
                  projects:
                    type: array
                    items:
                      type: object
        '401':
          description: Unauthorized
        '500':
          description: Internal Server Error
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: x-api-token
      x-amazon-bedrock-session-attribute: api_token
```

---

## 6️⃣ Action Group: `get_offers_data`

**Endpoint URL**: `https://nonshipping-harrison-quadrilingual.ngrok-free.dev/api/ai-director/data/offers`

```yaml
openapi: 3.0.0
info:
  title: CRM Offers Data API
  version: 1.0.0
  description: API для получения данных об офферах/предложениях (הצעות מחיר) из CRM
paths:
  /api/ai-director/data/offers:
    get:
      summary: Получить список офферов
      description: Возвращает список офферов/предложений по компании
      operationId: getOffers
      parameters:
        - name: company_id
          in: query
          required: true
          schema:
            type: string
          description: ID компании (берётся из session attributes)
          x-amazon-bedrock-session-attribute: company_id
        - name: deal_id
          in: query
          required: false
          schema:
            type: string
          description: Фильтр по ID сделки
        - name: approved
          in: query
          required: false
          schema:
            type: boolean
          description: Фильтр по статусу утверждения (true/false)
        - name: start_date
          in: query
          required: false
          schema:
            type: string
          description: Офферы, созданные после даты (ISO 8601)
        - name: end_date
          in: query
          required: false
          schema:
            type: string
          description: Офферы, созданные до даты (ISO 8601)
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 50
          description: Максимальное количество записей (макс 100)
      security:
        - ApiTokenAuth: []
      responses:
        '200':
          description: Список офферов
        '401':
          description: Unauthorized
        '500':
          description: Internal Server Error
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: x-api-token
      x-amazon-bedrock-session-attribute: api_token
```

---

## 7️⃣ Action Group: `get_material_orders_data`

**Endpoint URL**: `https://nonshipping-harrison-quadrilingual.ngrok-free.dev/api/ai-director/data/material-orders`

```yaml
openapi: 3.0.0
info:
  title: CRM Material Orders Data API
  version: 1.0.0
  description: API для получения данных по закупкам/заказам материалов из CRM
paths:
  /api/ai-director/data/material-orders:
    get:
      summary: Получить список заказов материалов
      description: Возвращает список заказов материалов по компании
      operationId: getMaterialOrders
      parameters:
        - name: company_id
          in: query
          required: true
          schema:
            type: string
          description: ID компании (берётся из session attributes)
          x-amazon-bedrock-session-attribute: company_id
        - name: deal_id
          in: query
          required: false
          schema:
            type: string
          description: Фильтр по ID сделки
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [ordered, confirmed, in_transit, delivered, cancelled]
          description: Фильтр по статусу заказа материалов
        - name: supplier_name
          in: query
          required: false
          schema:
            type: string
          description: Фильтр по поставщику (точное совпадение)
        - name: start_date
          in: query
          required: false
          schema:
            type: string
          description: Заказы после даты (ISO 8601, по order_date)
        - name: end_date
          in: query
          required: false
          schema:
            type: string
          description: Заказы до даты (ISO 8601, по order_date)
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 50
          description: Максимальное количество записей (макс 100)
      security:
        - ApiTokenAuth: []
      responses:
        '200':
          description: Список заказов материалов
        '401':
          description: Unauthorized
        '500':
          description: Internal Server Error
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: x-api-token
      x-amazon-bedrock-session-attribute: api_token
```

---

## ✅ Чек-лист после обновления схем

После применения всех схем:

1. ✅ Все Action Groups должны быть в статусе **PREPARED** или **READY**
2. ✅ В каждом Action Group должен быть указан правильный **Endpoint URL**
3. ✅ Убедитесь, что **Action group invocation** = **API Gateway endpoint** (не Lambda!)
4. ✅ Проверьте, что в `.env.local` есть `AI_DIRECTOR_API_TOKEN`
5. ✅ Перезапустите сервер: `npm run dev` в `apps/crm`

---

## 🧪 Тестирование

После применения схем попробуйте снова спросить в чате:

```
Сколько у нас открытых сделок?
```

Агент должен автоматически использовать `company_id` из сессии и вернуть данные!

---

## 🔧 Если всё ещё не работает

1. **Проверьте логи в AWS Bedrock Console** → Agent → Test → View logs
2. **Проверьте логи вашего сервера** (терминал с `npm run dev`)
3. **Убедитесь, что ngrok работает** и URL доступен из интернета
4. **Проверьте, что токен правильный**: `echo $AI_DIRECTOR_API_TOKEN` в терминале

---

## 📚 Дополнительная информация

- [AWS Bedrock Session Attributes](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-session-state.html)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)


