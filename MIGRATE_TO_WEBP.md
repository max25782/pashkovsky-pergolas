# Миграция на WebP

## Шаги для использования WebP во всём проекте:

### 1. Конвертация всех JPG → WebP
```bash
npm run jpg:webp
```
Этот скрипт:
- Найдёт все `.jpg`/`.jpeg` в `public/images/` и `public/hero/`
- Создаст `.webp` файлы с качеством 90%
- Оставит оригиналы (можно удалить вручную после проверки)

### 2. Обновление JSON галереи
```bash
npm run gen:gallery
```
Скрипт автоматически подхватит `.webp` файлы и обновит все JSON в `data/gallery/`.

### 3. Обновление ссылок в коде

#### services-section.tsx
Замените пути:
```tsx
const services = [
  { img: "/images/services/pergola.webp", ... },
  { img: "/images/services/railings.webp", ... },
  { img: "/images/services/fence.webp", ... },
  { img: "/images/services/mistora.webp", ... },
]
```

#### hero-section.tsx
Если используете статичные изображения (не фрейм-анимацию):
```tsx
const steps = Array.from({ length: 10 }, (_, i) => `/hero/step-${i + 1}.webp`);
```

### 4. Удаление старых JPG (опционально)
После проверки качества WebP:
```bash
# Windows PowerShell
Get-ChildItem -Path public\images -Include *.jpg,*.jpeg -Recurse | Remove-Item
Get-ChildItem -Path public\hero -Include *.jpg,*.jpeg -Recurse | Remove-Item
```

### 5. Перезапуск dev-сервера
```bash
npm run dev
```

## Преимущества WebP:
- ✅ На 25-35% меньше размер при том же качестве
- ✅ Поддержка прозрачности (как PNG)
- ✅ Поддержка всех современных браузеров
- ✅ Next.js автоматически создаст fallback для старых браузеров

## Поддержка браузеров:
- Chrome/Edge: все версии
- Firefox: 65+
- Safari: 14+ (iOS 14+, macOS Big Sur+)
- Старые браузеры: Next.js отдаст JPEG автоматически

## Настройки оптимизации (next.config.js):
- Качество по умолчанию: 75 (Next.js)
- Конвертация скриптом: 90 (высокое качество)
- Форматы: WebP, AVIF (ещё лучше сжатие)


