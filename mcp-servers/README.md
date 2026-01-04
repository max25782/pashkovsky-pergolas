# MCP Server for Amazon Bedrock

Этот MCP сервер позволяет Cursor AI автоматически использовать ваш Amazon Bedrock агент без вашего участия.

## Быстрый старт

1. **Установите зависимости:**
   ```bash
   npm install
   ```

2. **Настройте переменные окружения:**
   
   Создайте файл `.env` в корне проекта (или добавьте в `.env.local`):
   ```bash
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key_id
   AWS_SECRET_ACCESS_KEY=your_secret_access_key
   BEDROCK_AGENT_ID=your_agent_id
   BEDROCK_AGENT_ALIAS_ID=TSTALIASID
   ```

3. **Настройте Cursor:**
   
   Скопируйте `.cursor/mcp.example.json` в `.cursor/mcp.json` и заполните реальными значениями:
   ```bash
   cp ../.cursor/mcp.example.json ../.cursor/mcp.json
   # Отредактируйте .cursor/mcp.json с вашими значениями
   ```

4. **Перезапустите Cursor**

## Тестирование сервера

Вы можете протестировать сервер напрямую:

```bash
# Установите переменные окружения
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export BEDROCK_AGENT_ID=your_agent_id

# Запустите сервер
npm start
```

Сервер будет работать через stdio и ожидать MCP протокол сообщений.

## Структура

- `bedrock-server.ts` - Основной MCP сервер
- `package.json` - Зависимости для MCP сервера
- `tsconfig.json` - TypeScript конфигурация

## Поддерживаемые инструменты

1. **invoke_bedrock_agent** - Вызов Bedrock агента с промптом
2. **list_bedrock_agents** - Список доступных агентов (возвращает настроенного)

## Дополнительная информация

См. `../BEDROCK_MCP_SETUP.md` для полной инструкции по настройке.



