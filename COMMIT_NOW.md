# 🚨 СРОЧНО: Закоммитьте изменения!

## Проблема

Vercel всё ещё получает ошибку `Cannot find module 'tailwindcss'` потому что **изменения в `apps/site/package.json` не закоммичены в Git!**

Vercel собирает проект из Git репозитория, а не из ваших локальных файлов.

## Решение (2 минуты)

### Шаг 1: Проверьте изменения

```bash
git status
```

Вы должны увидеть:
```
modified:   apps/site/package.json
```

### Шаг 2: Посмотрите diff

```bash
git diff apps/site/package.json
```

Вы должны увидеть, что `tailwindcss`, `postcss` и `autoprefixer` переместились из `devDependencies` в `dependencies`.

### Шаг 3: Добавьте в Git

```bash
git add apps/site/package.json
```

### Шаг 4: Создайте коммит

```bash
git commit -m "fix(site): move Tailwind CSS to dependencies for Vercel build"
```

### Шаг 5: Запушьте в GitHub

```bash
git push
```

**ИЛИ** если у вас другой remote:

```bash
git push origin main
```

**ИЛИ** если ветка называется `master`:

```bash
git push origin master
```

### Шаг 6: Подождите автоматический редеплой

Vercel автоматически запустит новый build через ~30 секунд после push.

---

## Если Git просит настроить user

Если при коммите видите ошибку про user.name, выполните:

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

Затем повторите шаг 4-5.

---

## Если хотите проверить локально перед push

```bash
# Из корня проекта
npm install
npm run build:site
```

Если локальный build проходит успешно, то и в Vercel пройдёт после push.

---

## После успешного деплоя

Не забудьте добавить Environment Variables в Vercel (см. `FIX_LEAD_FORM_500.md`):

1. `CRM_SITE_TOKEN` - для работы Public Lead API
2. `DEFAULT_COMPANY_ID` - ID компании для лидов
3. `NEXT_PUBLIC_CRM_SITE_TOKEN` - тот же токен для Site проекта

---

## Быстрая команда (всё в одном)

```bash
git add apps/site/package.json && \
git commit -m "fix(site): move Tailwind CSS to dependencies for Vercel" && \
git push
```

Затем откройте Vercel Dashboard и следите за прогрессом build.

