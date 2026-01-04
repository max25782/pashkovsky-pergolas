# 🔧 Исправление: AI Director спрашивает company_id

## ✅ Хорошая новость!

Агент **работает** и вызывает Action Groups! Но он не получает `company_id` автоматически из сессии.

---

## 🎯 Решение: Обновить OpenAPI схемы

Нужно добавить специальное поле `x-amazon-bedrock-session-attribute` в OpenAPI схемы, чтобы Bedrock автоматически подставлял значения из `sessionAttributes`.

---

## 📋 Что делать (5 минут):

### 1️⃣ Откройте AWS Bedrock Console

Перейдите в ваш Agent → **Action Groups**

---

### 2️⃣ Для каждого из 5 Action Groups:

1. Нажмите **Edit**
2. В разделе **API Schema** выберите **Define with in-line OpenAPI schema editor**
3. Скопируйте соответствующую схему из файла `AI_DIRECTOR_OPENAPI_SCHEMAS.md`
4. **Замените** `YOUR_DEPLOYED_URL` на ваш ngrok URL (например, `https://abc123.ngrok-free.app`)
5. Нажмите **Save**

---

### 3️⃣ Список Action Groups для обновления:

| Action Group | Endpoint | Файл схемы |
|-------------|----------|------------|
| `get_deals_data` | `/api/ai-director/data/deals` | Схема #1 |
| `get_leads_data` | `/api/ai-director/data/leads` | Схема #2 |
| `get_workers_data` | `/api/ai-director/data/workers` | Схема #3 |
| `get_analytics_data` | `/api/ai-director/data/analytics` | Схема #4 |
| `get_gallery_data` | `/api/ai-director/data/gallery` | Схема #5 |

---

## 🔑 Ключевые изменения в схемах:

### ✅ Добавлено для `company_id`:

```yaml
parameters:
  - name: company_id
    in: query
    required: true
    schema:
      type: string
    description: ID компании (берётся из session attributes)
    x-amazon-bedrock-session-attribute: company_id  # ← ЭТО ВАЖНО!
```

### ✅ Добавлено для `api_token`:

```yaml
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: x-api-token
      x-amazon-bedrock-session-attribute: api_token  # ← ЭТО ВАЖНО!
```

---

## ⚡ После обновления схем:

1. **Подождите 1-2 минуты**, пока AWS Bedrock обновит конфигурацию
2. **Перезапустите чат** в CRM (обновите страницу `/app/admin/ai-director`)
3. **Попробуйте снова**:

```
Сколько у нас открытых сделок?
```

---

## ✅ Ожидаемый результат:

Агент **больше не будет спрашивать** `company_id` и сразу вернёт данные:

```
У вас 12 открытых сделок:
- 5 на этапе "Переговоры"
- 4 на этапе "Контракт"
- 3 на этапе "Производство"
```

---

## 🔍 Если всё ещё не работает:

### 1. Проверьте логи AWS Bedrock:

- AWS Console → Bedrock → Agents → ваш агент → **Test**
- Нажмите **View logs** и посмотрите, что передаётся в Action Groups

### 2. Проверьте логи вашего сервера:

В терминале с `npm run dev` должны быть запросы:

```
GET /api/ai-director/data/deals?company_id=xxx&status=negotiation
```

### 3. Проверьте ngrok:

Убедитесь, что ngrok работает:

```bash
curl https://your-ngrok-url.ngrok-free.app/api/ai-director/data/deals?company_id=test
```

Должен вернуться `401 Unauthorized` (это нормально, значит endpoint доступен).

---

## 📚 Полные схемы:

Все 5 обновлённых OpenAPI схем находятся в файле:

**`AI_DIRECTOR_OPENAPI_SCHEMAS.md`**

---

## 🎉 После успешной настройки:

Агент сможет:

- ✅ Получать данные о сделках, лидах, работниках
- ✅ Анализировать аналитику
- ✅ Давать рекомендации на основе реальных данных
- ✅ Автоматически использовать `company_id` из сессии

---

## 💡 Совет:

После того, как всё заработает, можете **задеплоить на Vercel** вместо ngrok:

1. `git add .`
2. `git commit -m "Add AI Director integration"`
3. `git push`
4. Обновите URL в Action Groups на Vercel URL
5. Добавьте `AI_DIRECTOR_API_TOKEN` в Vercel Environment Variables

Тогда не нужно будет держать ngrok запущенным!

---

## 📞 Нужна помощь?

Если что-то не работает, покажите:

1. Скриншот из AWS Bedrock Console (Action Group configuration)
2. Логи из терминала с `npm run dev`
3. Ответ агента в чате

Я помогу разобраться! 🚀


