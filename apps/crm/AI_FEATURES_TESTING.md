# AI Features Testing Guide

## 🎯 Обзор реализованных AI функций

Все функции используют **Gemini 2.0 Flash** API и интегрированы в CRM и Site.

---

## 1. 💬 AI Chat на сайте (Site)

### Что реализовано:
- Публичный API endpoint: `/api/public/ai-chat` (в CRM)
- ChatWidget компонент на сайте
- Поддержка текста и изображений
- Rate limiting (IP-based)
- Сохранение истории чата в Supabase

### Как тестировать:

1. **Запустите Site приложение:**
   ```bash
   cd apps/site
   npm run dev
   ```

2. **Откройте браузер:** `http://localhost:3000`

3. **Проверьте ChatWidget:**
   - ✅ Виден floating button внизу слева
   - ✅ Кликните - открывается chat window
   - ✅ Напишите "איזה פרגולות יש?" - должен ответить AI
   - ✅ Загрузите изображение - должен проанализировать
   - ✅ Закройте и откройте - история должна сохраниться

4. **Проверьте Rate Limiting:**
   - Отправьте много сообщений подряд
   - После лимита (по умолчанию 20/час) должно появиться сообщение об ошибке

### API Endpoint:
```http
POST http://localhost:3001/api/public/ai-chat
Headers:
  x-site-token: <CRM_SITE_TOKEN>
Body (FormData):
  message: "שלום!"
  clientId: "client_123"
  image: [File] (опционально)
```

### Переменные окружения (apps/site/.env.local):
```env
NEXT_PUBLIC_CRM_API_URL=http://localhost:3001
NEXT_PUBLIC_CRM_SITE_TOKEN=your_site_token_here
```

---

## 2. ✨ AI улучшение текста в офферах (CRM)

### Что реализовано:
- API endpoint: `/api/ai/improve-offer-text`
- Кнопка "✨ AI שיפור" в форме офферов
- Автоматическое предложение улучшенного текста
- Сохранение цифр и мидот без изменений

### Как тестировать:

1. **Запустите CRM:**
   ```bash
   cd apps/crm
   npm run dev
   ```

2. **Войдите в систему:** `http://localhost:3001/login`

3. **Откройте Deals → Создать Deal → Создать Offer:**
   - Заполните основные поля (имя клиента, размеры)
   - Прокрутите вниз до секции "הערות נוספות"

4. **Проверьте AI улучшение:**
   - Напишите простой текст: "פרגולה בצבע שחור"
   - Кликните "✨ AI שיפור"
   - ✅ Должна появиться карточка с улучшенным текстом
   - ✅ Текст должен быть более профессиональным
   - ✅ Кнопки "✓ קבל" и "✕ דחה" работают

5. **Проверьте сохранение цифр:**
   - Напишите: "פרגולה 4x6 מטר במחיר 20000 שקל"
   - Кликните "✨ AI שיפור"
   - ✅ Цифры 4, 6, 20000 не должны измениться

### API Endpoint:
```http
POST http://localhost:3001/api/ai/improve-offer-text
Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
Body:
{
  "text": "פרגולה בצבע שחור",
  "context": {
    "customerName": "משה כהן",
    "pergolaType": "אלומיניום",
    "price": 25000
  }
}
```

---

## 3. 📊 AI еженедельные отчеты (CRM)

### Что реализовано:
- API endpoint: `/api/ai/reports/weekly`
- Автоматический сбор данных за неделю
- AI анализ и рекомендации
- Markdown формат

### Как тестировать:

1. **Убедитесь, что в БД есть данные:**
   - Несколько deals за текущую неделю
   - Несколько leads
   - Хотя бы один worker shift

2. **Вызовите API:**
   ```bash
   curl -X GET "http://localhost:3001/api/ai/reports/weekly" \
     -H "Authorization: Bearer <JWT_TOKEN>"
   ```

3. **Проверьте ответ:**
   - ✅ Содержит секцию "data" с числовыми данными
   - ✅ Содержит секцию "report" с Markdown текстом
   - ✅ Отчет на иврите
   - ✅ Есть секции: Сиккум, Некудот Хазакот, Атгарим, Тавнот AI, Амлацот

4. **Тест с конкретной неделей:**
   ```bash
   curl -X GET "http://localhost:3001/api/ai/reports/weekly?week=2025-W01" \
     -H "Authorization: Bearer <JWT_TOKEN>"
   ```

### Структура ответа:
```json
{
  "week": "2025-W01",
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-07"
  },
  "data": {
    "deals": { ... },
    "leads": { ... },
    "workers": { ... },
    "financial": { ... }
  },
  "report": "# דוח שבועי\n\n## סיכום ביצועים...",
  "generatedAt": "2025-12-29T..."
}
```

---

## 4. 📈 AI ежемесячные отчеты (CRM)

### Что реализовано:
- API endpoint: `/api/ai/reports/monthly`
- Сбор данных за месяц
- Сравнение с предыдущим месяцем
- Расширенный AI анализ с трендами и прогнозами

### Как тестировать:

1. **Убедитесь, что в БД есть данные за 2 месяца**

2. **Вызовите API:**
   ```bash
   curl -X GET "http://localhost:3001/api/ai/reports/monthly" \
     -H "Authorization: Bearer <JWT_TOKEN>"
   ```

3. **Проверьте ответ:**
   - ✅ Содержит "comparison" с процентами изменений
   - ✅ Отчет более детальный, чем weekly
   - ✅ Есть секция "ניתוח השוואתי" (сравнительный анализ)
   - ✅ Есть прогноз на следующий месяц

4. **Тест с конкретным месяцем:**
   ```bash
   curl -X GET "http://localhost:3001/api/ai/reports/monthly?month=2025-01" \
     -H "Authorization: Bearer <JWT_TOKEN>"
   ```

### Структура ответа:
```json
{
  "month": "2025-01",
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "data": {
    "deals": { ... },
    "leads": { ... },
    "workers": { ... },
    "financial": { ... },
    "comparison": {
      "deals": { "change": 15.5, "trend": "up" },
      "revenue": { "change": 22.3, "trend": "up" },
      "profit": { "change": -5.2, "trend": "down" },
      "leads": { "change": 8.1, "trend": "up" }
    }
  },
  "report": "# דוח חודשי\n\n## 📊 סיכום ביצועים...",
  "generatedAt": "2025-12-29T..."
}
```

---

## 🔧 Общие требования для всех функций

### Переменные окружения (apps/crm/.env.local):
```env
# Gemini API
GEMINI_API_KEY=AIza...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# CRM
DEFAULT_COMPANY_ID=uuid-here
CRM_SITE_TOKEN=your_secret_token_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Проверка конфигурации:
```bash
# В CRM
curl http://localhost:3001/api/ai/improve-offer-text
# Должен вернуть: {"service":"AI Offer Text Improvement","status":"available","model":"gemini-2.0-flash"}
```

---

## 🐛 Troubleshooting

### 1. ChatWidget не появляется на сайте
- Проверьте console.log в браузере
- Убедитесь, что `NEXT_PUBLIC_CRM_API_URL` настроен
- Проверьте CORS в CRM (должен разрешать `NEXT_PUBLIC_SITE_URL`)

### 2. AI не отвечает / ошибка 500
- Проверьте `GEMINI_API_KEY` в `.env.local`
- Убедитесь, что ключ активен: https://aistudio.google.com/apikey
- Проверьте лимиты API в Google Cloud Console

### 3. Unauthorized errors
- Проверьте JWT токен в localStorage
- Убедитесь, что пользователь в `company_members`
- Для site: проверьте `CRM_SITE_TOKEN`

### 4. Пустые отчеты
- Убедитесь, что в БД есть данные за нужный период
- Проверьте `company_id` в запросе
- Проверьте фильтры по датам в SQL

---

## ✅ Checklist финального тестирования

### Site (apps/site):
- [ ] ChatWidget виден на главной странице
- [ ] Открывается по клику
- [ ] Отправляет текстовые сообщения
- [ ] Отправляет изображения
- [ ] Сохраняет историю между сессиями
- [ ] Rate limiting работает
- [ ] Анимации плавные
- [ ] Работает на мобильных устройствах

### CRM - Offers (apps/crm):
- [ ] Кнопка "✨ AI שיפור" видна в форме
- [ ] Кликается только при наличии текста
- [ ] Показывает loading state
- [ ] Отображает AI suggestion
- [ ] Кнопки "קבל" и "דחה" работают
- [ ] Цифры не изменяются
- [ ] Текст улучшается (становится профессиональнее)

### CRM - Reports (apps/crm):
- [ ] `/api/ai/reports/weekly` возвращает отчет
- [ ] Отчет на иврите
- [ ] Содержит числовые данные
- [ ] Содержит AI инсайты
- [ ] `/api/ai/reports/monthly` возвращает отчет
- [ ] Месячный отчет содержит сравнение
- [ ] Можно запросить отчет за прошлый период

---

## 🚀 Запуск всех сервисов

### Терминал 1: CRM
```bash
cd apps/crm
npm run dev
```

### Терминал 2: Site
```bash
cd apps/site
npm run dev
```

### Доступ:
- **CRM:** http://localhost:3001
- **Site:** http://localhost:3000
- **Supabase:** https://supabase.com/dashboard/project/kvqupacmdishpfnscnio

---

## 📞 Поддержка

Если что-то не работает:
1. Проверьте console.log в браузере (F12)
2. Проверьте логи в терминале где запущен dev server
3. Проверьте `.env.local` файлы
4. Убедитесь, что Supabase tables существуют:
   - `ai_sessions`
   - `ai_messages`
   - `deals`
   - `leads`
   - `workers`
   - `work_shifts`
   - `company_members`

---

**Все функции готовы к использованию! 🎉**

