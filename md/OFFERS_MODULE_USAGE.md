# Модуль создания הצעת מחיר (Offers) - Инструкция

## ✅ Что создано:

### 1. **TypeScript типы** (`types/offer.ts`)
- `Client` - интерфейс клиента
- `OfferDraft` - черновик предложения (для формы)
- `OfferCalculation` - результаты расчета
- `Offer` - полный объект предложения
- `DEFAULT_OFFER_VALUES` - значения по умолчанию

### 2. **Калькулятор цен** (`lib/offer-calculator.ts`)
- `calculateOffer(draft)` - рассчитывает все цены
- `formatPrice(price)` - форматирует цену в ₪

### 3. **Компонент модалки** (`components/offers/CreateOfferModal.tsx`)
- Модальное окно с формой создания предложения
- Автоматический пересчет цен в реальном времени
- Валидация данных
- Красивый UI с Tailwind

### 4. **API endpoint** (`app/api/offers/route.ts`)
- POST `/api/offers` - создание предложения
- GET `/api/offers?clientId=xxx` - получение предложений клиента

### 5. **Компонент списка** (`components/offers/OffersList.tsx`)
- Отображает список предложений клиента
- Показывает статус (ממתין לאישור / אושר)
- Автообновление при создании нового предложения

### 6. **Миграция БД** (`supabase/migrations/create_offers_table.sql`)
- Таблица `offers` со всеми полями
- Индексы для производительности
- RLS политики
- Автообновление `updated_at`

## 📝 Как использовать на странице клиента:

### Вариант 1: Полная интеграция

```tsx
// app/[locale]/clients/[id]/page.tsx
"use client"

import { useState } from 'react'
import { CreateOfferModal } from '@/components/offers/CreateOfferModal'
import { OffersList } from '@/components/offers/OffersList'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function ClientPage({ params }: { params: { id: string } }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Ваши данные клиента (из API или props)
  const client = {
    id: params.id,
    name: 'יוסי כהן',
    phone: '050-1234567',
    address: 'רחוב הרצל 10, תל אביב'
  }

  const handleOfferCreated = (offer: Offer) => {
    console.log('New offer created:', offer)
    setRefreshTrigger(prev => prev + 1) // Refresh list
  }

  return (
    <main className="container py-8">
      {/* Client Info */}
      <div className="bg-white/5 rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{client.name}</h1>
        <p className="text-white/70">{client.phone}</p>
        {client.address && <p className="text-white/70">{client.address}</p>}
      </div>

      {/* Offers Section */}
      <div className="bg-white/5 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">הצעות מחיר</h2>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-5 h-5 ml-2" />
            יצירת הצעת מחיר
          </Button>
        </div>

        <OffersList 
          clientId={client.id} 
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Modal */}
      <CreateOfferModal
        client={client}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleOfferCreated}
      />
    </main>
  )
}
```

### Вариант 2: Простая интеграция (минимальный код)

```tsx
"use client"

import { useState } from 'react'
import { CreateOfferModal } from '@/components/offers/CreateOfferModal'
import { Button } from '@/components/ui/button'

export default function ClientPage({ params }: { params: { id: string } }) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const client = {
    id: params.id,
    name: 'יוסי כהן',
    phone: '050-1234567',
  }

  return (
    <div>
      <Button onClick={() => setIsModalOpen(true)}>
        יצירת הצעת מחיר
      </Button>

      <CreateOfferModal
        client={client}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(offer) => console.log('Created:', offer)}
      />
    </div>
  )
}
```

## 🗄️ Установка БД:

### Запустите миграцию в Supabase:

```bash
# Вариант 1: Через SQL Editor в Supabase Dashboard
# Скопируйте содержимое supabase/migrations/create_offers_table.sql
# Вставьте в SQL Editor и запустите

# Вариант 2: Через Supabase CLI (если установлен)
supabase db push
```

## 🎨 Что включает модалка:

### 1. Информация о клиенте (read-only)
- Имя
- Телефон
- Адрес (если есть)

### 2. Размеры пергулы
- Ширина (м)
- Длина (м)
- Высота (опционально)
- **Автоматический расчет площади**

### 3. Цены пергулы
- Цена за м² (редактируемая, default: 750₪)
- **Автоматический расчет общей стоимости**

### 4. Сантаф (опционально)
- Toggle включить/выключить
- Выбор типа: בסיסי / עם קונסטרוקציה
- Редактируемые цены за м²
- **Автоматический расчет**

### 5. Итоговые цены
- Цена до НДС
- НДС 18%
- Цена после НДС
- Скидка % (редактируемая)
- **Финальная цена**

### 6. Кнопки действий
- "שמור הצעת מחיר" - создает предложение
- "ביטול" - закрывает модалку

## 🔢 Формула расчета:

```typescript
area = width * length
pergolaTotal = area * pergolaPricePerSqm
santafTotal = santafEnabled ? area * santafPrice : 0
totalBeforeVat = pergolaTotal + santafTotal
vatAmount = totalBeforeVat * 0.18
priceWithVat = totalBeforeVat + vatAmount
discountAmount = priceWithVat * (discountPercent / 100)
finalPrice = priceWithVat - discountAmount
```

## 📊 Структура БД:

```sql
offers table:
├── id (uuid, primary key)
├── client_id (text)
├── width, length, height (numeric)
├── pergola_price_per_sqm (numeric)
├── santaf_enabled (boolean)
├── santaf_type (text: 'basic' | 'withStructure')
├── santaf_basic_price_per_sqm (numeric)
├── santaf_with_structure_price_per_sqm (numeric)
├── discount_percent (numeric)
├── area (numeric, calculated)
├── pergola_total (numeric, calculated)
├── santaf_total (numeric, calculated)
├── total_before_vat (numeric, calculated)
├── vat_amount (numeric, calculated)
├── price_with_vat (numeric, calculated)
├── discount_amount (numeric, calculated)
├── final_price (numeric, calculated)
├── approved (boolean, для будущего)
├── approved_at (timestamptz, для будущего)
├── signature_image (text, для будущего)
├── created_at, updated_at (timestamptz)
```

## 🎯 Следующие шаги:

1. ✅ Создать таблицу в Supabase (запустить миграцию)
2. ✅ Добавить кнопку на странице клиента
3. ✅ Протестировать создание предложения
4. 🔜 Добавить функционал редактирования предложения
5. 🔜 Добавить функционал утверждения (подпись)
6. 🔜 Добавить генерацию PDF

## 🐛 Troubleshooting:

### Ошибка "Server not configured"
→ Проверьте `.env`:
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Ошибка "Failed to create offer"
→ Проверьте, что таблица `offers` создана в Supabase

### Модалка не открывается
→ Проверьте, что Dialog компонент импортирован из `@/components/ui/dialog`

## ✨ Готово к использованию!

Модуль полностью функционален и готов к интеграции в CRM.

