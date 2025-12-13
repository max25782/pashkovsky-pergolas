# Настройка Google Analytics

## Шаги для подключения Google Analytics

### 1. Получите Measurement ID из Google Analytics

1. Зайдите в [Google Analytics](https://analytics.google.com/)
2. Выберите ваш аккаунт и свойство (или создайте новое)
3. Перейдите в **Admin** → **Data Streams**
4. Выберите ваш веб-сайт или создайте новый поток данных
5. Скопируйте **Measurement ID** (формат: `G-XXXXXXXXXX`)

### 2. Добавьте переменную окружения

Добавьте в `.env.local` (или `.env`):

```env
NEXT_PUBLIC_GA_ID=G-TB94JE4K8G
```

**Важно:** Используйте ваш Measurement ID из Google Analytics. В данном случае: `G-TB94JE4K8G`

### 3. Перезапустите dev server

```powershell
# Остановите текущий (Ctrl+C)
# Очистите кеш
Remove-Item -Recurse -Force .next
# Запустите заново
npm run dev
```

### 4. Проверьте работу

1. Откройте сайт в браузере
2. Откройте консоль разработчика (F12)
3. Перейдите на вкладку **Network**
4. Найдите запросы к `google-analytics.com` или `googletagmanager.com`
5. В Google Analytics перейдите в **Reports** → **Realtime** - вы должны увидеть активных пользователей

## Что уже настроено

✅ Компонент `components/ga.tsx` - автоматически отслеживает переходы между страницами  
✅ Скрипт Google Analytics загружается автоматически  
✅ Отслеживание страниц работает при навигации в Next.js  

## Дополнительные события

Если нужно отслеживать кастомные события, используйте:

```typescript
// В любом компоненте
if (typeof window !== 'undefined' && window.gtag) {
  window.gtag('event', 'event_name', {
    event_category: 'category',
    event_label: 'label',
    value: 1
  })
}
```

## Примеры событий

```typescript
// Отслеживание клика на кнопку WhatsApp
window.gtag('event', 'whatsapp_click', {
  event_category: 'engagement',
  event_label: 'floating_button'
})

// Отслеживание отправки формы
window.gtag('event', 'form_submit', {
  event_category: 'lead',
  event_label: 'contact_form'
})

// Отслеживание просмотра видео
window.gtag('event', 'video_play', {
  event_category: 'engagement',
  event_label: 'hero_video'
})
```

## Troubleshooting

**Проблема:** Google Analytics не работает  
**Решение:** 
- Проверьте, что `NEXT_PUBLIC_GA_ID` установлен в `.env.local`
- Перезапустите dev server
- Проверьте консоль браузера на ошибки

**Проблема:** События не отслеживаются  
**Решение:**
- Убедитесь, что используете правильный Measurement ID (начинается с `G-`)
- Проверьте фильтры в Google Analytics (может быть включен фильтр ботов)

