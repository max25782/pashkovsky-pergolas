# Миграция всех изображений из public/images в S3

## Что будет мигрировано

Скрипт перенесет все изображения и видео из `public/images/` в S3, сохраняя структуру папок:

```
public/images/
├── dgamim/
│   ├── atlas/
│   ├── horizon/
│   └── ...
├── fancy/
├── fromShetah/
├── logos/
├── mestor/
├── pergulot/
│   ├── ashdod/
│   ├── ashkelon/
│   └── ...
├── profiles/
├── rails/
├── services/
└── windows/
```

Всего: **~800+ файлов** (изображения + видео)

## Шаг 1: Убедитесь, что S3 настроен

Проверьте, что в `.env` есть:

```env
AWS_S3_BUCKET_NAME=pashkovsky-gallery
AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

## Шаг 2: Запустите миграцию

```powershell
npm run migrate:public-to-s3
```

Скрипт:
1. Найдет все изображения и видео в `public/images/`
2. Загрузит их в S3 с той же структурой папок
3. Покажет прогресс для каждого файла
4. Выведет статистику (успешно/ошибки)

## Шаг 3: Обновите next.config.js

После успешной миграции замените `next.config.js` на `next.config.s3.js`:

```powershell
# Backup старого конфига
Copy-Item next.config.js next.config.backup.js

# Используйте новый конфиг с S3
Copy-Item next.config.s3.js next.config.js
```

Или вручную добавьте в `next.config.js`:

```javascript
const nextConfig = {
  images: {
    // ... existing config ...
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pashkovsky-gallery.s3.eu-north-1.amazonaws.com',
        port: '',
        pathname: '/images/**',
      },
    ],
  },
}
```

## Шаг 4: Обновите код для использования S3

### Вариант A: Автоматический (рекомендуется)

Используйте хелпер `lib/image-url.ts`:

```typescript
import { getImageUrl } from '@/lib/image-url'

// Вместо:
<img src="/images/pergulot/ashdod/img.webp" />

// Используйте:
<img src={getImageUrl('/images/pergulot/ashdod/img.webp')} />
```

Хелпер автоматически вернет S3 URL, если S3 настроен, или локальный URL.

### Вариант B: Прямые URL

Замените все `/images/...` на полные S3 URL:

```typescript
// Было:
src="/images/pergulot/ashdod/img.webp"

// Стало:
src="https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/pergulot/ashdod/img.webp"
```

## Шаг 5: Тестирование

1. Перезапустите dev server:
   ```powershell
   npm run dev
   ```

2. Откройте сайт и проверьте:
   - Главная страница (hero images)
   - Галерея пергол (`/he/pergulas`)
   - Галерея моделей (`/he/models`)
   - Админка галереи (`/he/admin/gallery`)

3. Проверьте в DevTools → Network:
   - Изображения должны загружаться с `pashkovsky-gallery.s3.eu-north-1.amazonaws.com`
   - Статус должен быть `200 OK`

## Шаг 6: Удаление локальных изображений (опционально)

### Когда можно удалять:

✅ **Можно удалять, если:**
- Миграция прошла успешно (0 ошибок)
- Все страницы сайта загружаются корректно
- Изображения отображаются в браузере
- DevTools показывает, что изображения загружаются с S3
- `next.config.js` обновлен для работы с S3
- Код обновлен для использования S3 URL (или используется `getImageUrl()`)

❌ **НЕ удаляйте, если:**
- Есть ошибки загрузки изображений
- Некоторые страницы не работают
- Не обновлен `next.config.js`
- Не протестирован production build (`npm run build`)

### Безопасное удаление:

```powershell
# Шаг 1: Создайте backup (обязательно!)
Compress-Archive -Path public/images -DestinationPath public/images-backup-$(Get-Date -Format 'yyyy-MM-dd').zip

# Шаг 2: Проверьте backup
Test-Path public/images-backup-*.zip
# Должно вывести: True

# Шаг 3: Удалите локальные изображения
Remove-Item -Path public/images -Recurse -Force

# Освободится ~500-700MB места
```

### После удаления:

1. **Перезапустите dev server**:
   ```powershell
   npm run dev
   ```

2. **Проверьте все страницы**:
   - Главная (`/he`)
   - Галереи (`/he/pergulas`, `/he/models`)
   - Админка (`/he/admin/gallery`)

3. **Проверьте production build**:
   ```powershell
   npm run build
   npm start
   ```

### Если что-то сломалось:

Восстановите backup:

```powershell
# Распакуйте backup
Expand-Archive -Path public/images-backup-*.zip -DestinationPath public/ -Force

# Перезапустите dev server
npm run dev
```

### Альтернатива: Частичное удаление

Можно удалить только самые большие папки:

```powershell
# Удалить только изображения пергол (~300MB)
Remove-Item -Path public/images/pergulot -Recurse -Force

# Удалить только fancy изображения (~100MB)
Remove-Item -Path public/images/fancy -Recurse -Force

# Оставить логотипы и другие мелкие файлы локально
```

## Структура в S3

После миграции в S3 будет:

```
s3://pashkovsky-gallery/
└── images/
    ├── dgamim/
    │   ├── atlas/1.webp
    │   └── ...
    ├── fancy/
    ├── fromShetah/
    ├── logos/
    ├── mestor/
    ├── pergulot/
    │   ├── ashdod/IMG_20230824_155546.webp
    │   └── ...
    ├── profiles/
    ├── rails/
    ├── services/
    └── windows/
```

URL изображений:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/pergulot/ashdod/IMG_20230824_155546.webp
```

## Преимущества

✅ **Производительность**: Быстрая загрузка из S3
✅ **Масштабируемость**: Неограниченное хранилище
✅ **CDN**: Можно добавить CloudFront для еще большей скорости
✅ **Размер деплоя**: Меньше размер проекта в Vercel/хостинге (экономия ~500-700MB)
✅ **Стоимость**: ~$0.50/месяц для 800 файлов (~5GB)
✅ **Git**: Быстрее push/pull, меньше размер репозитория

## Что происходит с изображениями

### До миграции:
- Изображения в `public/images/` (~500-700MB)
- Деплой включает все изображения
- Git репозиторий большой
- Vercel может достичь лимита размера

### После миграции:
- Изображения в S3
- `public/images/` можно удалить
- Деплой легкий и быстрый
- Git репозиторий маленький
- Неограниченное хранилище в S3

## Откат

Если что-то пошло не так:

1. Восстановите backup:
   ```powershell
   Expand-Archive -Path public/images-backup.zip -DestinationPath public/
   ```

2. Верните старый `next.config.js`:
   ```powershell
   Copy-Item next.config.backup.js next.config.js
   ```

3. Перезапустите dev server

## Troubleshooting

### Изображения не загружаются (403 Forbidden):
- Проверьте Bucket Policy (должна разрешать публичный GET)
- Проверьте Block Public Access (должен быть отключен)

### Изображения не загружаются (CORS error):
- Настройте CORS в S3 (см. `S3_MIGRATION_GUIDE.md`)

### Некоторые изображения не мигрировали:
- Проверьте логи миграции
- Проверьте права IAM пользователя
- Проверьте лимиты S3

### Медленная загрузка:
- Добавьте CloudFront CDN (см. `S3_MIGRATION_GUIDE.md`)
- Проверьте регион S3 (должен быть близко к пользователям)

