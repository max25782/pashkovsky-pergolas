# 🔗 Настройка Git интеграции в Vercel

## Проблема

Изменения есть в GitHub (коммит `492e199`), но Vercel не создаёт автоматические deployments.

## Решение

### Шаг 1: Проверить Git интеграцию в Vercel

1. **Откройте:** https://vercel.com/max25782s-projects/pashkovsky-pergolas/settings/git

2. **Проверьте:**
   - **Git Provider:** Должен быть GitHub с иконкой
   - **Repository:** Должно быть `max25782/pashkovsky-pergolas`
   - **Production Branch:** Должно быть `master`
   - **Automatic Deployments:** Должно быть **ON** (включено)

### Шаг 2: Если интеграция не настроена

1. **Нажмите:** "Disconnect" (если есть)
2. **Нажмите:** "Connect Git Repository"
3. **Выберите:** GitHub
4. **Выберите репозиторий:** `max25782/pashkovsky-pergolas`
5. **Production Branch:** `master`
6. **Root Directory:** `apps/site`
7. **Нажмите:** "Deploy"

### Шаг 3: Если интеграция настроена, но не работает

1. **Откройте:** https://vercel.com/max25782s-projects/pashkovsky-pergolas/settings/git
2. **Нажмите:** "Disconnect"
3. **Подождите:** 5 секунд
4. **Нажмите:** "Connect Git Repository"
5. **Выберите:** `max25782/pashkovsky-pergolas`
6. **Настройте:**
   - Production Branch: `master`
   - Root Directory: `apps/site`
   - Build Command: `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
   - Output Directory: `.next`
   - Install Command: `cd ../.. && npm install --production=false`

### Шаг 4: Вручную запустить deployment

Если интеграция настроена, но deployment не создался:

1. **Откройте:** https://vercel.com/max25782s-projects/pashkovsky-pergolas/deployments
2. **Нажмите:** "Create Deployment" (если есть кнопка)
3. **ИЛИ:** Нажмите "Redeploy" на последнем deployment
4. **Выберите:** Коммит `492e199` (или последний)
5. **Branch:** `master`
6. **Отключите:** "Use existing Build Cache"
7. **Нажмите:** "Deploy"

---

## Проверка после настройки

После подключения Git интеграции:

1. ✅ Vercel должен автоматически создать deployment для коммита `492e199`
2. ✅ В будущем каждый push в `master` будет автоматически создавать deployment
3. ✅ Проверьте в Deployments - должен появиться новый deployment

---

## Если всё ещё не работает

Проверьте что:
- ✅ GitHub репозиторий публичный ИЛИ Vercel имеет доступ к приватному репозиторию
- ✅ Vercel GitHub App установлен и имеет права на репозиторий
- ✅ Production Branch = `master` (та же ветка куда вы пушите)

---

## Быстрая проверка

Откройте: https://vercel.com/max25782s-projects/pashkovsky-pergolas/settings/git

Что вы видите?
- Есть ли подключенный Git репозиторий?
- Какой Production Branch?
- Включены ли Automatic Deployments?

