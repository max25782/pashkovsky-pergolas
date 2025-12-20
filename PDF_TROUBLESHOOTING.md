# 🐛 PDF Hebrew Display Issue - Troubleshooting

Проблема: PDF генерируется, но иврит отображается как кракозябры (например: `ÝÙÞÓçêÞÜÙÙÞÙÐ`).

## ✅ Что исправлено:

1. ✅ Добавлен `charset=utf-8` в data URI шрифтов
2. ✅ Добавлен `<meta charset="UTF-8">` в HTML
3. ✅ Добавлен `Accept-Charset: utf-8` в Puppeteer headers
4. ✅ Добавлены `!important` в CSS для принудительного применения шрифтов
5. ✅ Добавлен `unicode-range` для ивритских символов
6. ✅ Улучшено логирование для диагностики

---

## 🔍 Диагностика (шаг за шагом):

### Шаг 1: Проверь консоль при генерации PDF

Перезапусти сервер и сгенерируй PDF. В консоли должны быть:

```
[Font] Attempting to load font: C:\...\app\fronts\Noto_Sans_Hebrew\static\NotoSansHebrew-Regular.ttf
[Font] ✅ Font loaded successfully: app/fronts/... (XXXXX chars base64)
[Font] ✅ Fonts embedded successfully (Regular: true, Bold: true)
[PDF Render] HTML length: XXXXX characters
[PDF Render] ✅ PDF generated successfully, size: XXXXX bytes
```

**Если видишь `❌ Font file not found`:**
- Проверь путь: `app/fronts/Noto_Sans_Hebrew/static/`
- Может быть опечатка: `fronts` вместо `fonts`?
- Проверь существование файлов командой:
  ```bash
  dir app\fronts\Noto_Sans_Hebrew\static\*.ttf
  ```

---

### Шаг 2: Проверь размер base64

Если шрифты загружаются, но иврит всё равно кракозябры:

**Проблема:** Возможно, Puppeteer не обрабатывает data URI правильно.

**Решение:** Попробуем **другой подход** - копирование шрифтов в `public/fonts/` и использование относительных путей:

```bash
# Скопируй шрифты
mkdir public\fonts
copy app\fronts\Noto_Sans_Hebrew\static\NotoSansHebrew-Regular.ttf public\fonts\
copy app\fronts\Noto_Sans_Hebrew\static\NotoSansHebrew-Bold.ttf public\fonts\
```

Затем обнови `lib/pdf/offer-html-template.ts`:

```typescript
<link rel="stylesheet" href="/fonts/noto-sans-hebrew.css">
```

И создай `public/fonts/noto-sans-hebrew.css`:

```css
@font-face {
  font-family: 'HebrewFont';
  src: url('/fonts/NotoSansHebrew-Regular.ttf') format('truetype');
  font-weight: 400;
}
@font-face {
  font-family: 'HebrewFont';
  src: url('/fonts/NotoSansHebrew-Bold.ttf') format('truetype');
  font-weight: 700;
}
```

**НО:** Puppeteer должен иметь доступ к локальному серверу для загрузки этих файлов.

---

### Шаг 3: Альтернативное решение - Google Fonts

Если data URI не работает, используй Google Fonts (требует интернет при генерации):

Обнови `lib/pdf/offer-html-template.ts`:

```html
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Noto Sans Hebrew', Arial, sans-serif !important;
    }
  </style>
</head>
```

И измени в `render-html-to-pdf.ts`:

```typescript
await page.setContent(html, {
  waitUntil: 'networkidle2', // Подожди загрузки внешних шрифтов
  timeout: 60000, // Увеличь timeout до 60s
})
```

---

## 🔧 Быстрое решение (рекомендуется):

Попробуй **Arial Unicode MS** или **DejaVu Sans** - они поддерживают иврит без встраивания:

```css
body {
  font-family: 'Arial Unicode MS', 'DejaVu Sans', Arial, sans-serif !important;
}
```

Chromium в @sparticuz/chromium обычно включает базовые шрифты с Unicode.

---

## 📋 Следующие шаги:

1. Перезапусти сервер: `npm run dev`
2. Проверь логи в консоли
3. Если `❌ Font file not found` - проверь путь
4. Если шрифты загружаются, но иврит кракозябры - попробуй Google Fonts
5. Если ничего не помогает - используй Arial Unicode MS

---

## 💡 Лучшее решение для production:

**Используй CDN шрифтов:**

```html
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;700&display=swap" rel="stylesheet">
```

Rubik - отличный шрифт для иврита, загружается быстро, и Puppeteer гарантированно его обработает.

Обнови `lib/pdf/offer-html-template.ts` - замени `${fontsCss}` на:

```html
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;700&display=swap" rel="stylesheet">
<style>
  body {
    font-family: 'Rubik', Arial, sans-serif !important;
  }
</style>
```

И увеличь `waitUntil` до `networkidle2` в `render-html-to-pdf.ts`.

---

Попробуй эти решения по порядку и пришли логи из консоли!





