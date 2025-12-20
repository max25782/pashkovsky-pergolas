# Быстрая настройка Google Analytics

## Ваш Measurement ID
```
G-TB94JE4K8G
```

## Шаги настройки

### 1. Добавьте переменную в `.env.local`

Создайте файл `.env.local` в корне проекта (если его нет) и добавьте:

```env
NEXT_PUBLIC_GA_ID=G-TB94JE4K8G
```

Или добавьте эту строку в существующий `.env` файл.

### 2. Перезапустите dev server

```powershell
# Остановите текущий (Ctrl+C)
Remove-Item -Recurse -Force .next
npm run dev
```

### 3. Проверьте работу

1. Откройте сайт в браузере
2. Откройте консоль разработчика (F12)
3. Перейдите на вкладку **Network**
4. Найдите запросы к `googletagmanager.com` или `google-analytics.com`
5. В Google Analytics: **Reports** → **Realtime** - вы должны увидеть себя как активного пользователя

## Что уже настроено

✅ Компонент `components/ga.tsx` - автоматически загружает Google Analytics  
✅ Скрипт соответствует официальному формату Google  
✅ Автоматическое отслеживание переходов между страницами  
✅ Поддержка Next.js App Router  

## Готово!

После добавления `NEXT_PUBLIC_GA_ID=G-TB94JE4K8G` в `.env.local` и перезапуска dev server, Google Analytics начнет работать автоматически.




