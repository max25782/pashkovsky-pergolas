# 🔄 Альтернативные решения для EPIPE ошибки

## Проблема

Ошибка `write EPIPE` повторяется при попытке загрузить файлы в Vercel.

## Решения

### Вариант 1: Использовать Vercel Dashboard (Рекомендуется)

Если CLI не работает, используйте Dashboard:

1. **Откройте:** https://vercel.com/max25782s-projects/site/deployments
2. **Нажмите:** "Create Deployment" (или "Redeploy" на последнем деплое)
3. **Выберите:** "Upload" вместо Git
4. **Загрузите:** ZIP архив проекта

**Но это неудобно для монорепо...**

---

### Вариант 2: Исправить Git и использовать автоматический деплой

Возможно проблема с GitHub не критична. Попробуйте:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
git add apps/site/package.json apps/site/vercel.json
git commit -m "fix(site): Tailwind CSS dependencies"
git push
```

Vercel автоматически задеплоит из Git (если интеграция настроена).

---

### Вариант 3: Использовать .vercelignore для уменьшения размера

Создайте `.vercelignore` в `apps/site`:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site
cat > .vercelignore << EOF
node_modules
.next
.turbo
*.log
.env.local
.DS_Store
EOF
```

Затем попробуйте снова:
```bash
vercel --prod --yes
```

---

### Вариант 4: Проверить размер проекта

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
du -sh .
du -sh apps/site
```

Если проект очень большой (>500MB), это может быть причиной EPIPE.

---

### Вариант 5: Использовать другой метод деплоя

Попробуйте задеплоить через Vercel API напрямую или использовать GitHub Actions для деплоя.

---

## Рекомендация

**Попробуйте Вариант 2** (Git push) - это самый надёжный способ для монорепо. Если проблема с GitHub не критична, это решит проблему.

Если Git действительно не работает, используйте **Вариант 1** (Dashboard Upload), но это будет неудобно для регулярных деплоев.

