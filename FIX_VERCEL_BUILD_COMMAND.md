# Исправление команды сборки для Vercel

## Проблема

Команда `cd ../.. && npm ci` не работает локально, потому что переходит слишком далеко.

## Решение для Vercel

В Vercel Dashboard настройте команды следующим образом:

### Build Command:
```bash
cd ../.. && npm install && npm run build --filter=@pashkovsky/site
```

### Install Command:
```bash
cd ../.. && npm install
```

### Почему `npm install` вместо `npm ci`?

- `npm ci` требует точного `package-lock.json`
- В Vercel контексте `cd ../..` из `apps/site` приводит к корню проекта
- `npm install` более гибкий и создаст `package-lock.json` если его нет

## Альтернатива: Использовать абсолютный путь

Если `cd ../..` не работает, можно использовать:

### Build Command:
```bash
npm install --prefix ../.. && npm run build --filter=@pashkovsky/site --prefix ../..
```

Но это менее надежно.

## Проверка package-lock.json

Убедитесь, что `package-lock.json` закоммичен в Git:

```bash
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

## Для локальной проверки

Локально команда должна выполняться из корня проекта:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
npm install
npm run build --filter=@pashkovsky/site
```

Не используйте `cd ../..` локально - это перейдет в домашнюю директорию!

## Настройки Vercel Dashboard

1. **Root Directory:** `apps/site`
2. **Build Command:** `cd ../.. && npm install && npm run build --filter=@pashkovsky/site`
3. **Install Command:** `cd ../.. && npm install`
4. **Output Directory:** `.next`

## Важно

⚠️ **В Vercel контексте:**
- Текущая директория: `/vercel/path0/apps/site` (Root Directory)
- `cd ../..` → `/vercel/path0` (корень проекта) ✅
- Там находится `package-lock.json` и `package.json`

⚠️ **Локально:**
- Не используйте `cd ../..` из корня проекта
- Выполняйте команды напрямую из корня

