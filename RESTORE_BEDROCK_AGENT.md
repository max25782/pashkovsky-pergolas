# 🔄 Восстановление Bedrock Agent после удаления проекта

## Что произошло?

Когда вы удалили проект в AWS, вместе с ним мог удалиться **Bedrock Agent**. Это нормально - Agent был привязан к проекту.

## ✅ Решение: Создать новый Bedrock Agent

### Шаг 1: Создать новый Agent в AWS Bedrock Console

1. Откройте **AWS Bedrock Console**: https://console.aws.amazon.com/bedrock/
2. Выберите регион: **eu-north-1** (или ваш регион)
3. Перейдите в **Agents** → **Create Agent**
4. Заполните:
   - **Agent name**: `Pashkovsky AI Director` (или любое имя)
   - **Description**: `AI Business Advisor for CRM`
   - **Model**: Выберите модель (например, `Claude Sonnet 3.5` или `Claude 3 Opus`)
   - **Region**: `eu-north-1`

5. Нажмите **Create**

### Шаг 2: Настроить System Prompt (Instructions)

1. В созданном Agent нажмите **Edit**
2. Найдите поле **"Instructions for the Agent"**
3. Скопируйте промпт из файла `AI_DIRECTOR_MULTILINGUAL_PROMPT.md` (строки 10-110)
4. Вставьте в поле Instructions
5. Нажмите **Save**

### Шаг 3: Создать Action Groups

Нужно создать 5 Action Groups для доступа к данным CRM:

#### 3.1. Action Group: `get_deals_data`

1. **Action Groups** → **Create Action Group**
2. **Name**: `get_deals_data`
3. **Description**: `Get deals data from CRM`
4. **Action group type**: `API`
5. **API schema**: Откройте файл `AI_DIRECTOR_OPENAPI_SCHEMAS.md` и скопируйте схему для `get_deals_data`
6. **Важно**: В схеме замените:
   - `YOUR_DEPLOYED_URL` → `https://crm.pashkovsky-group.com`
   - Убедитесь, что есть заголовок `x-api-token` который использует `{{sessionAttributes.api_token}}`
7. Нажмите **Save**

#### 3.2. Повторите для остальных Action Groups:

- `get_leads_data` - Лиды
- `get_workers_data` - Работники
- `get_analytics_data` - Аналитика  
- `get_gallery_data` - Галерея

**Важно для каждого Action Group:**
- В OpenAPI схеме должен быть параметр `company_id` (required: true)
- Должен быть заголовок `x-api-token` со значением `{{sessionAttributes.api_token}}`
- Base URL: `https://crm.pashkovsky-group.com`

### Шаг 4: Подготовить Agent

1. После создания всех Action Groups нажмите **Prepare** (справа вверху)
2. Подождите **2-3 минуты**
3. Статус должен стать **"PREPARED"** (зеленый)

### Шаг 5: Получить Agent ID и Alias ID

1. После подготовки, на главной странице Agent вы увидите:
   - **Agent ID**: например `7QWEK0ZAEF` (скопируйте его!)
   - **Agent Alias ID**: обычно `TSTALIASID` (или создайте новый)

### Шаг 6: Обновить переменные окружения

В `.env.local` или Vercel Environment Variables:

```env
# AWS Bedrock
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=ваш_ключ
AWS_SECRET_ACCESS_KEY=ваш_секрет
BEDROCK_AGENT_ID=НОВЫЙ_AGENT_ID_ИЗ_ШАГА_5
BEDROCK_AGENT_ALIAS_ID=TSTALIASID

# AI Director API Token (сгенерируйте новый!)
AI_DIRECTOR_API_TOKEN=сгенерировать_ниже

# App URL
NEXT_PUBLIC_APP_URL=https://crm.pashkovsky-group.com
```

**Сгенерировать AI_DIRECTOR_API_TOKEN:**
```bash
# В терминале выполните:
openssl rand -hex 32
```

Скопируйте результат и используйте как `AI_DIRECTOR_API_TOKEN`.

### Шаг 7: Настроить Action Groups для использования токена

**КРИТИЧНО:** В каждом Action Group нужно настроить передачу токена:

1. Откройте Action Group → **Edit**
2. В OpenAPI схеме найдите секцию `parameters` или `headers`
3. Добавьте:
```yaml
parameters:
  - name: x-api-token
    in: header
    required: true
    schema:
      type: string
    x-amazon-bedrock-session-attribute: api_token
```

Это автоматически передаст `api_token` из `sessionAttributes` в заголовок `x-api-token`.

### Шаг 8: Перезапустить приложение

```bash
# Остановите сервер (Ctrl+C)
# Запустите снова
npm run dev
```

## ✅ Проверка

После настройки:

1. Откройте AI Director в CRM: `/app/admin/ai-director`
2. Отправьте сообщение: "כמה עסקאות פתוחות יש לנו?"
3. Проверьте логи Vercel - не должно быть ошибок про токен

## 🔍 Если ошибка "invalid token" сохраняется

1. **Проверьте**, что `AI_DIRECTOR_API_TOKEN` установлен в `.env.local` и Vercel
2. **Проверьте**, что в Action Groups используется `x-amazon-bedrock-session-attribute: api_token`
3. **Проверьте логи** Vercel для деталей ошибки
4. **Убедитесь**, что Agent статус = **PREPARED** (не DRAFT)

## 📝 Быстрая проверка конфигурации

Выполните в терминале:
```bash
cd apps/crm
echo "BEDROCK_AGENT_ID: $BEDROCK_AGENT_ID"
echo "AI_DIRECTOR_API_TOKEN: ${AI_DIRECTOR_API_TOKEN:0:10}..."
```

Оба должны быть заполнены!

