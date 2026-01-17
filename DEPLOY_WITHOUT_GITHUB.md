# 🚀 Deploy to Vercel WITHOUT GitHub

## Быстрое решение

Выполните в терминале:

```bash
bash deploy-vercel-direct.sh
```

**ИЛИ** вручную:

```bash
# 1. Установить Vercel CLI (если не установлен)
npm install -g vercel

# 2. Перейти в директорию site
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site

# 3. Задеплоить
vercel --prod
```

---

## Что произойдёт:

1. ✅ Vercel CLI спросит логин (если первый раз)
2. ✅ Спросит: "Link to existing project?" → **Yes**
3. ✅ Выберите проект: `pashkovsky-pergolas` (или ваш проект)
4. ✅ Спросит: "Override settings?" → **Yes**
5. ✅ Build Command: `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
6. ✅ Output Directory: `.next`
7. ✅ Install Command: `cd ../.. && npm install --production=false`
8. ✅ Деплой начнётся автоматически

---

## Если проект не существует:

1. "Link to existing project?" → **No**
2. Project name: `pashkovsky-site` (или любое имя)
3. In which directory is your code located: `./`
4. Override settings: **Yes**
5. Build Command: `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
6. Output Directory: `.next`
7. Install Command: `cd ../.. && npm install --production=false`

---

## Важно для монорепо:

Vercel CLI будет деплоить из `apps/site`, но build команда должна выполняться из **корня** (`cd ../..`), чтобы:
- ✅ Установить все зависимости монорепо
- ✅ Использовать Turbo для правильного build
- ✅ Установить `tailwindcss` (который теперь в dependencies)

---

## После успешного деплоя:

1. ✅ Проверьте URL в терминале (например, `https://pashkovsky-site.vercel.app`)
2. ✅ Добавьте Environment Variables в Vercel Dashboard:
   - `CRM_SITE_TOKEN`
   - `NEXT_PUBLIC_CRM_SITE_TOKEN`
   - `DEFAULT_COMPANY_ID`
3. ✅ Redeploy после добавления переменных

---

## Преимущества CLI деплоя:

- ✅ Не нужен GitHub
- ✅ Деплоит текущее локальное состояние
- ✅ Быстро и просто
- ✅ Можно использовать для тестирования перед push в Git

---

## Troubleshooting:

### Ошибка: "Cannot find module 'tailwindcss'"

Убедитесь что в `apps/site/package.json` `tailwindcss` в `dependencies`, не в `devDependencies`.

### Ошибка: "Project not found"

Создайте новый проект через CLI:
```bash
vercel --prod
# Выберите "No" на "Link to existing project"
```

### Ошибка: "Build failed"

Проверьте что:
- Build Command правильный: `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
- Install Command правильный: `cd ../.. && npm install --production=false`
- Root Directory в Vercel Dashboard = `apps/site`

