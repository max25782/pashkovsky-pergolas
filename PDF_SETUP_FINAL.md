# PDF Generation Setup - Final Steps

## ✅ Что уже сделано:

1. ✅ Установлены зависимости: `puppeteer-core`, `@sparticuz/chromium`
2. ✅ Создан `createBrowser()` helper для Vercel-совместимого Chromium
3. ✅ Создана утилита `renderHtmlToPdfBuffer(html)` для генерации PDF
4. ✅ Создан HTML-шаблон с поддержкой RTL иврита
5. ✅ API route `/api/offers/[id]/pdf` настроен с:
   - ✅ `runtime = 'nodejs'` (не Edge)
   - ✅ `maxDuration = 60` секунд
   - ✅ Поддержка `?force=true` для регенерации
   - ✅ Кеширование существующих PDF
6. ✅ Встроенные шрифты через base64 data URI

## ⚠️ Осталось сделать ВРУЧНУЮ:

### ✅ Шрифты уже есть!

У тебя уже есть **Noto Sans Hebrew** в:
```
app/fronts/Noto_Sans_Hebrew/static/NotoSansHebrew-Regular.ttf
app/fronts/Noto_Sans_Hebrew/static/NotoSansHebrew-Bold.ttf
```

Система автоматически их использует! Ничего скачивать не нужно.

### Перезапустить dev server и протестировать

```bash
npm run dev
```

### 3. Протестировать генерацию PDF

1. Открой админку: `http://localhost:3000/he/admin/deals`
2. Открой сделку (Deal Modal)
3. Нажми кнопку "PDF" в списке предложений (Offers List)
4. PDF должен сгенерироваться с правильным ивритом (RTL)

---

## 📝 Как работает система:

### API Endpoints:

#### `POST /api/offers/[id]/pdf`
- Генерирует PDF (или возвращает существующий)
- Параметр `?force=true` - принудительная регенерация
- Сохраняет PDF в S3
- Обновляет `pdf_url` в БД

#### `GET /api/offers/[id]/pdf`
- Редирект на существующий PDF URL

### В UI (`OffersList.tsx`):

- Если `offer.pdfUrl` пустой → кнопка "צור PDF"
- Если `offer.pdfUrl` есть → кнопка "הורד PDF"

---

## 🚀 Деплой на Vercel:

1. Убедись, что в `.env` на Vercel есть:
   ```
   AWS_S3_BUCKET_NAME=...
   AWS_S3_REGION=...
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. Vercel автоматически установит `@sparticuz/chromium` для serverless

3. PDF будет генерироваться с правильным ивритом

---

## 🐛 Troubleshooting:

### Если PDF не генерируется:

1. Проверь логи в терминале: `[PDF Generator]`, `[PDF Render]`, `[Browser]`
2. Убедись, что шрифты скачаны в `assets/fonts/`
3. Проверь `maxDuration` - может понадобиться больше времени

### Если иврит отображается как квадратики:

1. Проверь логи: `[Font] Font file not found` - должно быть `Font loaded successfully`
2. Шрифты находятся в: `app/fronts/Noto_Sans_Hebrew/static/`

### Если timeout на Vercel:

1. Увеличь `maxDuration` в `app/api/offers/[id]/pdf/route.ts`
2. Vercel Hobby plan: максимум 10s
3. Vercel Pro plan: максимум 60s

---

## ✨ Финальный чеклист:

- [x] ~~Скачать шрифты~~ (уже есть Noto Sans Hebrew в `app/fronts/`)
- [ ] Перезапустить `npm run dev`
- [ ] Протестировать генерацию PDF в localhost
- [ ] Задеплоить на Vercel
- [ ] Протестировать на production

После этого PDF будут генерироваться с **идеальным RTL ивритом**! 🎉

