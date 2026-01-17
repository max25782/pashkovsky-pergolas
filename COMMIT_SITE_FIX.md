# ✅ Исправлено: Ошибка сборки Site в Vercel

## Проблема
```
Error: Cannot find module 'tailwindcss'
```

## Что было сделано

Переместил **CSS-зависимости** из `devDependencies` в `dependencies` в `apps/site/package.json`:

- `tailwindcss` → dependencies
- `postcss` → dependencies  
- `autoprefixer` → dependencies

## Почему это важно?

Next.js использует эти пакеты на этапе **production build**, поэтому они должны быть в `dependencies`, а не в `devDependencies`.

Vercel по умолчанию не устанавливает `devDependencies` в production, что вызывало ошибку.

## Следующий шаг

**Закоммитьте изменения:**

```bash
git add apps/site/package.json FIX_SITE_BUILD_TAILWIND.md
git commit -m "fix(site): move Tailwind CSS dependencies to production deps for Vercel"
git push
```

Vercel автоматически пересоберёт проект, и build должен пройти успешно ✅

---

## Если build всё ещё падает

1. Проверьте логи в Vercel Dashboard
2. Убедитесь, что в Environment Variables добавлены:
   - `CRM_SITE_TOKEN` (для работы формы лидов)
   - `NEXT_PUBLIC_CRM_API_URL=https://crm.pashkovsky-group.com`
   - `NEXT_PUBLIC_CRM_SITE_TOKEN` (тот же что и в CRM)

3. Если ошибка продолжается, попробуйте:
   ```bash
   # Очистить кэш Vercel
   # В Vercel Dashboard → Settings → Clear Build Cache
   ```

