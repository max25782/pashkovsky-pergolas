# Модуль отправки и утверждения предложений

## ✅ Что создано:

### 1. **WhatsApp интеграция** (`lib/offer-sharing.ts`)

#### Функция `sendOfferViaWhatsApp(offer)`
Генерирует ссылку для отправки через WhatsApp:
```
https://wa.me/+972501234567?text=<encoded message>
```

Сообщение включает:
- Приветствие
- Ссылку на страницу утверждения
- Финальную цену
- Подпись компании

#### Функция `openWhatsApp(offer)`
Открывает WhatsApp в новом окне с pre-filled сообщением.

### 2. **Email отправка** (`app/api/offers/[id]/send-email/route.ts`)

#### API POST `/api/offers/[id]/send-email`

**Тело запроса:**
```json
{
  "toEmail": "customer@example.com",
  "customerName": "יוסי כהן"
}
```

**Использует Resend API** для отправки профессиональных HTML emails.

**Email включает:**
- Красивый HTML дизайн (RTL)
- Логотип и брендинг компании
- Детали предложения
- Кнопка "לצפייה ואישור ההצעה"
- Контактную информацию

**Переменные окружения:**
```env
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@pashkovsky-group.com
```

### 3. **Страница утверждения** (`/offers/[id]/approve`)

#### Функционал:
- ✅ Показ резюме предложения
- ✅ Поля: Имя, Телефон
- ✅ Signature Pad (canvas для подписи)
- ✅ Кнопка "מאשר את ההצעה"
- ✅ Валидация всех полей
- ✅ Сохранение подписи в base64
- ✅ Обновление статуса (approved=true, approvedAt=now())
- ✅ Success screen после утверждения

#### Что показывается:
1. **Header** - название компании и логотип
2. **Offer Summary**:
   - Размеры пергулы
   - Гобх (если есть)
   - Тип сантафа (если включен)
3. **Pricing Breakdown**:
   - Цена до НДС
   - НДС 18%
   - Скидка (если есть)
   - **Финальная цена** (крупно, зеленым)
4. **Форма утверждения**:
   - Поле "שם מלא"
   - Поле "טלפון"
   - Canvas для подписи
   - Кнопка "נקה חתימה"
5. **Кнопка утверждения**: "✓ מאשר את ההצעה"

### 4. **API утверждения** (`app/api/offers/[id]/approve/route.ts`)

#### POST `/api/offers/[id]/approve`

**Тело запроса:**
```json
{
  "name": "יוסי כהן",
  "phone": "050-1234567",
  "signatureImage": "data:image/png;base64,..."
}
```

**Обновляет:**
- `approved = true`
- `approved_at = now()`
- `signature_image = base64 data`
- `customer_name` (обновляется, если изменилось)
- `customer_phone` (обновляется, если изменилось)

### 5. **Обновлен OffersList** - кнопки действий

#### Кнопки в каждом предложении:
1. **PDF** - генерация/скачивание PDF
2. **WhatsApp** - отправка через WhatsApp (если есть телефон)
3. **Email** - отправка на email

## 🚀 Установка:

### 1. Установите зависимости:
```bash
npm install @react-pdf/renderer react-signature-canvas
```

### 2. Настройте Email (Resend):

Зарегистрируйтесь на [resend.com](https://resend.com) и получите API key.

Добавьте в `.env`:
```env
RESEND_API_KEY=re_your_api_key
FROM_EMAIL=noreply@pashkovsky-group.com
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 3. Обновите миграцию БД (если нужно):

Убедитесь, что в таблице `offers` есть поле `pdf_url`:
```sql
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS pdf_url TEXT;
```

### 4. Перезапустите dev server:
```bash
npm run dev
```

## 📱 Как использовать:

### В админке (DealModal):

1. **Откройте сделку**
2. **Создайте предложение**
3. **В списке предложений** появятся кнопки:
   - **PDF** - создать/скачать PDF
   - **WhatsApp** - отправить клиенту
   - **Email** - отправить по email

### WhatsApp:

```typescript
import { openWhatsApp } from '@/lib/offer-sharing'

// При клике на кнопку WhatsApp
openWhatsApp(offer)
// → Открывает WhatsApp с pre-filled сообщением
```

Сообщение:
```
שלום יוסי כהן,

הצעת המחיר שלך מוכנה! 🎉

לצפייה בהצעת מחיר ולחץ כאן:
https://your-domain.com/offers/xxx/approve

סכום: ₪24,500.00

בברכה,
Pashkovsky Group
```

### Email:

```typescript
// API call
const response = await fetch(`/api/offers/${offerId}/send-email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    toEmail: 'customer@example.com',
    customerName: 'יוסי כהן',
  }),
})
```

Email будет содержать:
- Красивый HTML дизайн
- Все детали предложения
- Кнопку для утверждения
- Контакты компании

### Утверждение клиентом:

1. Клиент получает ссылку (WhatsApp/Email)
2. Открывает `/offers/[id]/approve`
3. Видит детали предложения
4. Заполняет имя и телефон
5. Ставит подпись на canvas
6. Нажимает "מאשר את ההצעה"
7. Видит success screen
8. В БД сохраняется:
   - `approved = true`
   - `approved_at = timestamp`
   - `signature_image = base64`

## 🎨 UI/UX Features:

### Страница утверждения:
- ✅ Градиентный фон (slate-900 → slate-800)
- ✅ Responsive design
- ✅ RTL (справа налево)
- ✅ Loading states
- ✅ Error handling
- ✅ Валидация формы
- ✅ Success animation
- ✅ Кнопка очистки подписи

### OffersList (обновлен):
- ✅ Компактные кнопки действий
- ✅ Иконки для каждой кнопки
- ✅ Tooltip на hover
- ✅ Цветовая кодировка:
  - PDF: синий
  - WhatsApp: зеленый
  - Email: фиолетовый

## 🔧 Customization:

### Изменить текст WhatsApp:
Отредактируйте `lib/offer-sharing.ts`:
```typescript
const message = encodeURIComponent(
  `ваш текст здесь\n${offerUrl}`
)
```

### Изменить Email дизайн:
Отредактируйте `lib/offer-sharing.ts` → `getOfferEmailBody()`.

### Изменить страницу утверждения:
Отредактируйте `app/offers/[id]/approve/page.tsx`.

## 📊 Workflow:

```
1. Создание предложения
   ↓
2. [Админ] Нажимает кнопку WhatsApp/Email
   ↓
3. Клиент получает ссылку
   ↓
4. Клиент открывает /offers/[id]/approve
   ↓
5. Клиент видит детали и цену
   ↓
6. Клиент заполняет форму и подписывает
   ↓
7. Клиент нажимает "מאשר את ההצעה"
   ↓
8. API сохраняет подпись и статус
   ↓
9. Клиент видит success message
   ↓
10. [Админ] Видит approved=true в админке
```

## 🐛 Troubleshooting:

### Ошибка "Email service not configured"
→ Добавьте `RESEND_API_KEY` в `.env`

### WhatsApp не открывается
→ Убедитесь, что у offer есть `customerPhone`
→ Проверьте формат телефона (должен быть +972...)

### Подпись не сохраняется
→ Убедитесь, что canvas не пустой
→ Проверьте, что signatureRef правильно инициализирован

### Email не приходит
→ Проверьте Resend Dashboard на ошибки
→ Убедитесь, что FROM_EMAIL верифицирован в Resend

## 📝 TODO (опционально):

- [ ] Добавить SMS отправку (Twilio)
- [ ] Добавить Telegram отправку
- [ ] Добавить напоминания клиенту (если не утвердил за N дней)
- [ ] Добавить аналитику (сколько предложений утверждено)
- [ ] Добавить возможность отклонить предложение с комментарием
- [ ] Добавить versioning (если клиент просит изменения)

## ✅ Готово!

Полный модуль отправки и утверждения предложений готов к использованию! 🎉

### Основные возможности:
✅ WhatsApp интеграция
✅ Email отправка (Resend API)
✅ Страница утверждения с подписью
✅ Signature Pad (canvas)
✅ API для утверждения
✅ Кнопки в админке (PDF, WhatsApp, Email)
✅ Success screens
✅ Error handling
✅ RTL дизайн

