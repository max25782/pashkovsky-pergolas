# 📝 Fix Articles Page

## Проблема:
Articles страница пытается загрузить `/data/articles.json`, но статьи должны быть в Supabase!

## ✅ РЕШЕНИЕ:

### Шаг 1: Создайте таблицу Articles в Supabase

Выполните в Supabase SQL Editor:
```
supabase/migrations/022_create_articles_table.sql
```

Это создаст:
- ✅ Таблицу `articles` с поддержкой 3 языков (he, ru, en)
- ✅ Индексы для быстрого поиска
- ✅ Связь с company_id и author_id

### Шаг 2: Перезапустите CRM

```powershell
# Остановите dev server (Ctrl+C)
cd apps/crm
npm run dev
```

### Шаг 3: Откройте Articles

```
http://localhost:3001/app/admin/articles
```

Теперь страница:
- ✅ Загружает из Supabase через `/api/admin/articles`
- ✅ Показывает пустой список (статей еще нет)
- ✅ Можете создавать новые статьи кнопкой "+ Create Article"

---

## 📋 Структура статьи:

```typescript
{
  slug: "welcome",
  title: {
    he: "ברוכים הבאים",
    ru: "Добро пожаловать", 
    en: "Welcome"
  },
  summary: {
    he: "תקציר...",
    ru: "Краткое описание...",
    en: "Summary..."
  },
  sections: [
    {
      heading: {he: "כותרת", ru: "Заголовок", en: "Heading"},
      body: {he: "תוכן...", ru: "Содержание...", en: "Content..."}
    }
  ]
}
```

---

## 🎯 Что изменилось:

| Было | Стало |
|------|-------|
| ❌ Загрузка из `/data/articles.json` | ✅ Загрузка из Supabase |
| ❌ Файл не существовал | ✅ API endpoint `/api/admin/articles` |
| ❌ 404 ошибка | ✅ Пустой список или статьи из БД |

---

**Выполните миграцию и перезапустите CRM!** 🚀

