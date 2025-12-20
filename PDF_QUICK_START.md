# ✅ PDF Generator Ready!

Система генерации PDF с **RTL ивритом** полностью настроена и готова к работе!

## 🎉 Что работает:

✅ Puppeteer + Chromium (Vercel-совместимый)
✅ HTML → PDF конвертация  
✅ Noto Sans Hebrew шрифты (из `app/fronts/`)  
✅ RTL direction для иврита  
✅ API `/api/offers/[id]/pdf` с кешированием  
✅ Загрузка в S3  
✅ Сохранение `pdf_url` в БД  

---

## 🚀 Как использовать:

### 1. Запусти dev server
```bash
npm run dev
```

### 2. Тестируй в админке
1. Открой: `http://localhost:3000/he/admin/deals`
2. Открой любую сделку
3. Нажми **PDF** в списке предложений
4. PDF сгенерируется автоматически!

---

## 📋 API:

```bash
# Генерация PDF
POST /api/offers/{id}/pdf
→ { pdfUrl: "https://...", cached: false }

# Принудительная регенерация
POST /api/offers/{id}/pdf?force=true

# Скачать существующий
GET /api/offers/{id}/pdf
→ редирект на S3 URL
```

---

## 🌐 Deploy на Vercel:

Просто задеплой! Vercel автоматически:
- Установит `@sparticuz/chromium`
- Настроит Node.js runtime
- Включит timeout 60s

**Готово!** 🎉




