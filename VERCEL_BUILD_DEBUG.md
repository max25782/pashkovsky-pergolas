# Отладка ошибки сборки на Vercel

## Проблема

Сборка падает с ошибкой:
```
npm error command sh -c next build exited (1)
```

Но детали ошибки не видны в логах.

## Решения

### Решение 1: Проверить логи Vercel полностью

В Vercel Dashboard:
1. Откройте Deployment → View Build Logs
2. Прокрутите вниз до самого конца
3. Найдите строки с `Error:` или `Failed:`
4. Там должна быть детальная ошибка

### Решение 2: Временно отключить линтинг

Обновите `next.config.js`:

```javascript
const nextConfig = {
  // ... existing config
  eslint: {
    ignoreDuringBuilds: true, // Временно отключить ESLint
  },
  typescript: {
    ignoreBuildErrors: true, // Временно отключить TypeScript проверки
  },
}
```

⚠️ **ВНИМАНИЕ:** Это только для диагностики! После нахождения проблемы верните обратно.

### Решение 3: Использовать прямую команду сборки

В Vercel Dashboard → Build Command:

```bash
cd ../.. && npm install && cd apps/site && next build 2>&1 | tee build.log
```

Это сохранит полный вывод в `build.log`.

### Решение 4: Проверить переменные окружения

Убедитесь, что все необходимые переменные установлены в Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `AWS_ACCESS_KEY_ID` (если используется S3)
- `AWS_SECRET_ACCESS_KEY` (если используется S3)
- И другие из `turbo.json` → `tasks.build.env`

### Решение 5: Проверить зависимости

Возможно, проблема в отсутствующих зависимостях. Проверьте:

```bash
cd apps/site
npm install
npm run build
```

Если локально работает, а в Vercel нет - проблема в настройках Vercel.

## Частые причины ошибок сборки

### 1. Отсутствующие переменные окружения
**Симптом:** Ошибка при чтении `process.env.*`
**Решение:** Добавить все переменные в Vercel Dashboard

### 2. Проблемы с TypeScript
**Симптом:** `Type error: ...`
**Решение:** Исправить TypeScript ошибки или временно отключить проверки

### 3. Проблемы с ESLint
**Симптом:** `ESLint errors found`
**Решение:** Исправить ESLint ошибки или временно отключить

### 4. Проблемы с API Routes
**Симптом:** Ошибка при сборке API routes
**Решение:** Проверить `export const dynamic` и `export const runtime`

### 5. Проблемы с зависимостями
**Симптом:** `Module not found: ...`
**Решение:** Убедиться, что все зависимости в `package.json`

## Рекомендуемый подход

1. **Сначала:** Проверьте полные логи в Vercel Dashboard
2. **Затем:** Попробуйте собрать локально: `cd apps/site && npm run build`
3. **Если локально работает:** Проблема в настройках Vercel
4. **Если локально не работает:** Исправьте ошибки локально, затем деплойте

## Временное решение для быстрого деплоя

Если нужно быстро задеплоить, временно добавьте в `next.config.js`:

```javascript
const nextConfig = {
  // ... existing config
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}
```

⚠️ **НЕ ОСТАВЛЯЙТЕ ЭТО В PRODUCTION!** Это только для диагностики.

## После нахождения проблемы

1. Исправьте ошибку
2. Уберите временные отключения проверок
3. Передеплойте

