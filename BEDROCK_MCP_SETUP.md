# Настройка Amazon Bedrock через MCP

Это руководство поможет вам настроить Amazon Bedrock агента для использования через MCP (Model Context Protocol) в Cursor.

## Шаг 1: Установка зависимостей

```bash
cd mcp-servers
npm install
```

## Шаг 2: Настройка переменных окружения

Добавьте в ваш `.env.local` (или `.env` в корне проекта):

```bash
# Amazon Bedrock Configuration
AWS_REGION=us-east-1  # или ваш регион
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
BEDROCK_AGENT_ID=your_agent_id
BEDROCK_AGENT_ALIAS_ID=TSTALIASID  # или ваш alias ID
```

### Как получить эти значения:

1. **AWS_REGION**: Регион, где создан ваш Bedrock агент (например, `us-east-1`, `eu-west-1`)

2. **AWS_ACCESS_KEY_ID** и **AWS_SECRET_ACCESS_KEY**: 
   - Перейдите в AWS Console → IAM → Users → Create User
   - Создайте пользователя с правами на Bedrock
   - Создайте Access Key и сохраните значения

3. **BEDROCK_AGENT_ID**:
   - Перейдите в AWS Console → Amazon Bedrock → Agents
   - Найдите ваш агент и скопируйте Agent ID

4. **BEDROCK_AGENT_ALIAS_ID**:
   - В разделе вашего агента найдите Aliases
   - Обычно используется `TSTALIASID` для тестового окружения
   - Или создайте новый alias и используйте его ID

## Шаг 3: Настройка MCP в Cursor

### Вариант 1: Через конфигурационный файл (рекомендуется)

Создайте файл `.cursor/mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "bedrock-agent": {
      "command": "tsx",
      "args": [
        "mcp-servers/bedrock-server.ts"
      ],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "your_access_key_id",
        "AWS_SECRET_ACCESS_KEY": "your_secret_access_key",
        "BEDROCK_AGENT_ID": "your_agent_id",
        "BEDROCK_AGENT_ALIAS_ID": "TSTALIASID"
      }
    }
  }
}
```

**⚠️ ВАЖНО**: Файл `.cursor/mcp.json` может быть в `.gitignore`. Если вы хотите использовать переменные окружения, используйте синтаксис `${VAR_NAME}`.

### Вариант 2: Через настройки Cursor

1. Откройте Cursor Settings (Cmd/Ctrl + ,)
2. Найдите раздел "MCP Servers" или "Model Context Protocol"
3. Добавьте новый сервер:
   - **Name**: `bedrock-agent`
   - **Command**: `tsx`
   - **Args**: `["mcp-servers/bedrock-server.ts"]`
   - **Environment Variables**: Добавьте все переменные из шага 2

## Шаг 4: Проверка работы

После настройки перезапустите Cursor. MCP сервер должен автоматически запуститься.

Проверить можно:
1. В Cursor должен появиться доступ к инструменту `invoke_bedrock_agent`
2. Я смогу вызывать ваш Bedrock агент напрямую без вашего участия

## Шаг 5: Использование в коде (опционально)

Если вы хотите использовать Bedrock напрямую в коде (не через MCP), используйте:

```typescript
import { callBedrockAgent, isBedrockConfigured } from '@/lib/ai/bedrock-client'

if (isBedrockConfigured()) {
  const response = await callBedrockAgent({
    prompt: 'Ваш вопрос к агенту',
    sessionId: 'optional-session-id', // для поддержания контекста
  })
  
  if (response.error) {
    console.error('Bedrock error:', response.error)
  } else {
    console.log('Bedrock response:', response.content)
  }
}
```

## Устранение неполадок

### Ошибка: "BEDROCK_AGENT_ID environment variable is not set"
- Проверьте, что все переменные окружения установлены
- Убедитесь, что `.env.local` загружается правильно

### Ошибка: "Access Denied" или "Unauthorized"
- Проверьте права доступа IAM пользователя
- Убедитесь, что у пользователя есть права на `bedrock:InvokeAgent`

### MCP сервер не запускается
- Убедитесь, что установлены все зависимости: `cd mcp-servers && npm install`
- Проверьте, что TypeScript компилируется: `npx tsx bedrock-server.ts`

### Cursor не видит MCP сервер
- Перезапустите Cursor полностью
- Проверьте логи Cursor (View → Output → MCP)
- Убедитесь, что путь к серверу правильный

## Безопасность

⚠️ **ВАЖНО**: 
- Никогда не коммитьте `.env.local` или `.cursor/mcp.json` с реальными ключами в Git
- Используйте переменные окружения в production
- Ротация ключей AWS каждые 90 дней

## Дополнительная информация

- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

