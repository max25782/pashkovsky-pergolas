# Быстрый старт: Amazon Bedrock + MCP

## 🚀 Шаги настройки (5 минут)

### 1. Установите зависимости MCP сервера

```bash
cd mcp-servers
npm install
cd ..
```

### 2. Получите данные вашего Bedrock агента

Вам понадобятся:
- **AWS Region** (например: `us-east-1`)
- **AWS Access Key ID** и **Secret Access Key**
- **Bedrock Agent ID** (из AWS Console → Bedrock → Agents)
- **Agent Alias ID** (обычно `TSTALIASID` для тестового)

### 3. Настройте переменные окружения

Добавьте в `.env.local` в корне проекта:

```bash
# Amazon Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_AGENT_ID=ABC123...
BEDROCK_AGENT_ALIAS_ID=TSTALIASID
```

### 4. Настройте Cursor MCP

**Вариант A: Через файл конфигурации (рекомендуется)**

Создайте `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "bedrock-agent": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "mcp-servers/bedrock-server.ts"
      ],
      "env": {
        "AWS_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "ваш_access_key",
        "AWS_SECRET_ACCESS_KEY": "ваш_secret_key",
        "BEDROCK_AGENT_ID": "ваш_agent_id",
        "BEDROCK_AGENT_ALIAS_ID": "TSTALIASID"
      }
    }
  }
}
```

**Вариант B: Через настройки Cursor**

1. Откройте Cursor Settings (Cmd/Ctrl + ,)
2. Найдите "MCP Servers" или "Model Context Protocol"
3. Добавьте новый сервер с теми же параметрами

### 5. Перезапустите Cursor

Полностью закройте и откройте Cursor заново.

### 6. Проверка

После перезапуска я смогу использовать ваш Bedrock агент через инструмент `invoke_bedrock_agent`.

## 🔍 Как проверить, что всё работает?

1. **Проверьте логи Cursor:**
   - View → Output → выберите "MCP" в списке
   - Должны быть сообщения о подключении к `bedrock-agent`

2. **Попробуйте вызвать агента:**
   - Я смогу использовать инструмент автоматически
   - Или вы можете спросить меня что-то, что требует вызова Bedrock

## 🛠 Устранение проблем

### "Command not found: tsx"
```bash
# Установите tsx глобально или используйте npx
npm install -g tsx
# или в mcp-servers:
cd mcp-servers && npm install
```

### "AWS credentials not configured"
- Проверьте, что все переменные окружения установлены
- Убедитесь, что `.env.local` загружается (перезапустите dev сервер)

### "Access Denied" от AWS
- Проверьте права IAM пользователя
- Убедитесь, что есть права на `bedrock:InvokeAgent`

### MCP сервер не запускается
```bash
# Проверьте вручную:
cd mcp-servers
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export BEDROCK_AGENT_ID=...
npm start
```

## 📝 Дополнительная информация

- Полная инструкция: `BEDROCK_MCP_SETUP.md`
- MCP сервер код: `mcp-servers/bedrock-server.ts`
- Использование в коде: `apps/crm/lib/ai/bedrock-client.ts`

