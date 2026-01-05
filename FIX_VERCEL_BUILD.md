# Исправление ошибки сборки на Vercel

## Проблема

```
npm error Lifecycle script `build` failed with error:
npm error code 1
npm error path /vercel/path0/apps/site
npm error workspace @pashkovsky/site@0.1.0
npm error command failed
npm error command sh -c next build
```

## Причина

Vercel выполняет команду `npm run build` внутри `apps/site`, но для monorepo нужно выполнять команды из корня проекта.

## Решение

### Вариант 1: Обновить настройки в Vercel Dashboard (Рекомендуется)

1. **Зайдите в Vercel Dashboard:**
   - Откройте проект `pashkovsky-site`
   - Settings → General

2. **Обновите Build & Development Settings:**

   **Root Directory:**
   ```
   apps/site
   ```
   ⚠️ **ВАЖНО:** Должно быть установлено в Dashboard!

   **Build Command:**
   ```bash
   cd ../.. && npm ci && npm run build --filter=@pashkovsky/site
   ```
   
   **Output Directory:**
   ```
   .next
   ```
   (Относительно Root Directory)
   
   **Install Command:**
   ```bash
   cd ../.. && npm ci
   ```
   
   **Development Command:**
   ```bash
   cd ../.. && npm run dev --filter=@pashkovsky/site
   ```

3. **Сохраните и передеплойте**

### Вариант 2: Использовать Turbo напрямую

Если вариант 1 не работает, используйте Turbo:

**Build Command:**
```bash
cd ../.. && npm ci && npx turbo build --filter=@pashkovsky/site
```

**Install Command:**
```bash
cd ../.. && npm ci
```

### Вариант 3: Создать build script в корне

Создайте файл `build-site.sh` в корне проекта:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"
npm ci
npm run build --filter=@pashkovsky/site
```

И используйте в Vercel:

**Build Command:**
```bash
bash build-site.sh
```

Но это менее надежно, чем вариант 1.

## Проверка

После обновления настроек:

1. ✅ Команда выполняется из корня monorepo
2. ✅ Устанавливаются все зависимости (включая turbo)
3. ✅ Turbo правильно собирает проект
4. ✅ Next.js находит все файлы и зависимости

## Важные моменты

### Почему `npm ci` вместо `npm install`?

- `npm ci` быстрее и надежнее для CI/CD
- Устанавливает точные версии из `package-lock.json`
- Удаляет `node_modules` перед установкой
- Не изменяет `package-lock.json`

### Почему `cd ../..`?

Vercel устанавливает Root Directory как `apps/site`, поэтому:
- Текущая директория: `/vercel/path0/apps/site`
- Нужная директория: `/vercel/path0`
- `cd ../..` переходит из `apps/site` в корень

### Почему `--filter=@pashkovsky/site`?

Turbo использует фильтры для сборки только нужного пакета:
- `--filter=@pashkovsky/site` собирает только site app
- Зависимости собираются автоматически благодаря `dependsOn` в `turbo.json`

## Альтернатива: Использовать Vercel CLI

Если Dashboard не помогает:

```bash
cd apps/site
vercel --prod
```

Когда спросит:
- Build Command: `cd ../.. && npm ci && npm run build --filter=@pashkovsky/site`
- Output Directory: `.next`
- Install Command: `cd ../.. && npm ci`

## После исправления

Логи сборки должны показывать:

```
✓ Cloning repository
✓ Installing dependencies (from root)
✓ Running build command
  > turbo run build --filter=@pashkovsky/site
  > @pashkovsky/site@0.1.0 build
  > next build
  ✓ Compiled successfully
  ✓ Linting and checking validity of types
  ✓ Collecting page data
  ✓ Generating static pages
✓ Build completed
```

## Если проблема сохраняется

1. Проверьте, что `turbo` установлен в корневом `package.json`
2. Проверьте, что `package-lock.json` закоммичен в Git
3. Проверьте логи сборки в Vercel - там должна быть более детальная ошибка
4. Убедитесь, что Root Directory установлен правильно в Dashboard

