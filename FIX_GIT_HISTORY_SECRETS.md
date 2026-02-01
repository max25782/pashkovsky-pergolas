# Удаление секретов из истории Git

## Проблема

GitHub блокирует push, потому что секреты находятся в старом коммите `a20e42c880444f4d963c4848604786a4cce474e1`.

## Решение: Удалить секреты из истории

### Вариант 1: Исправить последний коммит (если это последний коммит)

```bash
# 1. Убедитесь, что файлы исправлены
git status

# 2. Добавить исправленные файлы
git add FIX_AWS_CREDENTIALS_VERCEL.md

# 3. Исправить последний коммит
git commit --amend --no-edit

# 4. Force push (ОСТОРОЖНО!)
git push --force origin master
```

### Вариант 2: Использовать git filter-branch (если коммит не последний)

```bash
# 1. Сначала исправить файлы
git add FIX_AWS_CREDENTIALS_VERCEL.md
git commit -m "fix: remove secrets from FIX_AWS_CREDENTIALS_VERCEL.md"

# 2. Удалить секреты из истории
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch FIX_AWS_CREDENTIALS_VERCEL.md" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Добавить исправленный файл обратно
git add FIX_AWS_CREDENTIALS_VERCEL.md
git commit -m "docs: add FIX_AWS_CREDENTIALS_VERCEL.md without secrets"

# 4. Force push
git push --force origin master
```

### Вариант 3: Использовать BFG Repo-Cleaner (рекомендуется)

```bash
# 1. Установить BFG (если еще не установлен)
brew install bfg

# 2. Создать файл с секретами для замены
echo "AKIA4PFZSZFMCYNRASVZ==>your-access-key-id" > secrets.txt
echo "h9/Qmlqdv+90pEOu+xK2t37osS1y0tVbv8RUJtiM==>your-secret-access-key" >> secrets.txt

# 3. Запустить BFG
bfg --replace-text secrets.txt

# 4. Очистить и push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force origin master
```

### Вариант 4: Простое решение - удалить файл из истории

```bash
# 1. Удалить файл из всех коммитов
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch FIX_AWS_CREDENTIALS_VERCEL.md" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Создать новый файл без секретов
# (файл уже исправлен в рабочей директории)

# 3. Добавить исправленный файл
git add FIX_AWS_CREDENTIALS_VERCEL.md
git commit -m "docs: add FIX_AWS_CREDENTIALS_VERCEL.md without secrets"

# 4. Force push
git push --force origin master
```

## ⚠️ ВАЖНО

После force push:
1. Все, кто клонировал репозиторий, должны сделать `git fetch` и `git reset --hard origin/master`
2. Если это публичный репозиторий, секреты уже могли быть скомпрометированы - **ротируйте AWS ключи немедленно!**

## 🎯 Быстрое решение (если коммит последний)

```bash
# 1. Проверить, что файл исправлен
cat FIX_AWS_CREDENTIALS_VERCEL.md | grep -i "AKIA"

# Должно показать "your-access-key-id", а не реальный ключ

# 2. Добавить файл
git add FIX_AWS_CREDENTIALS_VERCEL.md

# 3. Исправить последний коммит
git commit --amend --no-edit

# 4. Force push
git push --force origin master
```
