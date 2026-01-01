# 💡 Обновление V3: Lighting и Drainage как платные услуги

## 🎯 Что изменено

### ✅ 1. Новые поля в Offer

**Lighting (תאורה):**
- `enabled: boolean`
- `pricePerMeter: number` (default: 200 ₪)
- `runningMeters: number` (מטר רץ)
- `total: number` (calculated)

**Drainage (ניקוז):**
- `enabled: boolean`
- `pricePerMeter: number` (default: 500 ₪)
- `runningMeters: number` (מטר רץ)
- `total: number` (calculated)

---

## 📊 Новая формула расчета

```typescript
// 1. Базовые компоненты
pergolaTotal = area × pergolaPricePerSqm
santafTotal = area × santafPricePerSqm (если включен)
zipScreenTotal = runningMeters × zipPricePerSqm (если включен)

// 2. НОВОЕ: Lighting и Drainage
lightingTotal = lighting.runningMeters × lighting.pricePerMeter
drainageTotal = drainage.runningMeters × drainage.pricePerMeter

// 3. Итого до НДС
totalBeforeVat = pergolaTotal + santafTotal + zipScreenTotal + lightingTotal + drainageTotal

// 4. НДС 18%
vatAmount = totalBeforeVat × 0.18
priceWithVat = totalBeforeVat + vatAmount

// 5. Скидка (после НДС!)
discountAmount = priceWithVat × (discountPercent / 100)
finalPrice = priceWithVat - discountAmount
```

---

## 🗄️ Изменения в БД

**Новая миграция:** `supabase/migrations/update_offers_v3_final.sql`

**Новые колонки:**

```sql
-- Lighting
lighting_enabled BOOLEAN NOT NULL DEFAULT false,
lighting_price_per_meter NUMERIC(10, 2) NOT NULL DEFAULT 200,
lighting_running_meters NUMERIC(10, 2),
lighting_total NUMERIC(10, 2) NOT NULL DEFAULT 0,

-- Drainage
drainage_enabled BOOLEAN NOT NULL DEFAULT false,
drainage_price_per_meter NUMERIC(10, 2) NOT NULL DEFAULT 500,
drainage_running_meters NUMERIC(10, 2),
drainage_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
```

**Старые колонки удалены:**
- `options_lighting` (был boolean)
- `options_drainage` (был boolean)

---

## 🔧 Обновленные файлы

### 1. TypeScript Types
- ✅ `types/offer.ts` - новая структура `lighting` и `drainage`

### 2. Calculation Logic
- ✅ `lib/offer-calculator.ts` - добавлен расчет `lightingTotal` и `drainageTotal`

### 3. UI Components
- ✅ `components/offers/CreateOfferModal.tsx` - UI для ввода метров и цен
- ✅ `components/offers/OffersList.tsx` - отображение метров в списке
- ✅ `app/offers/[id]/approve/page.tsx` - отображение в странице подтверждения

### 4. API Endpoints
- ✅ `app/api/offers/route.ts` - сохранение lighting/drainage в БД
- ✅ `app/api/offers/[id]/route.ts` - получение данных из БД

### 5. Email Integration (НОВОЕ!)
- ✅ `lib/email.ts` - модуль отправки через Zoho Mail
- ✅ `app/api/offers/[id]/send-email/route.ts` - API для отправки email
- ✅ Красивый HTML шаблон с RTL дизайном

---

## 📧 Bonus: Email Integration

### Настроено:
- ✅ Nodemailer + Zoho Mail SMTP
- ✅ Красивый HTML шаблон на иврите (RTL)
- ✅ Кнопка "Email" в списке предложений
- ✅ Автоматическая генерация ссылки на подтверждение
- ✅ Валидация email
- ✅ Обработка ошибок

### Пример использования:
```typescript
// В CRM нажимаете "Email"
// Вводите email клиента
// Клиент получает красивое письмо:

// ┌──────────────────────────┐
// │   Pashkovsky Group       │
// │   פרגולות | גדרות | חלונות│
// ├──────────────────────────┤
// │  שלום [Имя],             │
// │  הכנו עבורך הצעת מחיר... │
// │                          │
// │  [ צפה בהצעת המחיר ]     │
// └──────────────────────────┘
```

---

## 🚀 Как запустить

### 1. Выполните миграцию БД

В [Supabase Dashboard](https://app.supabase.com) → SQL Editor:

```sql
-- Скопируйте и выполните содержимое:
-- supabase/migrations/update_offers_v3_final.sql
```

### 2. Настройте Zoho Mail (опционально)

Создайте **App Password** в Zoho Mail и добавьте в `.env`:

```env
EMAIL_HOST=smtp.zoho.com
EMAIL_PORT=465
EMAIL_USER=office@pashkovsky-group.com
EMAIL_PASS=your_app_password
EMAIL_FROM="Pashkovsky Group <office@pashkovsky-group.com>"
```

Подробная инструкция: `ZOHO_EMAIL_SETUP.md`

### 3. Перезапустите сервер

```bash
npm run dev
```

---

## 📱 Пример создания предложения

### Входные данные:

**Пергола:**
- Ширина: 5 м
- Длина: 4 м
- Площадь: 20 м²
- Цена: 750 ₪/м²

**Сантаф:**
- Включен: Да
- Тип: С конструкцией
- Цена: 450 ₪/м²

**Lighting (תאורה):**
- Включен: Да
- Метров: 12 מ׳ רץ
- Цена: 200 ₪/מ׳

**Drainage (ניקוז):**
- Включен: Да
- Метров: 10 מ׳ רץ
- Цена: 500 ₪/מ׳

**Скидка:** 5%

---

### Расчет:

```
1️⃣ Пергола:      20 м² × 750 ₪  = 15,000 ₪
2️⃣ Сантаф:       20 м² × 450 ₪  =  9,000 ₪
3️⃣ Lighting:     12 м  × 200 ₪  =  2,400 ₪
4️⃣ Drainage:     10 м  × 500 ₪  =  5,000 ₪
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   לפני מע״מ:                     31,400 ₪

5️⃣ מע״מ 18%:    31,400 × 0.18  =  5,652 ₪
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   אחרי מע״מ:                     37,052 ₪

6️⃣ הנחה 5%:     37,052 × 0.05  =  1,853 ₪
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   מחיר סופי:                     35,199 ₪
```

---

## ✅ Тестирование

### 1. Создайте предложение
- Откройте CRM → Deals
- Выберите сделку
- Нажмите "+ יצירת הצעת מחיר"
- Заполните все поля (включая lighting и drainage)
- Сохраните

### 2. Проверьте список предложений
- Должны отображаться метры для תאורה и ניקוז
- Кнопки: PDF, WhatsApp, Email

### 3. Отправьте email (если настроен)
- Нажмите кнопку "Email"
- Введите свой email
- Проверьте письмо
- Кликните на ссылку
- Должна открыться страница подтверждения

### 4. Подтвердите предложение
- На странице `/offers/[id]/approve`:
- Проверьте, что все цены отображаются правильно
- Заполните имя, телефон
- Распишитесь
- Нажмите "מאשר את ההצעה"
- Должен открыться `/offers/[id]/success`

---

## 🎨 UI/UX улучшения

### Создание предложения:
- ✅ Секции разделены визуально
- ✅ Real-time пересчет всех цен
- ✅ Три цены показываются всегда (לפני מע״מ, אחרי מע״מ, סופי)
- ✅ Editable цены с дефолтами
- ✅ Чекбоксы для включения опций
- ✅ Input для метров (lighting, drainage, ZIP)

### Список предложений:
- ✅ Карточки с градиентом
- ✅ Статус (Черновик / Утверждено)
- ✅ Иконки для кнопок
- ✅ Hover эффекты
- ✅ Показ метров для опций

### Email письмо:
- ✅ Профессиональный дизайн
- ✅ RTL layout (иврит)
- ✅ Градиентный header
- ✅ Большая CTA кнопка
- ✅ Адаптивный (mobile-friendly)

---

## 🐛 Известные проблемы

### ❌ Старые предложения (до миграции)
- Не будут отображаться (таблица пересоздана)
- Решение: Миграция выполняется с `DROP TABLE CASCADE`
- Если нужно сохранить данные - сделайте backup перед миграцией

### ⚠️ Email без настройки Zoho
- Кнопка "Email" будет работать, но отправка упадет
- Решение: Настройте Zoho Mail (см. `ZOHO_EMAIL_SETUP.md`)
- Или закомментируйте кнопку до настройки

---

## 📚 Документация

- 📄 `ZOHO_EMAIL_SETUP.md` - полная инструкция по email
- 📄 `OFFER_UPDATE_V2.md` - предыдущая версия (ZIP screen)
- 📄 `OFFER_MODULE_GUIDE.md` - начальная версия

---

## 🎉 Готово!

Теперь у вас есть:
- ✅ Полный модуль создания предложений
- ✅ Lighting и Drainage как платные услуги
- ✅ Email отправка клиентам через Zoho
- ✅ Красивый UI с real-time расчетом
- ✅ Страница подтверждения с подписью
- ✅ Три цены (לפני מע״מ, אחרי מע״מ, סופי)
- ✅ Скидка после НДС 18%

**Следующие шаги:**
1. Выполните миграцию `update_offers_v3_final.sql`
2. Настройте Zoho Mail (опционально)
3. Перезапустите сервер
4. Создайте тестовое предложение
5. Наслаждайтесь! 🚀

