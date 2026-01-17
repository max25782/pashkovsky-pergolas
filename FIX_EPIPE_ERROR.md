# 🔄 Исправление ошибки EPIPE

## Проблема

```
Error: FetchError: request to https://api.vercel.com/v2/files?teamId=... failed, reason: write EPIPE
```

Это сетевая ошибка при загрузке файлов. Проект уже линкован (`Linked to max25782s-projects/site`).

## Решение

### Вариант 1: Повторить деплой (простейший)

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site
vercel --prod --yes
```

Флаг `--yes` пропустит все интерактивные вопросы и использует сохранённые настройки.

### Вариант 2: Деплой без интерактивных вопросов

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site
vercel --prod --yes --force
```

### Вариант 3: Если всё ещё ошибка - проверить настройки

1. Откройте Vercel Dashboard: https://vercel.com/max25782s-projects/site/settings
2. Проверьте **Root Directory** - должно быть `apps/site` или пусто
3. Проверьте **Build Command** - должно быть: `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
4. Сохраните и попробуйте снова:

```bash
vercel --prod --yes
```

---

## Почему EPIPE?

- Временная сетевая проблема
- Таймаут при загрузке больших файлов
- Проблема с соединением

Обычно решается повторным запуском.

---

## После успешного деплоя

Проверьте URL который покажет Vercel CLI. Должно быть что-то вроде:
`https://site-xxx.vercel.app`

