# Исправление Google Analytics тега

## Проблема
Google Analytics не обнаруживает тег на сайте pashkovsky-group.com

## Решение

### 1. Проверьте переменную окружения в Vercel

Убедитесь, что в настройках Vercel проекта добавлена переменная:
```
NEXT_PUBLIC_GA_ID=G-TB94JE4K8G
```

**Как проверить:**
1. Зайдите в Vercel Dashboard
2. Выберите проект `pashkovsky-group.com`
3. Перейдите в **Settings** → **Environment Variables**
4. Убедитесь, что есть переменная `NEXT_PUBLIC_GA_ID` со значением `G-TB94JE4K8G`
5. Если переменной нет - добавьте её для всех окружений (Production, Preview, Development)

### 2. Пересоберите проект

После добавления/изменения переменной окружения:
1. Перейдите в **Deployments**
2. Нажмите **Redeploy** на последнем деплое
3. Или сделайте новый коммит и пуш - это автоматически запустит новый деплой

### 3. Проверьте тег на сайте

После деплоя проверьте:
1. Откройте сайт `https://pashkovsky-group.com`
2. Откройте консоль разработчика (F12)
3. Перейдите на вкладку **Network**
4. Найдите запросы к `googletagmanager.com` или `google-analytics.com`
5. Или откройте **Elements** и найдите в `<head>` теги:
   ```html
   <script src="https://www.googletagmanager.com/gtag/js?id=G-TB94JE4K8G"></script>
   ```

### 4. Проверка в Google Analytics

1. Зайдите в [Google Analytics](https://analytics.google.com/)
2. Перейдите в **Admin** → **Data Streams**
3. Выберите ваш поток данных
4. Нажмите **Test your implementation** или **Tag Assistant**
5. Введите URL сайта: `https://pashkovsky-group.com`
6. Проверьте, что тег обнаружен

## Что было исправлено в коде

1. ✅ Создан отдельный компонент `GoogleAnalytics` для загрузки тега
2. ✅ Компонент добавлен в layout перед другими компонентами
3. ✅ Используется `Script` компонент Next.js с правильной стратегией
4. ✅ Тег загружается автоматически в `<head>` через Next.js Script

## Важно

- Переменная `NEXT_PUBLIC_GA_ID` должна быть установлена в **Vercel Environment Variables**
- После добавления переменной нужно **пересобрать проект** (redeploy)
- Тег загружается автоматически через Next.js Script компонент
- Проверка тега может занять несколько минут после деплоя



