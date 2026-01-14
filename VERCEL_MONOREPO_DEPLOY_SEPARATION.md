# Разделение деплоев в монорепозитории Vercel

## Проблема

При изменении файлов в `apps/site` деплоятся оба проекта (Site и CRM), хотя нужно деплоить только измененный.

## Решение

### Шаг 1: Настройка Ignored Build Step в Vercel Dashboard

#### Для проекта Site (pashkovsky-site):

1. Откройте проект в Vercel Dashboard
2. Settings → Git
3. Найдите раздел **"Ignored Build Step"**
4. Выберите **"Custom"**
5. Введите команду:
   ```bash
   bash vercel-ignore-build-step.sh
   ```
6. Сохраните

#### Для проекта CRM (pashkovsky-crm):

1. Откройте проект в Vercel Dashboard
2. Settings → Git
3. Найдите раздел **"Ignored Build Step"**
4. Выберите **"Custom"**
5. Введите команду:
   ```bash
   bash vercel-ignore-build-step.sh
   ```
6. Сохраните

### Шаг 2: Закоммитьте скрипты

```bash
git add apps/site/vercel-ignore-build-step.sh apps/crm/vercel-ignore-build-step.sh
git commit -m "Add Vercel ignore build step scripts for monorepo"
git push
```

## Как это работает

### Скрипт `vercel-ignore-build-step.sh`:

- **Exit code 0** = пропустить деплой (нет изменений)
- **Exit code 1** = продолжить деплой (есть изменения)

### Для Site проверяются изменения в:
- `apps/site/` — файлы Site приложения
- `packages/shared-types/` — общие типы
- `package.json` — корневые зависимости
- `turbo.json` — конфигурация Turborepo

### Для CRM проверяются изменения в:
- `apps/crm/` — файлы CRM приложения
- `packages/shared-types/` — общие типы
- `package.json` — корневые зависимости
- `turbo.json` — конфигурация Turborepo

## Примеры

### Сценарий 1: Изменили файл в `apps/site/components/navbar.tsx`

- ✅ **Site** — деплоится (изменения в `apps/site/`)
- ❌ **CRM** — пропускается (нет изменений в `apps/crm/`)

### Сценарий 2: Изменили файл в `apps/crm/app/api/deals/route.ts`

- ❌ **Site** — пропускается (нет изменений в `apps/site/`)
- ✅ **CRM** — деплоится (изменения в `apps/crm/`)

### Сценарий 3: Изменили `packages/shared-types/src/index.ts`

- ✅ **Site** — деплоится (изменения в shared-types)
- ✅ **CRM** — деплоится (изменения в shared-types)

### Сценарий 4: Изменили `package.json` в корне

- ✅ **Site** — деплоится (изменения в корневых зависимостях)
- ✅ **CRM** — деплоится (изменения в корневых зависимостях)

## Проверка

После настройки:

1. Сделайте изменение только в `apps/site/`
2. Закоммитьте и запушьте
3. В Vercel Dashboard → Deployments:
   - **Site** должен показать "Building..."
   - **CRM** должен показать "Canceled" или "Ignored"

## Альтернативный метод (через Vercel CLI)

Если Dashboard не работает, используйте `vercel.json`:

### apps/site/vercel.json:
```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  },
  "ignoreCommand": "bash vercel-ignore-build-step.sh"
}
```

### apps/crm/vercel.json:
```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  },
  "ignoreCommand": "bash vercel-ignore-build-step.sh"
}
```

## Важно

⚠️ **Первый деплой после настройки:**
- Оба проекта могут задеплоиться, потому что нет `VERCEL_GIT_PREVIOUS_SHA`
- Это нормально — последующие деплои будут работать правильно

⚠️ **Если скрипт не работает:**
- Проверьте права на выполнение: `chmod +x vercel-ignore-build-step.sh`
- Проверьте, что файл закоммичен в Git
- Проверьте логи деплоя в Vercel — там будет вывод скрипта

## Дополнительная настройка

Если хотите более детальный контроль, можно добавить проверку конкретных файлов:

```bash
# Пример: деплоить Site только если изменены .tsx, .ts, .css файлы
git diff --name-only $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA | grep -E "^apps/site/.*\.(tsx?|css)$"
```

## Резюме

✅ **До настройки:** Любое изменение → деплой обоих проектов  
✅ **После настройки:** Изменение в Site → деплой только Site, изменение в CRM → деплой только CRM

Это экономит время сборки и деплоя!




