# 🔧 Исправление опечатки в Root Directory

## Проблема

```
The specified Root Directory "apps/sait" does not exist.
```

Опечатка: написано `apps/sait` вместо `apps/site`.

## Решение

### Шаг 1: Исправить Root Directory в Vercel Dashboard

1. **Откройте:** https://vercel.com/max25782s-projects/pashkovsky-pergolas/settings/general

2. **Найдите раздел:** "Root Directory"

3. **Исправьте значение:**
   - **Было:** `apps/sait` ❌
   - **Должно быть:** `apps/site` ✅

4. **Нажмите:** "Save" внизу страницы

### Шаг 2: Создать новый deployment

После исправления:

1. **Откройте:** https://vercel.com/max25782s-projects/pashkovsky-pergolas/deployments

2. **Нажмите:** "Create Deployment" или "Redeploy"

3. **Выберите:**
   - Branch: `master`
   - Commit: `492e199` (или последний)
   - Отключите: "Use existing Build Cache"

4. **Нажмите:** "Deploy"

---

## Проверка

После исправления Root Directory на `apps/site`:

- ✅ Ошибка "Root Directory does not exist" исчезнет
- ✅ Build начнётся из правильной директории
- ✅ `tailwindcss` будет найден (т.к. он теперь в dependencies)

---

## Дополнительно: Проверьте другие настройки

Пока исправляете Root Directory, проверьте что:

- **Build Command:** `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
- **Output Directory:** `.next`
- **Install Command:** `cd ../.. && npm install --production=false`

---

## После успешного deploy

Build должен пройти успешно! 🎉

Если всё ещё ошибка - пришлите логи из Build Logs.

