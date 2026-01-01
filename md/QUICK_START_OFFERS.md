# Quick Start - Модуль предложений (Offers)

## ✅ Установлено:
- `@react-pdf/renderer` - для генерации PDF
- `resend` - для отправки email
- `react-signature-canvas` - для подписи клиента

## 🚀 Следующие шаги:

### 1. Запустите миграцию БД:

Откройте Supabase SQL Editor и выполните:

```sql
-- Скопируйте из supabase/migrations/create_offers_table.sql
-- Создаст таблицу offers со всеми полями
```

Или используйте Supabase CLI:
```bash
supabase db push
```

### 2. Настройте Email (Resend):

#### Регистрация:
1. Перейдите на https://resend.com
2. Создайте аккаунт
3. Добавьте домен (например, `pashkovsky-group.com`)
4. Настройте DNS записи:
   - MX запись
   - TXT запись (SPF)
   - CNAME запись (DKIM)
5. Получите API ключ в разделе "API Keys"

#### Добавьте в `.env`:
```env
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# S3 (для PDF)
AWS_S3_BUCKET_NAME=your-bucket
AWS_S3_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

### 3. Перезапустите dev server:

```powershell
npm run dev
```

### 4. Протестируйте модуль:

#### Создание предложения:
1. Откройте http://localhost:3000/he/admin/deals
2. Откройте любую сделку (или создайте новую)
3. Убедитесь, что у сделки есть `customer_name`
4. Нажмите зеленую кнопку **"יצירת הצעת מחיר"**
5. Заполните форму:
   - Размеры пергулы
   - Цены (редактируемые)
   - Сантаф (опционально)
   - Скидка
6. Нажмите **"שמור הצעת מחיר"**

#### Генерация PDF:
1. В списке предложений нажмите **"צור PDF"**
2. PDF создастся и загрузится в S3
3. Кнопка изменится на **"הורד PDF"**

#### Отправка в WhatsApp:
1. Убедитесь, что у предложения есть телефон клиента
2. Нажмите **"WhatsApp"**
3. Откроется WhatsApp Web/App с готовым сообщением
4. Отправьте сообщение клиенту

#### Отправка Email:
1. Нажмите **"שלח באימייל"**
2. Введите email клиента
3. Email отправится с красивым HTML шаблоном

#### Утверждение клиентом:
1. Клиент получает ссылку: `/offers/{id}/approve`
2. Переходит по ссылке
3. Видит все детали предложения
4. Заполняет имя и телефон
5. Подписывает на canvas
6. Жмет **"מאשר את ההצעה"**
7. Перенаправляется на success страницу

#### В админке:
- Статус предложения обновится: "אושר" ✅
- Появится зеленая галочка
- Подпись сохранится в БД

## 📁 Структура файлов:

### TypeScript/Types:
- `types/offer.ts` - интерфейсы Offer, OfferDraft
- `lib/offer-calculator.ts` - функция calculateOffer()

### Компоненты:
- `components/offers/CreateOfferModal.tsx` - форма создания
- `components/offers/OffersList.tsx` - список предложений

### PDF:
- `lib/pdf/offer-pdf-template.tsx` - React PDF шаблон
- `lib/pdf/generate-offer-pdf.ts` - функция generateOfferPdf()
- `app/api/offers/[id]/pdf/route.ts` - API для PDF

### Отправка:
- `lib/whatsapp-utils.ts` - WhatsApp integration
- `app/api/offers/[id]/send-email/route.ts` - Email API

### Утверждение:
- `app/offers/[id]/approve/page.tsx` - публичная страница
- `app/api/offers/[id]/approve/route.ts` - API утверждения
- `app/offers/[id]/success/page.tsx` - success страница

### API:
- `app/api/offers/route.ts` - CRUD операции

### База данных:
- `supabase/migrations/create_offers_table.sql` - миграция

## 🔧 Настройка (опционально):

### Изменить данные компании в PDF:
```tsx
// lib/pdf/offer-pdf-template.tsx
<Text style={styles.companyName}>Ваша компания</Text>
<Text style={styles.companyInfo}>Ваш слоган</Text>
<Text style={styles.companyInfo}>Телефон: ...</Text>
```

### Изменить Email шаблон:
```typescript
// app/api/offers/[id]/send-email/route.ts
html: `...ваш HTML...`
```

### Изменить WhatsApp сообщение:
```typescript
// lib/whatsapp-utils.ts
const message = `ваш текст...`
```

### Добавить логотип в PDF:
```tsx
import { Image } from '@react-pdf/renderer'

<Image src="/logo.png" style={{ width: 100, height: 50 }} />
```

## 🐛 Troubleshooting:

### Email не отправляется:
```bash
# Проверьте API ключ
echo $RESEND_API_KEY

# Проверьте домен в Resend dashboard
# Убедитесь, что DNS записи настроены (зеленая галочка)
```

### PDF не создается:
```bash
# Проверьте S3 конфигурацию
echo $AWS_S3_BUCKET_NAME
echo $AWS_ACCESS_KEY_ID

# Убедитесь, что bucket существует
# Проверьте права IAM пользователя
```

### Ошибка "Offer not found":
```sql
-- Проверьте, что таблица offers создана:
SELECT * FROM offers LIMIT 1;

-- Проверьте, что миграция выполнена:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'offers';
```

### Signature Pad не работает:
```bash
# Переустановите зависимость
npm uninstall react-signature-canvas
npm install react-signature-canvas
```

## 📊 Workflow:

```
Admin → Создает предложение (DealModal)
           ↓
       Предложение создано (ID, draft status)
           ↓
Admin → Генерирует PDF (кнопка "צור PDF")
           ↓
       PDF создан и загружен в S3
           ↓
Admin → Отправляет в WhatsApp или Email
           ↓
Клиент → Получает ссылку /offers/{id}/approve
           ↓
       Просматривает детали
           ↓
       Заполняет имя, телефон, подпись
           ↓
       Жмет "מאשר את ההצעה"
           ↓
       approved = true сохраняется в БД
           ↓
Admin → Видит обновленный статус "אושר" ✅
```

## ✅ Checklist перед запуском:

- [ ] Миграция БД выполнена
- [ ] `.env` настроен:
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] AWS_S3_BUCKET_NAME (для PDF)
  - [ ] AWS_ACCESS_KEY_ID
  - [ ] AWS_SECRET_ACCESS_KEY
  - [ ] RESEND_API_KEY (для email)
- [ ] Зависимости установлены
- [ ] Dev server перезапущен
- [ ] Есть хотя бы одна сделка с customer_name

## 📚 Документация:

- **OFFERS_MODULE_USAGE.md** - полная документация модуля
- **PDF_GENERATOR_SETUP.md** - настройка PDF генератора
- **OFFERS_APPROVAL_AND_SHARING.md** - утверждение и отправка
- **OFFERS_IN_DEALS_INTEGRATION.md** - интеграция с deals

## 🎉 Готово!

Модуль предложений полностью настроен и готов к использованию!

Откройте http://localhost:3000/he/admin/deals и создайте первое предложение.

