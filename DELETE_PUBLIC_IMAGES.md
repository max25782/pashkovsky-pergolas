# 🗑️ Удаление изображений из public/ после миграции в S3

## ✅ Что можно безопасно удалить:

После миграции всех изображений в S3, можно удалить папку `public/images/` со всеми подпапками:

- ✅ `public/images/dgamim/` - модели пергол
- ✅ `public/images/fancy/` - декоративные элементы
- ✅ `public/images/fromShetah/` - видео и изображения
- ✅ `public/images/mestor/` - изображения
- ✅ `public/images/pergulot/` - проекты пергол
- ✅ `public/images/profiles/` - профили (теперь из JSON)
- ✅ `public/images/rails/` - перила
- ✅ `public/images/services/` - услуги
- ✅ `public/images/windows/` - окна
- ✅ `public/images/logos/` - логотипы партнеров (если мигрированы)
- ✅ `public/hero/` - видео и изображения для hero секции (мигрированы в S3)

## ⚠️ Что НУЖНО оставить:

Эти файлы критичны для работы сайта и генерации PDF:

- ✅ `public/fonts/` - **Шрифты для PDF** (NotoSansHebrew-*.ttf)
- ✅ `public/logo.png` - **Логотип для PDF**
- ✅ `public/logo-transparent.png` - **Логотип для PDF** (предпочтительно)
- ✅ `public/favicon.svg` - Favicon сайта
- ✅ `public/data/` - **JSON файлы** (profiles.json, articles.json и т.д.)
- ✅ `public/video/` - Видео файлы (если используются)

---

## 🚀 Как удалить безопасно:

### Вариант 1: Автоматический скрипт (РЕКОМЕНДУЕТСЯ)

```powershell
npm run delete:public-images
```

**Что делает скрипт:**
1. ✅ Проверяет, что S3 настроен
2. ✅ Удаляет только папки с изображениями
3. ✅ Оставляет критичные файлы (шрифты, логотип, данные)
4. ✅ Показывает статистику (сколько места освобождено)

### Вариант 2: Ручное удаление

**Сначала создай backup:**

```powershell
# Создать архив на всякий случай
Compress-Archive -Path public/images -DestinationPath "public/images-backup-$(Get-Date -Format 'yyyy-MM-dd').zip"
```

**Затем удали:**

```powershell
# Удалить папки с изображениями
Remove-Item -Recurse -Force public/images/dgamim
Remove-Item -Recurse -Force public/images/fancy
Remove-Item -Recurse -Force public/images/fromShetah
Remove-Item -Recurse -Force public/images/mestor
Remove-Item -Recurse -Force public/images/pergulot
Remove-Item -Recurse -Force public/images/profiles
Remove-Item -Recurse -Force public/images/rails
Remove-Item -Recurse -Force public/images/services
Remove-Item -Recurse -Force public/images/windows
Remove-Item -Recurse -Force public/images/logos

# Если папка images пустая, можно удалить её тоже
Remove-Item -Force public/images
```

---

## ✅ Что уже исправлено:

1. ✅ **Profiles page** - теперь использует только JSON, не читает файлы напрямую
2. ✅ **Все компоненты** - используют `getImageUrl()` который возвращает S3 URL
3. ✅ **PDF генерация** - использует локальные шрифты и логотип из `public/`

---

## 📋 Чеклист перед удалением:

- [ ] Убедись, что все изображения мигрированы в S3
- [ ] Проверь, что `AWS_S3_BUCKET_NAME` или `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` настроены
- [ ] Протестируй сайт - все изображения должны загружаться из S3
- [ ] Протестируй генерацию PDF - должна работать с локальными шрифтами и логотипом
- [ ] Создай backup (на всякий случай)
- [ ] Запусти `npm run delete:public-images`

---

## 💾 Восстановление из backup:

Если что-то пошло не так:

```powershell
# Распаковать backup
Expand-Archive -Path public/images-backup-YYYY-MM-DD.zip -DestinationPath public/ -Force
```

---

## 📊 Ожидаемый результат:

После удаления:
- ✅ Освободится **~500-700 MB** дискового пространства
- ✅ Сайт будет работать только с S3
- ✅ PDF генерация будет работать (использует локальные файлы)
- ✅ Все изображения будут загружаться быстрее (S3 CDN)

---

## ⚠️ Важно:

**НЕ удаляй:**
- ❌ `public/fonts/` - нужны для PDF
- ❌ `public/logo*.png` - нужны для PDF
- ❌ `public/data/` - JSON файлы с метаданными
- ❌ `public/favicon.svg` - favicon сайта

**Можно удалить:**
- ✅ `public/images/` - все изображения (если мигрированы в S3)

---

**Готово к удалению?** Запусти `npm run delete:public-images` 🚀


