# ✅ Реализация автоматического расчета метража для сложных форм пергол

## 🎯 Что реализовано

### Phase 1: Backend ✅
1. **Миграция БД** (`supabase/migrations/011_add_pergola_shapes.sql`)
   - Добавлено поле `pergola_shape_type` (rectangle, L, X, U)
   - Добавлено JSONB поле `pergola_shape_data` для хранения размеров
   - Миграция существующих данных в формат rectangle
   - Индексы для быстрого поиска

2. **TypeScript типы** (`types/offer.ts`)
   - `PergolaShapeType` - типы форм
   - `RectangleShape`, `LShape`, `XShape`, `UShape` - интерфейсы
   - `PergolaShape` - union type
   - Обновлен интерфейс `Pergola` с поддержкой `shape`

3. **Функция расчета площади** (`lib/calculations/pergola-area.ts`)
   - `calculatePergolaArea()` - расчет для всех форм
   - `validatePergolaShape()` - валидация данных
   - `getShapeDimensionsSummary()` - текстовая сводка размеров

4. **API endpoints** (`app/api/offers/route.ts`)
   - Обновлен POST для сохранения формы
   - Обновлен GET для чтения формы
   - Автоматический расчет площади из формы
   - Валидация формы перед сохранением

### Phase 2: Frontend ✅
1. **Компонент селектора формы** (`components/offers/PergolaShapeSelector.tsx`)
   - Выбор типа формы (rectangle, L, X, U)
   - Динамическое отображение полей ввода

2. **Компоненты ввода размеров**:
   - `components/offers/shapes/RectangleShapeInput.tsx` - прямоугольная
   - `components/offers/shapes/LShapeInput.tsx` - Г-образная
   - `components/offers/shapes/XShapeInput.tsx` - Х-образная
   - `components/offers/shapes/UShapeInput.tsx` - П-образная

3. **Обновлен CreateOfferModal** (`components/offers/CreateOfferModal.tsx`)
   - Интеграция PergolaShapeSelector
   - Автоматический расчет площади при изменении размеров

4. **Обновлен калькулятор** (`lib/offer-calculator.ts`)
   - Использует `calculatePergolaArea()` вместо простого умножения

---

## 📊 Формулы расчета

### Rectangle (Прямоугольник)
```
area = width × length
```

### L-shape (Г-образная)
```
area = (leg1.width × leg1.length) + (leg2.width × leg2.length) - overlap
```

### X-shape (Х-образная)
```
area = center.area + sum(arms.area) - overlaps
```

### U-shape (П-образная)
```
area = base.area + leftLeg.area + rightLeg.area - overlaps
```

---

## 🗄️ Структура данных в БД

### Rectangle
```json
{
  "type": "rectangle",
  "width": 4,
  "length": 6
}
```

### L-shape
```json
{
  "type": "L",
  "leg1": { "width": 4, "length": 6 },
  "leg2": { "width": 3, "length": 4 },
  "overlap": { "width": 1, "length": 1 }
}
```

### X-shape
```json
{
  "type": "X",
  "center": { "width": 2, "length": 2 },
  "arms": [
    { "direction": "north", "width": 3, "length": 4 },
    { "direction": "south", "width": 3, "length": 4 },
    { "direction": "east", "width": 4, "length": 3 },
    { "direction": "west", "width": 4, "length": 3 }
  ]
}
```

### U-shape
```json
{
  "type": "U",
  "base": { "width": 6, "length": 4 },
  "leftLeg": { "width": 3, "length": 3 },
  "rightLeg": { "width": 3, "length": 3 }
}
```

---

## 🚀 Как использовать

### 1. Применить миграцию БД
```sql
-- Выполнить в Supabase SQL Editor:
-- supabase/migrations/011_add_pergola_shapes.sql
```

### 2. Использование в UI
1. Открыть форму создания оффера
2. Выбрать тип формы перголы (rectangle, L, X, U)
3. Ввести размеры для выбранной формы
4. Площадь рассчитывается автоматически
5. Сохранить оффер

---

## 🔄 Обратная совместимость

- ✅ Существующие офферы автоматически мигрируются в формат `rectangle`
- ✅ Старые поля `pergola_width` и `pergola_length` остаются для совместимости
- ✅ API поддерживает оба формата (legacy и новый)

---

## 📝 Следующие шаги (опционально)

1. **Визуализация форм** - SVG preview перголы
2. **3D preview** - трехмерная визуализация
3. **Расчет материалов** - на основе формы
4. **Расчет стоимости установки** - зависит от сложности формы
5. **Экспорт схемы** - в PDF/изображение

---

**Готово к использованию!** 🎉


