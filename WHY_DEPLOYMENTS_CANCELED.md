# 🔍 Почему deployments отменяются (Canceled)

## Возможные причины

### 1. Build превышает таймаут
- Hobby план: лимит ~45 минут на build
- Если build долгий, Vercel может отменить его

### 2. Build был отменён вручную
- Кто-то нажал "Cancel" во время build
- Или автоматическая отмена при ошибке конфигурации

### 3. Проблема с настройками проекта
- Неправильный Root Directory (`apps/sait` вместо `apps/site`)
- Неправильные Build/Install команды
- Vercel не может найти файлы

### 4. Проблема с Git интеграцией
- Неправильная ветка
- Нет доступа к репозиторию
- Проблемы с webhook

---

## Как проверить причину

### Шаг 1: Откройте логи canceled deployment

1. **Кликните** на любой canceled deployment (например, `B13aW6T9B`)
2. **Откройте вкладку:** "Build Logs"
3. **Проверьте последние строки:**
   - Есть ли сообщение "Build canceled"?
   - Есть ли ошибка перед отменой?
   - На каком этапе произошла отмена?

### Шаг 2: Проверьте настройки проекта

1. **Откройте:** https://vercel.com/max25782s-projects/pashkovsky-pergolas/settings/general
2. **Проверьте:**
   - **Root Directory:** Должно быть `apps/site` (НЕ `apps/sait`!)
   - **Build Command:** `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
   - **Install Command:** `cd ../.. && npm install --production=false`
   - **Output Directory:** `.next`

### Шаг 3: Проверьте Git интеграцию

1. **Откройте:** https://vercel.com/max25782s-projects/pashkovsky-pergolas/settings/git
2. **Проверьте:**
   - Repository подключен?
   - Production Branch = `master`?
   - Automatic Deployments включены?

---

## Решение

### Если причина - неправильный Root Directory

1. **Исправьте:** `apps/sait` → `apps/site`
2. **Сохраните**
3. **Создайте новый deployment**

### Если причина - таймаут

1. **Проверьте Build Logs** - на каком этапе застревает?
2. **Оптимизируйте build:**
   - Убедитесь что `node_modules` не загружаются
   - Используйте `.vercelignore`
   - Проверьте что build команда правильная

### Если причина - ошибка в build

1. **Откройте Build Logs** canceled deployment
2. **Найдите ошибку** перед отменой
3. **Исправьте проблему**
4. **Создайте новый deployment**

---

## Быстрое решение

1. **Исправьте Root Directory:**
   - Settings → General → Root Directory = `apps/site`

2. **Создайте новый deployment:**
   - Deployments → "Create Deployment"
   - Выберите коммит `492e199` или последний
   - Branch: `master`
   - Отключите "Use existing Build Cache"

3. **Следите за Build Logs:**
   - Если снова Canceled - проверьте логи
   - Найдите причину отмены

---

## Что проверить в логах

Откройте Build Logs любого canceled deployment и проверьте:

- ✅ На каком этапе произошла отмена?
- ✅ Есть ли ошибка перед "Canceled"?
- ✅ Сколько времени прошло до отмены?
- ✅ Есть ли сообщение про Root Directory?

Пришлите последние 20-30 строк из Build Logs - помогу найти причину!

