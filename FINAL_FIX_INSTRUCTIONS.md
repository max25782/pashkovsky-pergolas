# ⚡ Финальное решение: Два варианта

## Вариант 1: Правильный (закоммитить изменения)

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
npm install
git add apps/site/package.json package-lock.json
git commit -m "fix(site): move Tailwind CSS to dependencies"
git push
```

**Почему это работает:**
- `tailwindcss` переносится из `devDependencies` в `dependencies`
- В production build `npm install` установит его автоматически
- Это правильное решение, т.к. Tailwind нужен для build

---

## Вариант 2: Быстрый фикс (изменить vercel.json)

Уже сделано! Обновлён `apps/site/vercel.json`:

```json
{
  "installCommand": "cd ../.. && npm install --production=false"
}
```

Закоммитьте:

```bash
git add apps/site/vercel.json
git commit -m "fix(site): force install devDependencies in Vercel"
git push
```

**Почему это работает:**
- `--production=false` заставляет npm устанавливать devDependencies
- Это обходное решение, но работает быстро

---

## ⚠️ Рекомендация

Используйте **Вариант 1** (закоммитить package.json):
- Это правильное архитектурное решение
- `tailwindcss`, `postcss`, `autoprefixer` - это build-time зависимости
- Они должны быть в `dependencies`, не в `devDependencies`

Вариант 2 - временный хак, лучше не использовать в продакшене.

---

## После успешного deploy

Добавьте Environment Variables (см. `FIX_LEAD_FORM_500.md`):
- `CRM_SITE_TOKEN`
- `DEFAULT_COMPANY_ID`
- `NEXT_PUBLIC_CRM_SITE_TOKEN`

