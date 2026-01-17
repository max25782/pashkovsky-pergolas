# 🔧 Fix: Site Build Error - Missing tailwindcss

## Проблема

При деплое в Vercel проект Site падает с ошибкой:

```
Error: Cannot find module 'tailwindcss'
```

## Причина

`tailwindcss`, `postcss` и `autoprefixer` были в `devDependencies`, но Vercel по умолчанию не устанавливает dev-зависимости в production build.

## Решение

Переместил `tailwindcss`, `postcss` и `autoprefixer` из `devDependencies` в `dependencies` в `apps/site/package.json`.

### Изменения:

**До:**
```json
{
  "dependencies": { ... },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    ...
  }
}
```

**После:**
```json
{
  "dependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    ...
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    ...
  }
}
```

## Почему это важно?

Next.js использует PostCSS и Tailwind CSS на этапе **build**, а не только в dev-режиме. Поэтому эти пакеты должны быть доступны в production.

## Следующие шаги

1. **Commit изменений:**
   ```bash
   git add apps/site/package.json
   git commit -m "fix(site): move tailwindcss to dependencies for Vercel build"
   git push
   ```

2. **Vercel автоматически пересоберёт** проект с новыми зависимостями.

3. **Проверка:** Build должен пройти успешно.

## Альтернатива (если не хочется менять package.json)

В **Vercel Dashboard** можно установить Environment Variable:

```env
NPM_FLAGS=--production=false
```

Это заставит Vercel устанавливать `devDependencies`, но это не рекомендуется, так как увеличивает размер установки.

## Для других CI/CD

Если используете другие платформы (Netlify, Railway, etc.), убедитесь, что:
- `NODE_ENV` не установлен в `production` во время build, ИЛИ
- Build-зависимости (Tailwind, PostCSS) в `dependencies`, а не в `devDependencies`

