# 🧹 Очистка старой структуры

## ⚠️ Внимание!

После создания монорепо **старые файлы остались в корне**. Они больше не используются!

---

## 📁 Что осталось в корне:

```
OLD (не используется):
├── app/              # ❌ Старые pages (теперь в apps/site и apps/crm)
├── components/       # ❌ Старые компоненты (скопированы в apps)
├── lib/              # ❌ Старые утилиты (скопированы в apps)
├── types/            # ❌ Старые типы (в apps/crm/types)
├── hooks/            # ❌ Старые хуки (в apps/crm/hooks)
└── stores/           # ❌ Старые сторы (в apps/crm/stores)

KEEP (оставить):
├── apps/             # ✅ Новая структура монорепо
├── packages/         # ✅ Shared types
├── scripts/          # ✅ Общие утилиты (S3, gallery)
├── docs/             # ✅ Документация
├── supabase/         # ✅ Миграции (используются в CRM)
└── public/           # ⚠️ Можно удалить (скопирован в apps/site/public)
```

---

## 🗑️ Как очистить (после тестирования):

### Вариант 1: Архивировать (безопасно)

```bash
# Создать архив
mkdir old-structure-backup
move app old-structure-backup/
move components old-structure-backup/
move lib old-structure-backup/
move types old-structure-backup/
move hooks old-structure-backup/
move stores old-structure-backup/

# Удалить позже, когда убедитесь что всё работает:
rm -rf old-structure-backup
```

### Вариант 2: Удалить сразу (после проверки!)

```bash
# ⚠️ ТОЛЬКО ПОСЛЕ ТЕСТИРОВАНИЯ apps/site и apps/crm!
rm -rf app components lib types hooks stores

# Опционально (если не нужны):
rm -rf public data
```

---

## ✅ Как проверить что всё работает:

### 1. Запустить Site

```bash
npm run dev:site
```

Открыть http://localhost:3000 и проверить:
- ✅ Главная страница загружается
- ✅ Изображения отображаются
- ✅ Навигация работает
- ✅ Контактная форма работает

### 2. Запустить CRM

```bash
npm run dev:crm
```

Открыть http://localhost:3001/app/admin и проверить:
- ✅ Страница логина работает
- ✅ Dashboard загружается
- ✅ Лиды, сделки, воркеры доступны
- ✅ API routes работают

### 3. Если всё работает - можно удалять старые файлы!

---

## 🚨 Что НЕЛЬЗЯ удалять:

- ✅ `apps/` - новая структура
- ✅ `packages/` - shared types
- ✅ `scripts/` - утилиты (gen:gallery, migrate:s3)
- ✅ `docs/` - документация
- ✅ `supabase/` - миграции базы данных
- ✅ `package.json`, `turbo.json` - root конфиги
- ✅ `.gitignore`, `README.md` - meta файлы

---

## 📝 После очистки:

```bash
# Закоммитить удаление старых файлов
git add -A
git commit -m "chore: remove old project structure after monorepo migration"
git push
```

---

## 🎯 Итог:

После очистки структура будет **чистой**:

```
pashkovsky-monorepo/
├── apps/              # ✅ Приложения
├── packages/          # ✅ Shared код
├── scripts/           # ✅ Утилиты
├── docs/              # ✅ Документация
├── supabase/          # ✅ Миграции
└── (конфиги)          # ✅ Root configs
```

**Никаких дубликатов!** 🎉

