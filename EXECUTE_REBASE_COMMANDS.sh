#!/bin/bash
# Скрипт для исправления коммита с секретами

echo "Шаг 1: Проверяю текущее состояние..."
git log --oneline -5

echo ""
echo "Шаг 2: Начинаю интерактивный rebase..."
echo "В редакторе измените 'pick' на 'edit' для коммита a20e42c"
echo "Затем сохраните и закройте редактор"
echo ""
read -p "Нажмите Enter когда будете готовы начать rebase..."

git rebase -i HEAD~4

echo ""
echo "Если rebase остановился на коммите a20e42c:"
echo "1. Убедитесь что файл исправлен: grep -i 'AKIA' FIX_AWS_CREDENTIALS_VERCEL.md"
echo "2. Выполните: git add FIX_AWS_CREDENTIALS_VERCEL.md"
echo "3. Выполните: git commit --amend --no-edit"
echo "4. Выполните: git rebase --continue"
echo "5. Выполните: git push --force origin master"
