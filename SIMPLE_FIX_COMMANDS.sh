#!/bin/bash
# Простое решение: удалить файл из проблемного коммита

echo "=== Удаление секретов из git истории ==="
echo ""
echo "Шаг 1: Сброс на коммит перед проблемным (f8c9312)"
echo "Это сохранит все изменения в рабочей директории"
echo ""

# Сбросить на коммит перед проблемным, сохранив изменения
git reset --soft f8c9312

echo "Шаг 2: Удалить проблемный файл из индекса"
git reset HEAD FIX_AWS_CREDENTIALS_VERCEL.md 2>/dev/null || true

echo "Шаг 3: Создать коммит без проблемного файла"
git commit -m "docs: remove FIX_AWS_CREDENTIALS_VERCEL.md with secrets"

echo "Шаг 4: Добавить исправленный файл"
git add FIX_AWS_CREDENTIALS_VERCEL.md
git commit -m "docs: add FIX_AWS_CREDENTIALS_VERCEL.md without secrets"

echo "Шаг 5: Добавить остальные изменения"
git add .
git commit -m "fix: replace AWS credentials with placeholders in all files"

echo ""
echo "Шаг 6: Проверить что секретов нет"
echo "Выполните: grep -r 'AKIA4PFZSZFMCYNRASVZ' ."
echo ""
echo "Шаг 7: Force push"
echo "Выполните: git push --force origin master"
