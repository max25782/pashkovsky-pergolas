# 🚀 Финальная настройка AI Director

## ✅ Что уже готово:

- ✅ Все API endpoints созданы
- ✅ База данных настроена
- ✅ Bedrock Agent создан
- ✅ Мультиязычность добавлена (EN, HE, RU)
- ✅ Сервер запущен

---

## 📋 Осталось сделать (10 минут):

### 1️⃣ Обновить OpenAPI схемы (5 минут)

Для каждого из **5 Action Groups** в AWS Bedrock Console:

1. Откройте **AWS Bedrock Console** → **Agents** → ваш Agent → **Action Groups**
2. Для каждого Action Group нажмите **Edit**
3. Скопируйте схему из файла **`AI_DIRECTOR_OPENAPI_SCHEMAS.md`**
4. **Замените** `YOUR_DEPLOYED_URL` на ваш ngrok URL
5. Нажмите **Save**

**Список Action Groups:**

| # | Action Group | Endpoint |
|---|-------------|----------|
| 1 | `get_deals_data` | `/api/ai-director/data/deals` |
| 2 | `get_leads_data` | `/api/ai-director/data/leads` |
| 3 | `get_workers_data` | `/api/ai-director/data/workers` |
| 4 | `get_analytics_data` | `/api/ai-director/data/analytics` |
| 5 | `get_gallery_data` | `/api/ai-director/data/gallery` |

---

### 2️⃣ Обновить System Prompt (2 минуты)

1. Откройте **AWS Bedrock Console** → **Agents** → ваш Agent
2. Нажмите **Edit**
3. В разделе **Instructions** скопируйте промпт из файла:
   
   **`AI_DIRECTOR_MULTILINGUAL_PROMPT.md`**

4. Нажмите **Save**

---

### 3️⃣ Подождать 1-2 минуты

AWS Bedrock обновляет конфигурацию агента.

---

### 4️⃣ Протестировать! (3 минуты)

Откройте чат AI Director: `http://localhost:3001/app/admin/ai-director`

Попробуйте на разных языках:

#### 🇬🇧 English:
```
How many open deals do we have?
```

#### 🇮🇱 עברית:
```
כמה עסקאות פתוחות יש לנו?
```

#### 🇷🇺 Русский:
```
Сколько у нас открытых сделок?
```

---

## ✅ Ожидаемый результат:

Агент должен:

1. ✅ **Не спрашивать** `company_id` (берётся автоматически)
2. ✅ **Отвечать на том же языке**, на котором вы написали
3. ✅ **Возвращать реальные данные** из CRM
4. ✅ **Давать рекомендации** на основе данных

---

## 📚 Созданные файлы-инструкции:

| Файл | Описание |
|------|----------|
| `AI_DIRECTOR_OPENAPI_SCHEMAS.md` | Все 5 OpenAPI схем для Action Groups |
| `AI_DIRECTOR_MULTILINGUAL_PROMPT.md` | Обновлённый System Prompt с мультиязычностью |
| `AI_DIRECTOR_FIX_RU.md` | Исправление проблемы с `company_id` |
| `AI_DIRECTOR_LANGUAGE_RU.md` | Краткая инструкция по мультиязычности |
| **`AI_DIRECTOR_FINAL_SETUP_RU.md`** | **Эта финальная инструкция** |

---

## 🔍 Если что-то не работает:

### Проблема 1: Агент спрашивает `company_id`

**Решение:** Обновите OpenAPI схемы (шаг 1️⃣)

---

### Проблема 2: Агент отвечает не на том языке

**Решение:** Обновите System Prompt (шаг 2️⃣)

---

### Проблема 3: Агент не может получить данные

**Проверьте:**

1. ✅ ngrok работает: `curl https://your-ngrok-url.ngrok-free.app/api/ai-director/data/deals`
2. ✅ Токен правильный: `echo $AI_DIRECTOR_API_TOKEN` в терминале
3. ✅ Сервер запущен: `npm run dev` в `apps/crm`

---

### Проблема 4: Ошибка 500 в чате

**Посмотрите логи:**

1. В терминале с `npm run dev`
2. В AWS Bedrock Console → Agent → **Test** → **View logs**

---

## 🎯 Следующие шаги (опционально):

### 1. Деплой на Vercel (вместо ngrok)

```bash
git add .
git commit -m "Add AI Director with multilingual support"
git push
```

Затем:
1. Обновите URL в Action Groups на Vercel URL
2. Добавьте `AI_DIRECTOR_API_TOKEN` в Vercel Environment Variables

---

### 2. Добавить больше языков

Обновите функцию `detectLanguage()` в:

**`apps/crm/app/api/ai-director/chat/route.ts`**

И добавьте языки в System Prompt.

---

### 3. Расширить функционал агента

Добавьте новые Action Groups для:
- Создания задач
- Отправки уведомлений
- Генерации отчётов
- Управления календарём

---

## 🎉 Готово!

После выполнения всех шагов у вас будет **полностью рабочий мультиязычный AI Director**, который:

- ✅ Анализирует данные CRM
- ✅ Даёт стратегические рекомендации
- ✅ Отвечает на английском, иврите и русском
- ✅ Автоматически использует контекст компании
- ✅ Сохраняет историю чата

---

## 📞 Нужна помощь?

Если возникли проблемы:

1. Проверьте все шаги в этой инструкции
2. Посмотрите логи (терминал + AWS Console)
3. Покажите скриншоты/логи для диагностики

Удачи! 🚀


