# Исправление коммита с секретами через git rebase

## Проблема

Коммит `a20e42c880444f4d963c4848604786a4cce474e1` содержит секреты и GitHub блокирует push.

## Решение: Интерактивный rebase

### Шаг 1: Найти коммит в истории

```bash
# Посмотреть историю коммитов
git log --oneline | head -20

# Найти коммит с секретами (должен быть в списке)
# Запомните хеш коммита ПЕРЕД a20e42c8...
```

### Шаг 2: Интерактивный rebase

```bash
# Начать rebase с коммита ПЕРЕД проблемным
# Замените <parent-commit> на хеш коммита перед a20e42c8
git rebase -i <parent-commit>

# Или если коммит недавний (например, 5 коммитов назад):
git rebase -i HEAD~5
```

### Шаг 3: В редакторе

1. Найдите строку с коммитом `a20e42c8`
2. Измените `pick` на `edit`:
   ```
   edit a20e42c8 ... (ваше сообщение коммита)
   ```
3. Сохраните и закройте редактор

### Шаг 4: Исправить файл

```bash
# Git остановится на этом коммите
# Убедитесь, что файл исправлен
cat FIX_AWS_CREDENTIALS_VERCEL.md | grep "AKIA"

# Должно показать "your-aws-access-key-id", не реальный ключ

# Если файл не исправлен, исправьте его сейчас
# Затем:
git add FIX_AWS_CREDENTIALS_VERCEL.md
git commit --amend --no-edit
```

### Шаг 5: Продолжить rebase

```bash
git rebase --continue
```

### Шаг 6: Force push

```bash
git push --force origin master
```

## Альтернатива: Использовать git filter-repo (рекомендуется)

```bash
# 1. Установить git-filter-repo
pip install git-filter-repo
# или
brew install git-filter-repo

# 2. Заменить секреты в истории
git filter-repo --replace-text <(echo "AKIA4PFZSZFMCYNRASVZ==>your-access-key-id") \
                 --replace-text <(echo "h9/Qmlqdv+90pEOu+xK2t37osS1y0tVbv8RUJtiM==>your-secret-access-key")

# 3. Force push
git push --force origin master
```

## Простое решение: Удалить файл из коммита

```bash
# 1. Найти родительский коммит
git log --oneline | grep -A 1 "a20e42c8"

# 2. Сбросить на родительский коммит (сохранить изменения)
git reset --soft <parent-commit-hash>

# 3. Удалить файл из индекса
git reset HEAD FIX_AWS_CREDENTIALS_VERCEL.md

# 4. Создать новый коммит без этого файла
git commit -m "docs: remove FIX_AWS_CREDENTIALS_VERCEL.md with secrets"

# 5. Добавить исправленный файл
git add FIX_AWS_CREDENTIALS_VERCEL.md
git commit -m "docs: add FIX_AWS_CREDENTIALS_VERCEL.md without secrets"

# 6. Force push
git push --force origin master
```

## Самый простой способ (если коммит последний или недавний)

```bash
# 1. Проверить текущий коммит
git log --oneline -1

# 2. Если a20e42c8 - это HEAD или близко к HEAD:
git rebase -i HEAD~10  # или больше, чтобы захватить коммит

# 3. В редакторе изменить 'pick' на 'edit' для коммита a20e42c8
# 4. Сохранить и закрыть
# 5. Исправить файл и:
git add FIX_AWS_CREDENTIALS_VERCEL.md
git commit --amend --no-edit
git rebase --continue

# 6. Force push
git push --force origin master
```
