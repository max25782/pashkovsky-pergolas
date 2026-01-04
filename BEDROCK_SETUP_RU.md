# Настройка Amazon Bedrock через MCP

## 🎯 Цель

Настроить ваш Bedrock агент так, чтобы я (AI ассистент) мог использовать его автоматически без вашего участия через MCP (Model Context Protocol).

## 📋 Что нужно сделать

### 1. Установите зависимости

```bash
cd mcp-servers
npm install
cd ..
```

### 2. Получите данные вашего Bedrock агента

Вам нужны:
- **AWS Region** (например: `us-east-1`, `eu-west-1`)
- **AWS Access Key ID** и **Secret Access Key** (из IAM)
- **Bedrock Agent ID** (из AWS Console → Bedrock → Agents)
- **Agent Alias ID** (обычно `TSTALIASID`)

### 3. Добавьте переменные в `.env.local`

В корне проекта создайте/обновите `.env.local`:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=ваш_секретный_ключ
BEDROCK_AGENT_ID=ваш_agent_id
BEDROCK_AGENT_ALIAS_ID=TSTALIASID
```

### 4. Настройте Cursor MCP

**Способ 1: Через файл (проще)**

Создайте `.cursor/mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "bedrock-agent": {
      "command": "npx",
      "args": ["-y", "tsx", "mcp-servers/bedrock-server.ts"],
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

**Способ 2: Через настройки Cursor**

1. Cmd/Ctrl + , → Settings
2. Найдите "MCP Servers"
3. Добавьте новый сервер с теми же параметрами

### 5. Перезапустите Cursor

Полностью закройте и откройте Cursor заново.

## ✅ Готово!

После этого я смогу использовать ваш Bedrock агент через инструмент `invoke_bedrock_agent` автоматически.

## 🔍 Проверка

1. **Логи Cursor:** View → Output → выберите "MCP"
2. Должны быть сообщения о подключении к `bedrock-agent`

## ❓ Проблемы?

### "tsx not found"
```bash
npm install -g tsx
# или
cd mcp-servers && npm install
```

### "AWS credentials not configured"
- Проверьте `.env.local`
- Перезапустите dev сервер

### "Access Denied"
- Проверьте права IAM пользователя
- Нужны права на `bedrock:InvokeAgent`

## 📚 Дополнительно

- Полная инструкция: `BEDROCK_MCP_SETUP.md`
- Быстрый старт: `BEDROCK_QUICKSTART.md`

