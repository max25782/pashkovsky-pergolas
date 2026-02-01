#!/bin/bash
# Простое решение через git rebase

echo "=== Исправление коммита с секретами ==="
echo ""
echo "Шаг 1: Начинаю интерактивный rebase..."
echo "В редакторе найдите строку с 'a20e42c profiles'"
echo "Измените 'pick' на 'edit' для этой строки"
echo "Сохраните и закройте редактор"
echo ""
read -p "Нажмите Enter для начала rebase..."

# Начать интерактивный rebase
git rebase -i HEAD~4

echo ""
echo "=== Если rebase остановился ==="
echo "Выполните следующие команды:"
echo ""
echo "1. Проверить файл:"
echo "   grep -i 'AKIA' FIX_AWS_CREDENTIALS_VERCEL.md"
echo ""
echo "2. Добавить исправленный файл:"
echo "   git add FIX_AWS_CREDENTIALS_VERCEL.md"
echo ""
echo "3. Исправить коммит:"
echo "   git commit --amend --no-edit"
echo ""
echo "4. Продолжить rebase:"
echo "   git rebase --continue"
echo ""
echo "5. Force push:"
echo "   git push --force origin master"
