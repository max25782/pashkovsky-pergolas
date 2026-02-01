# Удаление секретов из Git истории

## ✅ Что уже сделано

Я заменил реальные AWS credentials на плейсхолдеры в файлах:
- `FIX_AWS_CREDENTIALS_VERCEL.md`
- `UPDATE_AWS_KEYS.md`
- `apps/crm/app/api/debug/s3-config/route.ts`

## 🔧 Команды для выполнения

Выполните эти команды в терминале:

### Шаг 1: Добавить изменения
```bash
git add FIX_AWS_CREDENTIALS_VERCEL.md UPDATE_AWS_KEYS.md apps/crm/app/api/debug/s3-config/route.ts
```

### Шаг 2: Создать новый коммит
```bash
git commit -m "fix: remove AWS credentials from documentation files"
```

### Шаг 3: Удалить секреты из истории (опционально, но рекомендуется)

Если хотите полностью удалить секреты из истории git:

```bash
# Удалить файл из последнего коммита
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch FIX_AWS_CREDENTIALS_VERCEL.md" \
  --prune-empty --tag-name-filter cat -- --all

# Или использовать BFG Repo-Cleaner (быстрее):
# brew install bfg
# bfg --replace-text passwords.txt
```

### Шаг 4: Push изменений
```bash
git push origin master
```

## ⚠️ Важно

Если секреты уже были запушены в публичный репозиторий:
1. **Немедленно ротируйте AWS ключи** в AWS IAM Console
2. Создайте новые ключи
3. Обновите их в Vercel
4. Удалите старые ключи из AWS

## 🎯 Быстрое решение

Если нужно просто исправить текущий коммит:

```bash
# 1. Добавить исправленные файлы
git add FIX_AWS_CREDENTIALS_VERCEL.md UPDATE_AWS_KEYS.md apps/crm/app/api/debug/s3-config/route.ts

# 2. Создать коммит с исправлениями
git commit -m "fix: replace AWS credentials with placeholders"

# 3. Push
git push origin master
```

GitHub должен принять push, так как секреты теперь заменены на плейсхолдеры.
