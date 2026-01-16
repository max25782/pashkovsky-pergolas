# Исправление ошибки "The security token included in the request is invalid"

## Проблема

AI Director возвращает ошибку: **"The security token included in the request is invalid."**

Это означает, что Bedrock Agent не может аутентифицироваться при вызове Data API endpoints (`/api/ai-director/data/*`).

## Причина

Bedrock Agent получает `api_token` в `sessionAttributes`, но когда он делает HTTP запросы к нашему API, он должен передавать этот токен в заголовке `x-api-token`.

## Решение

### Шаг 1: Убедитесь, что `AI_DIRECTOR_API_TOKEN` установлен

Проверьте переменные окружения в `.env.local` (локально) или в Vercel (production):

```env
AI_DIRECTOR_API_TOKEN=your-secret-token-here
```

**Важно:** Токен должен быть:
- Длинным и случайным (минимум 32 символа)
- Одинаковым в CRM и в конфигурации Bedrock Agent (если используется Lambda proxy)

### Шаг 2: Проверьте конфигурацию Bedrock Agent в AWS Console

Bedrock Agent должен быть настроен для использования `api_token` из `sessionAttributes` при вызове API.

1. Откройте AWS Bedrock Console → Agents
2. Выберите ваш Agent
3. Проверьте Action Groups / API Schema
4. Убедитесь, что в OpenAPI схеме указано использование заголовка `x-api-token`

**Пример OpenAPI схемы для Action Group:**

```yaml
openapi: 3.0.0
info:
  title: CRM Data API
  version: 1.0.0
servers:
  - url: https://crm.pashkovsky-group.com
paths:
  /api/ai-director/data/deals:
    get:
      summary: Get deals data
      parameters:
        - name: company_id
          in: query
          required: true
          schema:
            type: string
        - name: x-api-token
          in: header
          required: true
          schema:
            type: string
            # Bedrock will use api_token from sessionAttributes
      responses:
        '200':
          description: Success
```

### Шаг 3: Настройте Bedrock Agent для использования sessionAttributes

В конфигурации Action Group, убедитесь, что:

1. **API Schema** использует переменную из `sessionAttributes`:
   - `api_token` → заголовок `x-api-token`
   - `api_base_url` → базовый URL для запросов

2. **Lambda Function** (если используется):
   - Должна читать `api_token` из `sessionAttributes`
   - Передавать его в заголовке `x-api-token` при вызове CRM API

### Шаг 4: Проверьте логи

После исправления, проверьте логи в:
- **Vercel Logs** (для CRM API)
- **CloudWatch Logs** (для Bedrock Agent / Lambda)

Вы должны увидеть:
```
[AI Director Auth] Token validation passed
```

Вместо:
```
[AI Director Auth] Token validation failed: ...
```

## Альтернативное решение: Отключить проверку токена (только для тестирования)

Если нужно временно отключить проверку токена для отладки:

**В `apps/crm/lib/middleware/ai-director-auth.ts`:**

```typescript
export function requireAIDirectorAuth(req: NextRequest): NextResponse | null {
  // TEMPORARY: Skip auth check for debugging
  if (process.env.NODE_ENV === 'development') {
    console.warn('[AI Director Auth] ⚠️ AUTH CHECK DISABLED IN DEVELOPMENT')
    return null
  }
  
  // ... rest of the code
}
```

**⚠️ ВНИМАНИЕ:** Никогда не отключайте проверку токена в production!

## Проверка

После настройки:

1. Откройте AI Director в CRM
2. Отправьте сообщение (например: "כמה עסקאות פתוחות יש לנו?")
3. Проверьте, что запрос проходит без ошибки "invalid token"
4. Проверьте логи, что токен валидируется успешно

## Диагностика

Если проблема сохраняется, проверьте:

1. **Токен установлен?**
   ```bash
   # В терминале проекта
   echo $AI_DIRECTOR_API_TOKEN
   # Должен показать токен (не пусто)
   ```

2. **Токен передается в sessionAttributes?**
   - Проверьте логи CRM: `[AI Director] Session attributes:`
   - Должно быть: `api_token: '***XXXX'` (не 'MISSING')

3. **Bedrock Agent использует токен?**
   - Проверьте CloudWatch Logs для Bedrock Agent
   - Должны быть запросы с заголовком `x-api-token`

4. **Токен совпадает?**
   - Токен в CRM (`AI_DIRECTOR_API_TOKEN`)
   - Токен в Bedrock Agent конфигурации
   - Должны быть **одинаковыми**

