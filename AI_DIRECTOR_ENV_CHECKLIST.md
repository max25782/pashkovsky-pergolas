# ✅ Чек-лист переменных окружения для AI Director

## 📋 Проверьте, что в `apps/crm/.env.local` есть:

### 1️⃣ AWS Credentials (обязательно)

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-north-1
```

**Где взять:**
- AWS Console → IAM → Users → pashkovsky-s3 → Security credentials
- Создайте новый Access Key, если его нет

---

### 2️⃣ Bedrock Agent Configuration (обязательно)

```bash
BEDROCK_AGENT_ID=TQWEK0ZAEF
BEDROCK_AGENT_ALIAS_ID=TSTALIASID
```

**Где взять:**
- AWS Console → Bedrock → Agents → ваш Agent
- Agent ID и Alias ID видны в деталях агента

---

### 3️⃣ AI Director API Token (обязательно)

```bash
AI_DIRECTOR_API_TOKEN=518a94b07da593e05b283014e0cc8c73a6752b016fbfcf6c96640627bc38815b
```

**Где взять:**
- Уже сгенерирован: `518a94b07da593e05b283014e0cc8c73a6752b016fbfcf6c96640627bc38815b`
- Или сгенерируйте новый: `openssl rand -hex 32`

---

### 4️⃣ App URL (для Action Groups)

```bash
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app
```

**Где взять:**
- Ваш ngrok URL (если используете ngrok)
- Или `http://localhost:3001` для локальной разработки
- Или ваш Vercel URL после деплоя

---

### 5️⃣ Supabase (уже должно быть)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 🔍 Как проверить:

Откройте терминал и выполните:

```bash
cd apps/crm
cat .env.local | grep -E "AWS_|BEDROCK_|AI_DIRECTOR_|NEXT_PUBLIC_APP_URL"
```

Должны быть все переменные из пунктов 1-4.

---

## ⚠️ Важно:

После добавления/изменения переменных в `.env.local`:

1. **Остановите сервер** (Ctrl+C в терминале)
2. **Перезапустите сервер**:
   ```bash
   npm run dev
   ```
3. **Обновите страницу** в браузере (F5)

---

## 🧪 Тестирование:

После настройки всех переменных попробуйте в чате AI Director:

### На иврите (ваша система на иврите):
```
כמה עסקאות פתוחות יש לנו?
```

### На русском:
```
Сколько у нас открытых сделок?
```

### На английском:
```
How many open deals do we have?
```

---

## 🔧 Если не работает:

### Проблема 1: "Access Denied" или "not authorized"

**Решение:** Добавьте IAM policy для `bedrock:InvokeAgent`

1. AWS Console → IAM → Users → pashkovsky-s3
2. Permissions → Add permissions → Attach policies
3. Найдите `AmazonBedrockFullAccess` или создайте custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeAgent"
      ],
      "Resource": "*"
    }
  ]
}
```

---

### Проблема 2: "company_id not found"

**Решение:** Убедитесь, что вы залогинены в CRM и у вас есть компания.

---

### Проблема 3: Агент спрашивает company_id

**Решение:** Обновите OpenAPI схемы (см. `AI_DIRECTOR_OPENAPI_SCHEMAS.md`)

---

### Проблема 4: Агент отвечает не на том языке

**Решение:** Обновите System Prompt (см. `AI_DIRECTOR_MULTILINGUAL_PROMPT.md`)

---

## 📞 Нужна помощь?

Покажите вывод команды:

```bash
cd apps/crm
cat .env.local | grep -E "AWS_|BEDROCK_|AI_DIRECTOR_" | sed 's/=.*/=***/'
```

Это покажет, какие переменные есть (но скроет их значения).

---

## 🎯 Следующий шаг:

После проверки переменных окружения, следуйте инструкциям в:

**`AI_DIRECTOR_FINAL_SETUP_RU.md`**





