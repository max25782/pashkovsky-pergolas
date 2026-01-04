# Настройка прав доступа для AWS Bedrock Agent

## Проблема

```
User: arn:aws:iam::857235179864:user/pashkovsky-s3 is not authorized to perform: bedrock:InvokeAgent
```

Ваш IAM пользователь `pashkovsky-s3` не имеет прав для вызова Bedrock Agent.

## Решение

### Вариант 1: Добавить политику к существующему пользователю (Рекомендуется)

1. Откройте AWS Console → IAM → Users
2. Найдите пользователя `pashkovsky-s3`
3. Перейдите на вкладку "Permissions"
4. Нажмите "Add permissions" → "Attach policies directly"
5. Нажмите "Create policy"
6. Выберите вкладку "JSON" и вставьте:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockAgentAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeAgent",
        "bedrock:GetAgent",
        "bedrock:ListAgents"
      ],
      "Resource": [
        "arn:aws:bedrock:eu-north-1:857235179864:agent/*",
        "arn:aws:bedrock:eu-north-1:857235179864:agent-alias/*/*"
      ]
    }
  ]
}
```

7. Нажмите "Next"
8. Введите имя политики: `BedrockAgentInvokePolicy`
9. Нажмите "Create policy"
10. Вернитесь к пользователю и прикрепите созданную политику

### Вариант 2: Использовать управляемую политику AWS

1. Откройте AWS Console → IAM → Users
2. Найдите пользователя `pashkovsky-s3`
3. Перейдите на вкладку "Permissions"
4. Нажмите "Add permissions" → "Attach policies directly"
5. Найдите и выберите: `AmazonBedrockFullAccess`
6. Нажмите "Add permissions"

**⚠️ Внимание:** `AmazonBedrockFullAccess` даёт полный доступ ко всем функциям Bedrock. Для продакшена рекомендуется использовать Вариант 1 с ограниченными правами.

### Вариант 3: Создать нового IAM пользователя для Bedrock

1. Откройте AWS Console → IAM → Users
2. Нажмите "Create user"
3. Введите имя: `pashkovsky-bedrock`
4. Нажмите "Next"
5. Выберите "Attach policies directly"
6. Найдите и выберите: `AmazonBedrockFullAccess`
7. Нажмите "Next" → "Create user"
8. Перейдите в созданного пользователя → "Security credentials"
9. Нажмите "Create access key"
10. Выберите "Application running outside AWS"
11. Скопируйте Access Key ID и Secret Access Key
12. Обновите `.env.local`:
    ```env
    AWS_ACCESS_KEY_ID=новый_access_key_id
    AWS_SECRET_ACCESS_KEY=новый_secret_access_key
    ```

## Минимальные права для AI-директора

Если вы хотите дать только необходимые права, используйте эту политику:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockAgentInvoke",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeAgent"
      ],
      "Resource": [
        "arn:aws:bedrock:eu-north-1:857235179864:agent-alias/7QWEK0ZAEF/*"
      ]
    }
  ]
}
```

Эта политика разрешает только вызов вашего конкретного агента (ID: `7QWEK0ZAEF`).

## После настройки прав

1. Перезапустите CRM:
   ```bash
   # Ctrl+C для остановки
   cd apps/crm
   npm run dev
   ```

2. Протестируйте AI-директора:
   - Откройте `http://localhost:3001/app/admin/ai-director`
   - Задайте вопрос: "Привет, ты работаешь?"

## Проверка прав

Чтобы проверить, что права настроены правильно, выполните в терминале:

```bash
aws bedrock-agent-runtime invoke-agent \
  --agent-id 7QWEK0ZAEF \
  --agent-alias-id TSTALIASID \
  --session-id test-session \
  --input-text "Hello" \
  --region eu-north-1
```

Если команда выполнится без ошибок, права настроены правильно.

## Troubleshooting

### Ошибка: "Access Denied"
- Убедитесь, что политика прикреплена к правильному пользователю
- Подождите 1-2 минуты для применения изменений в IAM
- Проверьте, что используете правильные Access Key в `.env.local`

### Ошибка: "Agent not found"
- Проверьте, что `BEDROCK_AGENT_ID` в `.env.local` правильный: `7QWEK0ZAEF`
- Убедитесь, что агент находится в регионе `eu-north-1`

### Ошибка: "Invalid credentials"
- Проверьте, что `AWS_ACCESS_KEY_ID` и `AWS_SECRET_ACCESS_KEY` правильные
- Убедитесь, что в `.env.local` нет лишних пробелов или кавычек


