# Модуль утверждения и отправки предложений

## ✅ Что создано:

### 1. **WhatsApp Integration** (`lib/whatsapp-utils.ts`)

#### Функции:
```typescript
// Генерирует WhatsApp ссылку с сообщением
sendOfferViaWhatsApp(offer, publicOfferUrl): string

// Открывает WhatsApp с предложением
openWhatsAppWithOffer(offer, publicOfferUrl): void

// Генерирует публичный URL для утверждения
getPublicOfferUrl(offerId, baseUrl?): string
```

#### Формат сообщения:
```
שלום {customerName},

הצעת המחיר שלך מוכנה!

📋 פרטי ההצעה:
• גודל: 4×6 מ׳
• מחיר סופי: ₪24,723.36

לצפייה ואישור ההצעה לחץ כאן:
https://example.com/offers/{id}/approve

תודה,
Pashkovsky Group
```

### 2. **Email Integration** (`app/api/offers/[id]/send-email/route.ts`)

#### API endpoint: `POST /api/offers/[id]/send-email`

**Request:**
```json
{
  "email": "client@example.com",
  "baseUrl": "https://pashkovsky-group.com"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "xxx",
  "publicOfferUrl": "https://pashkovsky-group.com/offers/{id}/approve"
}
```

**Требует:**
- Установку: `npm install resend`
- Переменную окружения: `RESEND_API_KEY`
- Настроенный домен в Resend

**Email включает:**
- ✅ Красивый HTML дизайн (RTL для иврита)
- ✅ Логотип и данные компании
- ✅ Детали предложения (размеры, цена)
- ✅ Кнопку "לצפייה באישור ההצעה"
- ✅ Контактную информацию в footer

### 3. **Approval API** (`app/api/offers/[id]/approve/route.ts`)

#### API endpoint: `POST /api/offers/[id]/approve`

**Request:**
```json
{
  "name": "יוסי כהן",
  "phone": "050-1234567",
  "signatureImage": "data:image/png;base64,..."
}
```

**Response:**
```json
{
  "success": true,
  "approved": true,
  "approvedAt": "2024-12-05T12:00:00Z"
}
```

**Что делает:**
1. Проверяет обязательные поля
2. Обновляет offer:
   - `approved = true`
   - `approved_at = now()`
   - `signature_image = base64 подпись`
   - Опционально обновляет имя и телефон
3. Возвращает успех

### 4. **Approval Page** (`app/offers/[id]/approve/page.tsx`)

#### Public страница: `/offers/{id}/approve`

**Что показывает:**
1. **Заголовок** - Pashkovsky Group
2. **Резюме предложения:**
   - Размеры пергулы (width × length × height)
   - Площадь
   - Сантаф (если включен)
   - Breakdown цен:
     - לפני מע״מ
     - מע״מ 18%
     - הנחה (если есть)
     - **מחיר סופי** (крупно, зеленым)

3. **Форма утверждения:**
   - Поле "שם מלא"
   - Поле "טלפון"
   - **Signature Pad** (canvas для подписи)
   - Кнопка "נקה חתימה"
   - Кнопка "מאשר את ההצעה"

4. **Footer** - контакты компании

**После утверждения:**
- Показывает успех (галочка)
- Перенаправляет на `/offers/{id}/success`

### 5. **Success Page** (`app/offers/[id]/success/page.tsx`)

#### Страница: `/offers/{id}/success`

Показывает:
- ✅ Большая зеленая галочка
- "ההצעה אושרה בהצלחה!"
- "נציג שלנו יצור איתך קשר בקרוב"
- Контакты компании

### 6. **Updated OffersList Component**

Теперь включает кнопки действий:

```tsx
<OffersList dealId={dealId} refreshTrigger={trigger} />
```

**Кнопки для каждого предложения:**
- **PDF** - скачать или создать PDF
- **WhatsApp** - отправить ссылку в WhatsApp
- **Email** - отправить ссылку на email

## 🚀 Установка:

### 1. Установите зависимости:
```bash
npm install resend react-signature-canvas
npm install --save-dev @types/react-signature-canvas
```

### 2. Настройте Resend:

#### Зарегистрируйтесь на resend.com:
1. Создайте аккаунт
2. Добавьте домен (например, `pashkovsky-group.com`)
3. Настройте DNS записи (MX, TXT, CNAME)
4. Получите API ключ

#### Добавьте в `.env`:
```env
RESEND_API_KEY=re_...
```

### 3. Обновите БД (уже добавлено):
```sql
-- Поля approved, approved_at, signature_image, pdf_url уже есть в миграции
```

### 4. Перезапустите dev server:
```bash
npm run dev
```

## 📋 Как использовать:

### В админке (DealModal):

1. **Создайте предложение** - кнопка "יצירת הצעת מחיר"
2. **В списке предложений** появятся кнопки:

#### PDF:
- Если PDF не создан → кнопка "צור PDF"
- Если создан → кнопка "הורד PDF"

#### WhatsApp:
- Кликните "WhatsApp"
- Откроется WhatsApp Web/App с готовым сообщением
- Сообщение включает ссылку на `/offers/{id}/approve`

#### Email:
- Кликните "שלח באימייל"
- Введите email клиента
- Email отправится с красивым HTML шаблоном

### Клиент получает ссылку:

1. **Переходит на** `/offers/{id}/approve`
2. **Видит** все детали предложения
3. **Заполняет** имя и телефон
4. **Подписывает** на canvas
5. **Жмет** "מאשר את ההצעה"
6. **Перенаправляется** на success страницу

### В админке:

- Offer обновится: `approved = true`
- Статус изменится с "ממתין לאישור" на "אושר" (галочка)
- Подпись сохранится в `signature_image`

## 🎨 Customization:

### Изменить WhatsApp сообщение:
```typescript
// lib/whatsapp-utils.ts
const message = `ваш текст...`
```

### Изменить Email шаблон:
```typescript
// app/api/offers/[id]/send-email/route.ts
html: `...ваш HTML...`
```

### Изменить approval page:
```tsx
// app/offers/[id]/approve/page.tsx
// Отредактируйте JSX
```

### Настроить Signature Pad:
```tsx
<SignatureCanvas
  ref={signaturePadRef}
  canvasProps={{
    className: 'w-full h-48 rounded-lg',
    // Добавьте другие props
  }}
  penColor="black"
  backgroundColor="white"
/>
```

## 🔒 Security Notes:

### Public страница `/offers/{id}/approve`:
- ✅ Не требует авторизации (публичная)
- ✅ ID предложения не является секретом
- ⚠️ Любой с ссылкой может утвердить

### Улучшения безопасности (optional):
1. Добавить UUID токен в ссылку: `/offers/{id}/approve?token=xxx`
2. Проверять токен перед показом страницы
3. Ограничить количество попыток утверждения
4. Добавить email/SMS подтверждение

## 📊 Flow диаграмма:

```
Admin создает предложение
        ↓
Генерируется ID предложения
        ↓
Admin нажимает "WhatsApp" или "Email"
        ↓
Клиент получает ссылку: /offers/{id}/approve
        ↓
Клиент переходит по ссылке
        ↓
Видит детали предложения
        ↓
Заполняет имя, телефон, подпись
        ↓
Жмет "מאשר את ההצעה"
        ↓
POST /api/offers/{id}/approve
        ↓
Offer.approved = true
        ↓
Redirect на /offers/{id}/success
        ↓
Admin видит обновленный статус
```

## 🐛 Troubleshooting:

### Email не отправляется:
```bash
# Проверьте RESEND_API_KEY
echo $RESEND_API_KEY

# Проверьте домен в Resend dashboard
# Убедитесь, что DNS записи настроены
```

### WhatsApp не открывается:
- Проверьте формат номера телефона (должен начинаться с 972)
- Убедитесь, что WhatsApp установлен на устройстве

### Signature Pad не работает:
```bash
npm install react-signature-canvas
```

### Approval не сохраняется:
- Проверьте, что поля `approved`, `approved_at`, `signature_image` есть в БД
- Проверьте консоль на ошибки

## ✅ Готово!

Полный модуль утверждения и отправки предложений готов к использованию! 🎉

### Следующие шаги (optional):
- [ ] Добавить email уведомления админу при утверждении
- [ ] Добавить SMS отправку (Twilio)
- [ ] Добавить аналитику (сколько предложений открыто, утверждено)
- [ ] Добавить возможность отклонить предложение
- [ ] Добавить комментарии клиента при утверждении

