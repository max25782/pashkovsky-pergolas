# 🤖 AI Director - Мультиязычный бизнес-советник

## 🎉 Что готово:

### ✅ Весь код реализован:
- ✅ 5 Data API endpoints для CRM данных
- ✅ Middleware для аутентификации
- ✅ Bedrock Client для вызова агента
- ✅ UI страница чата (`/app/admin/ai-director`)
- ✅ База данных (миграция `028_ai_director_sessions.sql`)
- ✅ Мультиязычность бэкенда (автоопределение EN/HE/RU)
- ✅ **Мультиязычный UI интерфейс** (EN/HE/RU с RTL поддержкой)
- ✅ Все переменные окружения настроены

### ✅ Сервер работает:
- 🟢 `http://localhost:3001` - CRM
- 🟢 `http://localhost:3000` - Public Site

---

## ⏳ Что нужно сделать в AWS Console (10 минут):

### 1️⃣ Обновить OpenAPI Schemas для 5 Action Groups

**Файл:** [`AI_DIRECTOR_OPENAPI_SCHEMAS.md`](./AI_DIRECTOR_OPENAPI_SCHEMAS.md)

Для каждого Action Group:
1. AWS Bedrock Console → Agents → ваш Agent → Action Groups
2. Edit → скопировать схему из файла
3. Заменить `YOUR_DEPLOYED_URL` на ngrok URL
4. Save

---

### 2️⃣ Обновить System Prompt

**Файл:** [`AI_DIRECTOR_MULTILINGUAL_PROMPT.md`](./AI_DIRECTOR_MULTILINGUAL_PROMPT.md)

1. AWS Bedrock Console → Agents → ваш Agent → Edit
2. Instructions → скопировать промпт из файла
3. Save

---

## 🧪 Тестирование:

Откройте: `http://localhost:3001/app/admin/ai-director`

Попробуйте на разных языках:

```
🇬🇧 How many open deals do we have?
🇮🇱 כמה עסקאות פתוחות יש לנו?
🇷🇺 Сколько у нас открытых сделок?
```

**Ожидаемый результат:**
- ✅ Агент не спрашивает `company_id`
- ✅ Отвечает на том же языке
- ✅ Возвращает реальные данные из CRM

---

## 📚 Документация:

| Файл | Описание | Язык |
|------|----------|------|
| **[AI_DIRECTOR_SETUP_HE.md](./AI_DIRECTOR_SETUP_HE.md)** | **Быстрый старт** | 🇮🇱 עברית |
| **[AI_DIRECTOR_FINAL_SETUP_RU.md](./AI_DIRECTOR_FINAL_SETUP_RU.md)** | **Полная инструкция** | 🇷🇺 Русский |
| **[AI_DIRECTOR_FRONTEND_I18N.md](./AI_DIRECTOR_FRONTEND_I18N.md)** | **Мультиязычный UI** | 🇷🇺 Русский |
| [AI_DIRECTOR_OPENAPI_SCHEMAS.md](./AI_DIRECTOR_OPENAPI_SCHEMAS.md) | OpenAPI схемы для Action Groups | 🇬🇧 English |
| [AI_DIRECTOR_MULTILINGUAL_PROMPT.md](./AI_DIRECTOR_MULTILINGUAL_PROMPT.md) | System Prompt для агента | 🇬🇧 English |
| [AI_DIRECTOR_LANGUAGE_RU.md](./AI_DIRECTOR_LANGUAGE_RU.md) | Инструкция по мультиязычности бэкенда | 🇷🇺 Русский |
| [AI_DIRECTOR_ENV_CHECKLIST.md](./AI_DIRECTOR_ENV_CHECKLIST.md) | Чек-лист переменных окружения | 🇷🇺 Русский |
| [AI_DIRECTOR_SUMMARY_RU.md](./AI_DIRECTOR_SUMMARY_RU.md) | Краткая сводка | 🇷🇺 Русский |

---

## 🚀 Быстрый старт:

### Для пользователей на иврите:
👉 **[AI_DIRECTOR_SETUP_HE.md](./AI_DIRECTOR_SETUP_HE.md)** 🇮🇱

### Для пользователей на русском:
👉 **[AI_DIRECTOR_FINAL_SETUP_RU.md](./AI_DIRECTOR_FINAL_SETUP_RU.md)** 🇷🇺

---

## 🔧 Решение проблем:

### Проблема: "Access Denied" или "not authorized"

**Решение:** Добавьте IAM policy для `bedrock:InvokeAgent`

1. AWS Console → IAM → Users → pashkovsky-s3
2. Permissions → Add permissions → Attach policies
3. Найдите `AmazonBedrockFullAccess`

---

### Проблема: Агент спрашивает `company_id`

**Решение:** Обновите OpenAPI схемы (добавьте `x-amazon-bedrock-session-attribute`)

---

### Проблема: Агент отвечает не на том языке

**Решение:** Обновите System Prompt (добавьте инструкции по языку)

---

## 🎯 Архитектура:

```
┌─────────────────────────────────────────────────────────────┐
│                         User (Browser)                       │
│                  http://localhost:3001/app/admin/ai-director │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    CRM API (Next.js)                         │
│  /api/ai-director/chat                                       │
│  - Определяет язык (detectLanguage)                          │
│  - Передаёт company_id, api_token, user_language             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  AWS Bedrock Agent                           │
│  - Получает sessionAttributes (company_id, language)         │
│  - Вызывает Action Groups для получения данных               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              5 Data API Endpoints (CRM)                      │
│  - /api/ai-director/data/deals                               │
│  - /api/ai-director/data/leads                               │
│  - /api/ai-director/data/workers                             │
│  - /api/ai-director/data/analytics                           │
│  - /api/ai-director/data/gallery                             │
│  (Защищены AI_DIRECTOR_API_TOKEN)                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                     │
│  - deals, leads, workers, work_shifts                        │
│  - gallery_categories, gallery_images, pergola_projects      │
│  - ai_sessions (история чата)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Возможности AI Director:

### 📈 Аналитика:
- Количество открытых сделок по статусам
- Конверсия лидов за период
- Производительность работников
- Тренды по неделям/месяцам

### ⚠️ Риски и узкие места:
- Сделки, требующие внимания
- Лиды без активности
- Перегруженные работники

### 💡 Рекомендации:
- Приоритизация задач
- Оптимизация процессов
- Улучшение конверсии

### 🌍 Мультиязычность:
- Автоматическое определение языка
- Ответы на EN, HE, RU
- Легко добавить новые языки

---

## 🔐 Безопасность:

- ✅ JWT аутентификация для пользователей
- ✅ Token-based auth для AI Director API
- ✅ Multi-tenancy (изоляция по company_id)
- ✅ AWS IAM для Bedrock Agent
- ✅ Переменные окружения для секретов

---

## 🚀 Деплой на Vercel:

После успешного тестирования:

```bash
git add .
git commit -m "Add AI Director with multilingual support"
git push
```

Затем:
1. Обновите URL в Action Groups на Vercel URL
2. Добавьте переменные окружения в Vercel:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `BEDROCK_AGENT_ID`
   - `BEDROCK_AGENT_ALIAS_ID`
   - `AI_DIRECTOR_API_TOKEN`

---

## 💡 Расширение функционала:

### Идеи для будущих улучшений:

1. **Больше Action Groups:**
   - Создание задач
   - Отправка уведомлений
   - Генерация отчётов
   - Управление календарём

2. **Больше языков:**
   - Арабский
   - Китайский
   - Испанский

3. **Интеграции:**
   - Email (SendGrid)
   - SMS (Twilio)
   - Calendar (Google Calendar)
   - Slack notifications

4. **Расширенная аналитика:**
   - Прогнозирование продаж
   - Анализ трендов
   - Рекомендации по ценообразованию

---

## 📞 Поддержка:

Если возникли проблемы:

1. Проверьте логи в терминале (`npm run dev`)
2. Проверьте логи в AWS Bedrock Console (Test → View logs)
3. Откройте соответствующий файл документации
4. Проверьте чек-лист переменных окружения

---

## 🎉 Готово!

AI Director готов к использованию! Следуйте инструкциям в файлах документации для завершения настройки в AWS Console.

**Удачи! 🚀**

