# PDF Generator для предложений - Инструкция

## ✅ Что создано:

### 1. **PDF шаблон** (`lib/pdf/offer-pdf-template.tsx`)
- Красивый дизайн на иврите (RTL)
- Включает:
  - Логотип и данные компании
  - Информация о клиенте
  - Размеры пергулы (width, length, height, area)
  - Материалы (алюминий премиум)
  - Детали сантафа (если включен)
  - Полный breakdown цен
  - **תנאי תשלום** (условия оплаты: 30% + 40% + 30%)
  - **אחריות** (гарантия: 5 лет на алюминий, 2 года на электрику)
  - Контактная информация в footer

### 2. **Функция генерации** (`lib/pdf/generate-offer-pdf.ts`)
```typescript
// Генерирует PDF buffer из данных предложения
async function generateOfferPdf(offer: Offer): Promise<Buffer>

// Генерирует имя файла
function generateOfferPdfFilename(offer: Offer): string
// → "offer_{id}_{customerName}_{date}.pdf"
```

### 3. **API endpoint** (`app/api/offers/[id]/pdf/route.ts`)

#### POST `/api/offers/[id]/pdf`
- Генерирует PDF
- Загружает в S3 (если настроен)
- Сохраняет URL в `offer.pdf_url`
- Возвращает `{ pdfUrl, filename }`

#### GET `/api/offers/[id]/pdf`
- Прямое скачивание PDF
- Не сохраняет в БД
- Возвращает PDF файл

### 4. **Кнопки в UI** (обновлен `OffersList.tsx`)
- **"צור PDF"** - если PDF еще не создан
- **"הורד PDF"** - если PDF уже существует
- Автообновление после генерации

### 5. **Обновлена БД миграция**
- Добавлено поле `pdf_url TEXT` в таблицу `offers`

## 🚀 Установка:

### 1. Установите зависимость:
```bash
npm install @react-pdf/renderer
```

### 2. Обновите миграцию БД:
```sql
-- Добавьте в offers table (если еще не добавлено):
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS pdf_url TEXT;
```

Или запустите обновленную миграцию из `supabase/migrations/create_offers_table.sql`

### 3. Перезапустите dev server:
```bash
npm run dev
```

## 📄 Как использовать:

### В коде (программно):
```typescript
import { generateOfferPdf, generateOfferPdfFilename } from '@/lib/pdf/generate-offer-pdf'

// Генерация PDF
const pdfBuffer = await generateOfferPdf(offer)
const filename = generateOfferPdfFilename(offer)

// Сохранение локально (для тестирования)
import fs from 'fs'
fs.writeFileSync(`./test-${filename}`, pdfBuffer)
```

### Через API:
```typescript
// Создать и сохранить PDF в S3
const response = await fetch(`/api/offers/${offerId}/pdf`, {
  method: 'POST',
})
const { pdfUrl, filename } = await response.json()

// Прямое скачивание
window.open(`/api/offers/${offerId}/pdf`, '_blank')
```

### Через UI:
1. Откройте сделку
2. Создайте предложение
3. В списке предложений нажмите **"צור PDF"**
4. PDF создается, сохраняется в S3, кнопка меняется на **"הורד PDF"**
5. Нажмите **"הורד PDF"** для скачивания

## 📊 Что включено в PDF:

### Header (шапка):
- Название компании: **Pashkovsky Group**
- Подзаголовок: פתרונות אלומיניום מתקדמים
- Контакты: телефон, email, адрес

### Информация о клиенте:
- Имя клиента
- Телефон
- Дата создания предложения

### Детали пергулы:
- Размеры: width × length × height
- Площадь (area)
- Материал: אלומיניום פרימיום

### Сантаф (если включен):
- Тип: בסיסי / עם קונסטרוקציה
- Цена

### Pricing breakdown:
1. Пергола: area × цена за м²
2. Сантаф (если есть)
3. **מחיר לפני מע״מ** (до НДС)
4. **מע״מ 18%**
5. **מחיר אחרי מע״מ** (после НДС)
6. **הנחה** (скидка, если есть)
7. **מחיר סופי** ← выделено зеленым, крупным шрифтом

### תנאי תשלום (условия оплаты):
- מקדמה של 30% עם חתימת ההסכם
- 40% עם הזמנת החומרים
- 30% יתרה עם סיום ההתקנה
- תוקף ההצעה: 30 יום

### אחריות (гарантия):
- 5 שנים על קונסטרוקציית האלומיניום
- שנתיים על מערכות חשמליות
- שירות לקוחות זמין 24/7
- תחזוקה שנתית מומלצת

### Footer:
- Контакты компании
- ח.פ и אישור עוסק מורשה

## 🎨 Дизайн:

- ✅ RTL (справа налево)
- ✅ Профессиональный layout
- ✅ Синяя цветовая схема (#2563eb)
- ✅ Структурированные секции с background
- ✅ Четкая типография
- ✅ Выделение важных элементов

## ⚙️ Конфигурация S3:

PDF автоматически загружается в S3, если настроены переменные:

```env
AWS_S3_BUCKET_NAME=your-bucket
AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

Путь в S3: `offers/{offerId}/{filename}.pdf`

Если S3 не настроен - возвращает base64 data URL (не рекомендуется для production).

## 🔧 Customization:

### Изменить данные компании:
Отредактируйте `lib/pdf/offer-pdf-template.tsx`:
```tsx
<Text style={styles.companyName}>Ваша компания</Text>
<Text style={styles.companyInfo}>Ваш слоган</Text>
<Text style={styles.companyInfo}>Телефон: ... | Email: ...</Text>
```

### Изменить условия оплаты:
```tsx
<Text style={styles.termItem}>• ваш текст</Text>
```

### Изменить цвета/стили:
Отредактируйте `StyleSheet.create({ ... })` в начале файла.

### Добавить логотип:
```tsx
import { Image } from '@react-pdf/renderer'

<Image src="/logo.png" style={{ width: 100, height: 50 }} />
```

## 🐛 Troubleshooting:

### Ошибка "Cannot find module '@react-pdf/renderer'"
```bash
npm install @react-pdf/renderer
```

### PDF пустой или с ошибками
- Проверьте, что все поля в `offer` заполнены
- Проверьте консоль на ошибки рендеринга

### S3 upload fails
- Проверьте AWS переменные в `.env`
- Проверьте права IAM пользователя
- Проверьте, что bucket существует

### Иврит отображается неправильно
- Добавьте Hebrew font (Heebo, Rubik)
- Раскомментируйте `Font.register` в `offer-pdf-template.tsx`

## 📝 TODO (опционально):

- [ ] Добавить Hebrew font для правильного отображения иврита
- [ ] Добавить логотип компании в header
- [ ] Добавить QR код для быстрой оплаты
- [ ] Добавить подпись клиента в PDF (если approved)
- [ ] Добавить отправку PDF по email/WhatsApp
- [ ] Добавить watermark для неутвержденных предложений

## ✅ Готово!

PDF генератор полностью интегрирован и готов к использованию! 🎉

