# 🚨 КРИТИЧНО: Закоммитьте изменения СЕЙЧАС!

## Проблема

Vercel всё ещё получает ошибку `Cannot find module 'tailwindcss'` потому что изменения **НЕ в Git**.

**Локально:** ✅ `tailwindcss` в `dependencies` (правильно)  
**В Git:** ❌ `tailwindcss` в `devDependencies` (старое)

Vercel собирает из Git, не из локальных файлов!

---

## ⚡ Быстрое решение (1 команда)

```bash
bash commit-fix.sh
```

**ИЛИ** вручную:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
git add apps/site/package.json apps/site/vercel.json
git commit -m "fix(site): move Tailwind CSS to dependencies"
git push
```

---

## ✅ Что произойдёт:

1. ✅ Git закоммитит изменения
2. ✅ Push отправит в GitHub/GitLab
3. ✅ Vercel автоматически запустит новый deployment (~30 сек)
4. ✅ Build пройдёт успешно (tailwindcss теперь в dependencies)

---

## 🔍 Проверка после push:

1. Откройте Vercel Dashboard
2. Перейдите в **Deployments**
3. Проверьте **Source commit** - должен быть НОВЫЙ хэш
4. Build должен пройти успешно ✅

---

## 📋 Если git просит настроить user:

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

Затем повторите коммит.

---

## После успешного deploy:

Добавьте Environment Variables (см. `FIX_LEAD_FORM_500.md`):
- `CRM_SITE_TOKEN`
- `DEFAULT_COMPANY_ID`
- `NEXT_PUBLIC_CRM_SITE_TOKEN`

Иначе форма обратной связи не будет работать!

