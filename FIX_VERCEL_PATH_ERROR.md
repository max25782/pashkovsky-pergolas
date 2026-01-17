# 🔧 Исправление ошибки "path does not exist"

## Проблема

```
Error: The provided path "~/Downloads/pashkovsky-pergolas_starter/apps/site/apps/site" does not exist.
```

Vercel пытается использовать неправильный путь (дублирует `apps/site`).

## Решение

### Вариант 1: Исправить в Vercel Dashboard (Рекомендуется)

1. Откройте: https://vercel.com/max25782s-projects/pashkovsky-pergolas/settings
2. Перейдите в **General** → **Root Directory**
3. **Очистите поле** (оставьте пустым) ИЛИ установите: `apps/site`
4. Нажмите **Save**

### Вариант 2: Удалить локальную конфигурацию и начать заново

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site
rm -rf .vercel
vercel --prod
```

Когда спросит:
- **"Link to existing project?"** → **Yes**
- Выберите проект: `pashkovsky-pergolas`
- **"Override settings?"** → **Yes**
- **Root Directory:** оставьте **пустым** (или `./`)
- **Build Command:** `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
- **Output Directory:** `.next`
- **Install Command:** `cd ../.. && npm install --production=false`

### Вариант 3: Использовать флаг --cwd

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
vercel --prod --cwd apps/site
```

---

## Рекомендация

Используйте **Вариант 1** (исправить в Dashboard) - это самое надёжное решение.

После исправления Root Directory в Dashboard, выполните:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site
vercel --prod
```

---

## Проверка после исправления

После деплоя проверьте что:
- ✅ Build прошёл успешно
- ✅ Нет ошибки про путь
- ✅ Сайт доступен по URL от Vercel

