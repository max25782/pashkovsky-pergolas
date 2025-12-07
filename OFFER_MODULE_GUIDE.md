# 📋 Модуль "הצעת מחיר" (Offer) - Полное руководство

## ✅ Что было реализовано

### 1. **Полная структура Offer**
- ✅ Данные перголы (width, length, height, location)
- ✅ Цвета алюминия (white, black, cream, RAL, wood)
- ✅ Тип крыши (סנטף BH с 4 цветами, זכוכית טריפלקס)
- ✅ Зимнее закрытие (складное стекло, окна 7000/9000, типы стекла)
- ✅ Опции (תאורה, ניקוז, заметки)
- ✅ Расширенное ценообразование (basePrice, VAT, discount, final prices)
- ✅ Условия оплаты (10% аванс)
- ✅ Гарантия (7 лет)
- ✅ Подпись клиента
- ✅ PDF (заглушка)

### 2. **Компоненты**
- ✅ `CreateOfferModal` - полная форма создания предложения
- ✅ `OffersList` - список предложений с действиями
- ✅ `/offers/[id]/approve` - публичная страница для подписи клиента
- ✅ `/offers/[id]/success` - страница успеха после подписи

### 3. **API Endpoints**
- ✅ `POST /api/offers` - создание предложения
- ✅ `GET /api/offers?dealId=...` - получение всех предложений сделки
- ✅ `GET /api/offers/[id]` - получение одного предложения
- ✅ `POST /api/offers/[id]/approve` - подпись клиента
- ✅ `POST /api/offers/[id]/send-email` - отправка email (заглушка)
- ✅ `POST /api/offers/[id]/pdf` - генерация PDF (заглушка)
- ✅ `GET /api/offers/[id]/pdf` - скачивание PDF

### 4. **База данных**
- ✅ Таблица `offers` с полной структурой
- ✅ RLS политики
- ✅ Индексы для производительности
- ✅ Триггеры для `updated_at`

---

## 🚀 Начало работы

### Шаг 1: Выполните миграцию БД

**Откройте [Supabase Dashboard](https://app.supabase.com) → SQL Editor**

Выполните миграцию из файла:
```
supabase/migrations/update_offers_table.sql
```

### Шаг 2: Установите зависимости

```bash
npm install react-signature-canvas
```

### Шаг 3: Перезапустите сервер

```bash
npm run dev
```

---

## 📖 Как использовать

### 1. Создание предложения

1. Откройте сделку в CRM (`/admin/deals`)
2. Нажмите **"יצירת הצעת מחיר"**
3. Заполните форму:
   - **Размеры перголы** (width, length, height, location)
   - **Цвет** (white, black, cream, RAL, wood)
   - **Тип крыши** (סנטף BH или זכוכית טריפלקס)
   - **Зимнее закрытие** (опционально)
   - **Опции** (תאורה, ניקוז)
   - **Цена** (basePrice, VAT %, discount %)
4. Нажмите **"שמור הצעת מחיר"**

### 2. Просмотр предложений

Все предложения отображаются в карточке сделки:
- 💰 **Сумма** (final price)
- 📅 **Дата создания**
- ✅ **Статус** (אושר / ממתין לאישור)

### 3. Отправка клиенту

#### WhatsApp
1. Нажмите **"WhatsApp"** в списке предложений
2. Откроется WhatsApp с готовым сообщением
3. Отправьте клиенту

#### Email
1. Нажмите **"Email"**
2. Введите email клиента
3. Отправьте (пока заглушка - см. ниже как настроить)

### 4. Клиент подписывает

Клиент получает ссылку:
```
https://your-domain.com/offers/[id]/approve
```

На странице:
1. Видит все детали предложения
2. Вводит имя и телефон
3. Рисует подпись
4. Нажимает **"מאשר את ההצעה"**

После подписи → статус меняется на ✅ **"אושר"**

---

## ⚙️ Настройка Email (TODO)

Для отправки email нужно настроить Resend:

### 1. Установите Resend
```bash
npm install resend
```

### 2. Получите API ключ
- Зарегистрируйтесь на [resend.com](https://resend.com)
- Создайте API ключ

### 3. Добавьте в `.env`
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### 4. Раскомментируйте код в `app/api/offers/[id]/send-email/route.ts`

---

## 📄 Генерация PDF (TODO)

PDF генерация пока не реализована. Чтобы добавить:

### 1. Установите @react-pdf/renderer
```bash
npm install @react-pdf/renderer
```

### 2. Создайте PDF компонент

Пример: `components/pdf/OfferPDFDocument.tsx`

```typescript
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Offer } from '@/types/offer'

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 10,
  },
})

export function OfferPDFDocument({ offer }: { offer: Offer }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text>הצעת מחיר - Pashkovsky Group</Text>
        </View>
        
        <View style={styles.section}>
          <Text>לקוח: {offer.customerName}</Text>
          <Text>רוחב: {offer.pergola.width} מ׳</Text>
          <Text>אורך: {offer.pergola.length} מ׳</Text>
          {/* Add more fields... */}
        </View>
        
        {/* Add pricing, payment terms, warranty... */}
      </Page>
    </Document>
  )
}
```

### 3. Обновите API endpoint

В `app/api/offers/[id]/pdf/route.ts`:

```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import { OfferPDFDocument } from '@/components/pdf/OfferPDFDocument'
import { uploadToS3 } from '@/lib/s3-upload'

// Fetch offer
const offer = await fetchOffer(params.id)

// Generate PDF
const pdfBuffer = await renderToBuffer(<OfferPDFDocument offer={offer} />)

// Upload to S3
const pdfUrl = await uploadToS3(
  pdfBuffer,
  `offers/${params.id}.pdf`,
  'application/pdf'
)

// Save URL to database
await supabase
  .from('offers')
  .update({
    pdf_url: pdfUrl,
    pdf_created_at: new Date().toISOString()
  })
  .eq('id', params.id)

return NextResponse.json({ pdfUrl })
```

---

## 📊 Структура данных

### Offer TypeScript Interface

```typescript
interface Offer {
  id: string
  dealId: string
  customerName: string
  customerPhone?: string
  customerCity?: string
  
  pergola: {
    width: number
    length: number
    height?: number
    location?: string
  }
  
  color: {
    type: 'white' | 'black' | 'cream' | 'ral' | 'wood'
    ralCode?: string
    woodName?: string
  }
  
  roof: {
    type: 'santaf' | 'triplexGlass' | null
    santafColor?: 'transparent' | 'gray' | 'white' | 'gold'
  }
  
  winterClosure: {
    enabled: boolean
    type?: 'foldingGlass' | 'windows7000' | 'windows9000'
    glassType?: 'tempered' | 'triplex' | 'insulated'
  }
  
  options: {
    lighting: boolean
    drainage: boolean
    notes?: string
  }
  
  pricing: {
    basePrice: number
    vatPercent: number
    discountPercent: number
    finalPriceBeforeVAT: number
    finalPriceAfterVAT: number
  }
  
  area: number
  vatAmount: number
  discountAmount: number
  
  paymentTerms: {
    advancePercent: 10
    remainingPercent: 90
    method: 'bankTransfer'
    text: '10% מקדמה וכל השאר בסיום התקנה בהעברה בנקאית'
  }
  
  warranty: {
    years: 7
    covers: ['color', 'construction', 'santaf']
  }
  
  approval: {
    approved: boolean
    approvedAt?: string
    signatureImage?: string
    customerName?: string
    customerPhone?: string
  }
  
  pdf: {
    url?: string
    createdAt?: string
  }
  
  createdAt: string
  updatedAt: string
}
```

---

## 🔧 Возможные улучшения

1. **PDF генерация** - полная реализация с красивым дизайном
2. **Email отправка** - настройка Resend с шаблонами
3. **Картинки в предложении** - добавить gallery images
4. **Редактирование предложений** - возможность изменить после создания
5. **История изменений** - логирование всех изменений
6. **Шаблоны предложений** - сохранение часто используемых конфигураций
7. **Экспорт в Excel** - для бухгалтерии
8. **Уведомления** - оповещения при подписи клиента
9. **Аналитика** - статистика по предложениям (conversion rate)
10. **Мультиязычность** - автоматический перевод для клиентов

---

## 🐛 Известные ограничения

1. **PDF** - пока заглушка, нужно реализовать
2. **Email** - пока заглушка, нужно настроить Resend
3. **Картинки** - пока не добавляются в предложения
4. **Редактирование** - можно только создавать новые

---

## 📞 Поддержка

Если что-то не работает:

1. Проверьте, что миграция БД выполнена
2. Проверьте, что `react-signature-canvas` установлен
3. Проверьте консоль браузера на ошибки
4. Проверьте логи сервера

---

## ✨ Enjoy!

Модуль готов к использованию! 🎉

Все основные функции работают:
- ✅ Создание предложений
- ✅ Просмотр списка
- ✅ Отправка по WhatsApp
- ✅ Подпись клиента
- ⏳ PDF (TODO)
- ⏳ Email (TODO)

