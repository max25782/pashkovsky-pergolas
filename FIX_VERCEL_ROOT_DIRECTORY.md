# Исправление ошибки "Root Directory does not exist" в Vercel

## Проблема

```
The specified Root Directory "apps/site" does not exist. 
Please update your Project Settings.
```

## Решение

### Вариант 1: Исправить через Vercel Dashboard (Рекомендуется)

1. **Зайдите в Vercel Dashboard:**
   - Откройте https://vercel.com/dashboard
   - Выберите проект `pashkovsky-site` (или ваш проект)

2. **Откройте Settings:**
   - Settings → General

3. **Исправьте Root Directory:**
   - Найдите раздел "Root Directory"
   - Нажмите "Edit"
   - **Убедитесь, что указано:** `apps/site` (без лишних слешей или пробелов)
   - Если поле пустое или содержит другое значение - введите `apps/site`
   - Сохраните изменения

4. **Проверьте Build & Development Settings:**
   
   **Build Command:**
   ```bash
   cd ../.. && npm run build --filter=@pashkovsky/site
   ```
   
   **Output Directory:**
   ```
   .next
   ```
   
   **Install Command:**
   ```bash
   npm install
   ```

5. **Redeploy:**
   - Перейдите на вкладку "Deployments"
   - Нажмите "Redeploy" на последнем деплое
   - Или сделайте новый commit и push

### Вариант 2: Использовать Vercel CLI

Если Dashboard не помогает, используйте CLI:

```bash
# Установите Vercel CLI (если еще не установлен)
npm i -g vercel

# Перейдите в корень проекта
cd /Users/user/Downloads/pashkovsky-pergolas_starter

# Линкуйте проект
vercel link

# Когда спросит:
# - Set up and deploy: Yes
# - Which scope: выберите ваш scope
# - Link to existing project: Yes
# - Project name: pashkovsky-site (или ваш проект)

# Обновите настройки
vercel env pull .env.local

# Проверьте конфигурацию
vercel inspect
```

### Вариант 3: Пересоздать проект

Если ничего не помогает:

1. **Удалите проект в Vercel:**
   - Settings → General → Delete Project

2. **Создайте новый проект:**
   - Add New → Project
   - Import Git Repository
   - Выберите ваш репозиторий

3. **Настройте проект:**
   
   **Project Name:**
   ```
   pashkovsky-site
   ```
   
   **Framework Preset:**
   ```
   Next.js
   ```
   
   **Root Directory:**
   ```
   apps/site
   ```
   ⚠️ **ВАЖНО:** Нажмите "Edit" и выберите `apps/site` из списка папок
   
   **Build Command:**
   ```bash
   cd ../.. && npm run build --filter=@pashkovsky/site
   ```
   
   **Output Directory:**
   ```
   .next
   ```
   
   **Install Command:**
   ```bash
   npm install
   ```

4. **Добавьте Environment Variables:**
   - Все переменные из `.env.local` или `VERCEL_ENV_SETUP.md`

5. **Deploy**

## Проверка структуры репозитория

Убедитесь, что структура правильная:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
ls -la apps/site
```

Должны быть видны:
- `package.json`
- `next.config.js`
- `app/` или `pages/`
- `vercel.json` (опционально)

## Проверка Git

Убедитесь, что `apps/site` закоммичен в Git:

```bash
git ls-files apps/site/ | head -10
```

Если файлов нет - добавьте их:

```bash
git add apps/site/
git commit -m "Add site app files"
git push
```

## Альтернативное решение: Использовать vercel.json

Создайте или обновите `apps/site/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "buildCommand": "cd ../.. && npm run build --filter=@pashkovsky/site",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

Но **Root Directory все равно нужно установить в Dashboard!**

## Частые ошибки

### ❌ Неправильно:
- Root Directory: `/apps/site` (лишний слеш в начале)
- Root Directory: `apps/site/` (лишний слеш в конце)
- Root Directory: `app/site` (опечатка)
- Root Directory: пустое поле

### ✅ Правильно:
- Root Directory: `apps/site` (без слешей, без пробелов)

## После исправления

После обновления Root Directory:

1. ✅ Vercel найдет папку `apps/site`
2. ✅ Build Command выполнится из корня monorepo
3. ✅ Next.js соберется правильно
4. ✅ Деплой пройдет успешно

## Проверка успешного деплоя

После исправления проверьте логи деплоя:

```
✓ Cloning github.com/...
✓ Installing dependencies
✓ Running build command
✓ Building Next.js app
✓ Deploying...
```

Не должно быть ошибок про "Root Directory does not exist".




