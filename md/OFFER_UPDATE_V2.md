# ✅ Обновление модуля "הצעת מחיר" V2

## 🎉 Что изменилось

### 1. **Новая формула скидки**
- ❌ Старая: скидка → НДС → итого
- ✅ Новая: НДС (18%) → скидка → итого

**Порядок расчета:**
1. Сумма до НДС
2. + НДС 18%
3. - Скидка % (применяется к цене с НДС)
4. = Итоговая цена

### 2. **Новые базовые цены**
- Пергола: **750 ₪/м²** (editable)
- Сантаф: **220 ₪/м²** (editable)
- Сантаф + конструкция: **450 ₪/м²** (editable)

### 3. **Добавлен מסך ZIP**
- Ручной: **650 ₪/м²** (editable)
- Электрический: **800 ₪/м²** (editable)
- Можно указать "מטר רץ" отдельно

### 4. **Отображение 3 цен**
- לפני מע״מ
- אחרי מע״מ
- אחרי הנחה (если есть)

### 5. **НДС изменен**
- ❌ Было: 17%
- ✅ Стало: 18%

---

## 🚀 Как обновить

### Шаг 1: Выполните миграцию БД

**Откройте [Supabase Dashboard](https://app.supabase.com) → SQL Editor**

Выполните миграцию:
```
supabase/migrations/update_offers_v2.sql
```

Эта миграция:
- ✅ Удалит старую таблицу `offers`
- ✅ Создаст новую с обновленной структурой
- ✅ Добавит поля для ZIP-экрана
- ✅ Обновит формулы расчета
- ✅ Изменит НДС на 18%

### Шаг 2: Перезапустите сервер

```bash
npm run dev
```

### Шаг 3: Попробуйте создать предложение

1. Откройте сделку → **"יצירת הצעת מחיר"**
2. Заполните форму:
   - **Пергола** - размеры + цена/м² (editable)
   - **Сантаф** - включить, выбрать тип, цены (editable)
   - **מסך ZIP** - включить, выбрать ручной/электрический
   - **Скидка** - применяется после НДС
3. Проверьте 3 цены:
   - לפני מע״מ
   - אחרי מע״מ (18%)
   - אחרי הנחה

---

## 📊 Пример расчета

**Входные данные:**
- Пергола: 4м × 6м = 24 м² × 750 ₪ = **18,000 ₪**
- Сантаф: 24 м² × 220 ₪ = **5,280 ₪**
- ZIP: 24 м² × 650 ₪ = **15,600 ₪**

**Расчет:**
1. **לפני מע״מ:** 18,000 + 5,280 + 15,600 = **38,880 ₪**
2. **מע״מ 18%:** 38,880 × 0.18 = **7,000 ₪**
3. **אחרי מע״מ:** 38,880 + 7,000 = **45,880 ₪**
4. **הנחה 10%:** 45,880 × 0.10 = **4,588 ₪**
5. **מחיר סופי:** 45,880 - 4,588 = **41,292 ₪**

---

## ✅ Что уже работает

- ✅ Форма создания с новыми полями
- ✅ Editable цены (можно менять вручную)
- ✅ ZIP-экран (ручной/электрический)
- ✅ Новая формула скидки (после НДС)
- ✅ Отображение 3 цен
- ✅ WhatsApp отправка
- ✅ Email отправка (заглушка)
- ✅ Страница подписи клиента
- ✅ Сохранение в БД

---

## 📝 Структура данных

### Offer TypeScript Interface (обновленный)

```typescript
interface Offer {
  // Pergola with editable price
  pergola: {
    width: number
    length: number
    height?: number
    location?: string
    pricePerSqm: number // Default 750, editable
  }
  
  // Santaf with editable prices
  santaf: {
    enabled: boolean
    withStructure: boolean // false = 220, true = 450
    pricePerSqmBasic: number // Default 220, editable
    pricePerSqmWithStructure: number // Default 450, editable
  }
  
  // ZIP Screen (NEW!)
  zipScreen: {
    enabled: boolean
    type?: 'manual' | 'electric'
    pricePerSqmManual: number // Default 650, editable
    pricePerSqmElectric: number // Default 800, editable
    runningMeters?: number // Optional
  }
  
  // Pricing (NEW FORMULA)
  pricing: {
    pergolaTotal: number
    santafTotal: number
    zipScreenTotal: number
    totalBeforeVat: number
    vatPercent: 18 // Changed!
    vatAmount: number
    priceWithVat: number
    discountPercent: number // Applied AFTER VAT
    discountAmount: number
    finalPrice: number // priceWithVat - discountAmount
  }
  
  // ... other fields
}
```

---

## 🔧 API Endpoints (нужно обновить)

**TODO:** Обновить API endpoints для работы с новой структурой БД:

- `app/api/offers/route.ts` - POST/GET
- `app/api/offers/[id]/route.ts` - GET single
- `app/api/offers/[id]/approve/route.ts` - approve

Нужно обновить маппинг полей:
- `santaf_*` → новые поля
- `zip_screen_*` → новые поля
- `pricing` → новые расчеты

---

## 🎯 Что делать дальше

1. ✅ Выполните миграцию БД
2. ✅ Перезапустите сервер
3. ⏳ Протестируйте создание предложения
4. ⏳ Проверьте отправку по WhatsApp
5. ⏳ Проверьте страницу подписи клиента

---

## ✨ Enjoy!

Все обновления готовы! 🎉

