# 🔴 КРИТИЧНО: Изменения не в Git!

## Проблема

Vercel **всё ещё** получает `Cannot find module 'tailwindcss'` потому что изменения в `apps/site/package.json` **НЕ закоммичены в Git**!

Vercel собирает код из Git репозитория, а не из ваших локальных файлов.

---

## ✅ Быстрое решение (1 команда)

```bash
bash scripts/fix-and-commit-tailwind.sh
```

Этот скрипт:
1. ✅ Проверит git status
2. ✅ Обновит package-lock.json
3. ✅ Добавит изменения в git
4. ✅ Создаст коммит
5. ✅ Запушит в remote

---

## ✅ Или вручную

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter

# Обновить lockfile
npm install

# Проверить что изменилось
git status

# Добавить изменения
git add apps/site/package.json package-lock.json

# Коммит
git commit -m "fix(site): move Tailwind CSS to dependencies for Vercel"

# Push
git push
```

---

## После push

1. Vercel автоматически запустит новый deployment (~30 сек)
2. Или вручную: **Deployments → Redeploy → Clear Build Cache**
3. **Проверьте Source commit** - должен быть НОВЫЙ хэш (не `55b6a54`)

---

## Как проверить что закоммичено?

```bash
git log --oneline -1
git show HEAD:apps/site/package.json | grep tailwindcss
```

Вы должны увидеть `tailwindcss` в секции `"dependencies"`, а НЕ в `"devDependencies"`.

---

## Почему это не работало?

1. ✅ `vercel.json` правильный
2. ✅ Root Directory правильный (`apps/site`)
3. ✅ Команды правильные (`cd ../..`)
4. ❌ Но изменения в `package.json` **НЕ в Git**

Vercel не видит локальные изменения - только то что в Git!

---

## После успешного deploy

Не забудьте добавить Environment Variables для работы формы (см. `FIX_LEAD_FORM_500.md`):
- `CRM_SITE_TOKEN`
- `DEFAULT_COMPANY_ID`
- `NEXT_PUBLIC_CRM_SITE_TOKEN`

