# 🎯 Финальная настройка AI Director

## ✅ Что уже готово:

- ✅ Все 5 Action Groups созданы и Enabled
- ✅ OpenAPI схемы настроены
- ✅ Имена Action Groups исправлены в промпте

---

## 🔧 Осталось сделать (5 минут):

### 1️⃣ Обновить Instructions (System Prompt)

**Сейчас в AWS Console только 3 строки, нужен полный промпт!**

#### A. Откройте файл промпта:
`AI_DIRECTOR_MULTILINGUAL_PROMPT.md`

#### B. Скопируйте ВЕСЬ текст между тройными обратными кавычками:

Начиная со строки 10:
```
You are an AI Executive Business Advisor for a pergola construction company...
```

До строки ~110:
```
...3. FINALLY: Respond in user's language with specific numbers from the data
```

**Важно:** Копируйте БЕЗ тройных обратных кавычек (```)!

#### C. В AWS Bedrock Console:

1. Нажмите кнопку **"Edit"** (справа вверху, рядом с Test Agent)
2. Найдите поле **"Instructions for the Agent"**
3. Удалите текущие 3 строки
4. Вставьте полный скопированный текст
5. Нажмите **"Save and exit"**

---

### 2️⃣ Prepare Agent

1. После сохранения нажмите кнопку **"Prepare"** (справа вверху)
2. Подождите **2-3 минуты** (важно!)
3. Статус должен стать **"PREPARED"**

---

### 3️⃣ Протестируйте

#### В чате CRM напишите:
```
כמה עסקאות פתוחות יש לנו?
```

#### Или в Test Agent (справа в AWS Console):
```
How many deals do we have?
```

---

## ✅ Ожидаемый результат:

### В терминале (npm run dev) должны появиться логи:
```
[Bedrock] Response metadata: { hasCompletion: true, sessionId: '...' }
[Bedrock] Chunk 1: { hasBytes: true, type: 'bytes' }
GET /api/ai-director/data/deals?company_id=xxx&limit=50
```

### Агент должен ответить:
```
יש לכם X עסקאות פתוחות:
- Y בשלב משא ומתן
- Z בשלב חוזה
...
```

(С реальными цифрами из CRM!)

---

## 🔍 Если всё ещё не работает:

### Проверьте в Test Agent (AWS Console):

1. Справа панель **"Test Agent"**
2. Напишите: `How many deals?`
3. Внизу нажмите **"Show trace"** или **"View logs"**
4. Посмотрите, вызываются ли Action Groups

Если в логах НЕТ вызовов Action Groups, значит:
- Промпт не полный
- Или Agent не был Prepared

---

## 📋 Чек-лист:

- [ ] Скопировать ПОЛНЫЙ System Prompt (строки 10-110)
- [ ] Вставить в AWS Console → Edit → Instructions
- [ ] Save and exit
- [ ] Нажать "Prepare"
- [ ] Подождать 2-3 минуты
- [ ] Попробовать снова в чате

---

## 💡 Совет:

После обновления Instructions проверьте, что в поле видно **много текста**, а не только 3 строки. Должно быть примерно 100-150 строк промпта.

---

**После этого всё должно заработать! 🚀**

Агент будет:
1. ✅ Вызывать Action Groups
2. ✅ Получать реальные данные из CRM
3. ✅ Отвечать на иврите/русском/английском
4. ✅ Показывать конкретные цифры


