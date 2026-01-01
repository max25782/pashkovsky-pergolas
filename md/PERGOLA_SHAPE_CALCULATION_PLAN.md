# 📐 План: Автоматический расчет метража для сложных форм пергол (Г, Х, П)

## 🎯 Цель
Добавить поддержку автоматического расчета площади для пергол сложной формы:
- **Г-образная** (L-shape)
- **Х-образная** (X-shape / крестообразная)
- **П-образная** (U-shape)

---

## 📊 Текущая ситуация

### Что есть сейчас:
- Таблица `offers` хранит только `pergola_width` и `pergola_length`
- Площадь рассчитывается как `width * length` (прямоугольник)
- Тип `Pergola` в `types/offer.ts` поддерживает только width/length

### Что нужно добавить:
1. **Новая структура данных** для хранения сложных форм
2. **Логика расчета площади** для каждой формы
3. **UI компоненты** для ввода размеров
4. **Валидация** размеров

---

## 🗄️ План изменений БД

### Вариант 1: JSONB поле (рекомендуется)
**Плюсы:** Гибкость, легко расширять, не требует миграций при добавлении новых форм

```sql
-- Добавить в таблицу offers:
ALTER TABLE offers ADD COLUMN IF NOT EXISTS pergola_shape_type TEXT 
  CHECK (pergola_shape_type IN ('rectangle', 'L', 'X', 'U')) 
  DEFAULT 'rectangle';

ALTER TABLE offers ADD COLUMN IF NOT EXISTS pergola_shape_data JSONB;

-- Примеры данных:
-- Rectangle (текущий формат):
{
  "type": "rectangle",
  "width": 4,
  "length": 6
}

-- L-shape (Г-образная):
{
  "type": "L",
  "leg1": { "width": 4, "length": 6 },
  "leg2": { "width": 3, "length": 4 },
  "overlap": { "width": 1, "length": 1 } // Пересечение (вычитается)
}

-- X-shape (Х-образная):
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

-- U-shape (П-образная):
{
  "type": "U",
  "base": { "width": 6, "length": 4 },
  "leftLeg": { "width": 3, "length": 3 },
  "rightLeg": { "width": 3, "length": 3 }
}
```

### Вариант 2: Отдельные поля (альтернатива)
**Плюсы:** Проще запросы, лучше для индексации  
**Минусы:** Много NULL полей, сложнее расширять

```sql
-- Для L-shape:
ALTER TABLE offers ADD COLUMN pergola_l_leg1_width NUMERIC(10,2);
ALTER TABLE offers ADD COLUMN pergola_l_leg1_length NUMERIC(10,2);
ALTER TABLE offers ADD COLUMN pergola_l_leg2_width NUMERIC(10,2);
ALTER TABLE offers ADD COLUMN pergola_l_leg2_length NUMERIC(10,2);

-- И т.д. для X и U...
```

**Рекомендация: Вариант 1 (JSONB)** ✅

---

## 🧮 Логика расчета площади

### Формулы для каждой формы:

#### 1. Rectangle (Прямоугольник) - текущий
```typescript
area = width * length
```

#### 2. L-shape (Г-образная)
```typescript
area = (leg1.width * leg1.length) + (leg2.width * leg2.length) - (overlap.width * overlap.length)
```

**Пример:**
- Leg 1: 4м × 6м = 24 м²
- Leg 2: 3м × 4м = 12 м²
- Overlap: 1м × 1м = 1 м²
- **Итого: 24 + 12 - 1 = 35 м²**

#### 3. X-shape (Х-образная / крестообразная)
```typescript
area = center.area + sum(arms.area) - sum(overlaps)
```

**Пример:**
- Center: 2м × 2м = 4 м²
- North arm: 3м × 4м = 12 м²
- South arm: 3м × 4м = 12 м²
- East arm: 4м × 3м = 12 м²
- West arm: 4м × 3м = 12 м²
- Overlaps (4 угла): 4 × (0.5м × 0.5м) = 1 м²
- **Итого: 4 + 12 + 12 + 12 + 12 - 1 = 51 м²**

#### 4. U-shape (П-образная)
```typescript
area = base.area + leftLeg.area + rightLeg.area - overlaps
```

**Пример:**
- Base: 6м × 4м = 24 м²
- Left leg: 3м × 3м = 9 м²
- Right leg: 3м × 3м = 9 м²
- Overlaps (2 угла): 2 × (1м × 1м) = 2 м²
- **Итого: 24 + 9 + 9 - 2 = 40 м²**

---

## 💻 План реализации кода

### Шаг 1: Обновить TypeScript типы

**Файл:** `types/offer.ts`

```typescript
// Добавить новые типы:

export type PergolaShapeType = 'rectangle' | 'L' | 'X' | 'U'

export interface RectangleShape {
  type: 'rectangle'
  width: number
  length: number
}

export interface LShape {
  type: 'L'
  leg1: { width: number; length: number }
  leg2: { width: number; length: number }
  overlap?: { width: number; length: number } // Опционально, для точности
}

export interface XShape {
  type: 'X'
  center: { width: number; length: number }
  arms: Array<{
    direction: 'north' | 'south' | 'east' | 'west'
    width: number
    length: number
  }>
}

export interface UShape {
  type: 'U'
  base: { width: number; length: number }
  leftLeg: { width: number; length: number }
  rightLeg: { width: number; length: number }
}

export type PergolaShape = RectangleShape | LShape | XShape | UShape

// Обновить интерфейс Pergola:
export interface Pergola {
  shape: PergolaShape // Вместо width/length
  height?: number
  location?: string
  pricePerSqm: number
}
```

### Шаг 2: Создать утилиту расчета площади

**Файл:** `lib/calculations/pergola-area.ts`

```typescript
import { PergolaShape } from '@/types/offer'

export function calculatePergolaArea(shape: PergolaShape): number {
  switch (shape.type) {
    case 'rectangle':
      return shape.width * shape.length
    
    case 'L':
      const leg1Area = shape.leg1.width * shape.leg1.length
      const leg2Area = shape.leg2.width * shape.leg2.length
      const overlapArea = shape.overlap 
        ? shape.overlap.width * shape.overlap.length 
        : 0
      return leg1Area + leg2Area - overlapArea
    
    case 'X':
      const centerArea = shape.center.width * shape.center.length
      const armsArea = shape.arms.reduce((sum, arm) => {
        return sum + (arm.width * arm.length)
      }, 0)
      // Упрощенный расчет overlaps (можно улучшить)
      const overlapArea = shape.center.width * shape.center.length * 0.25
      return centerArea + armsArea - overlapArea
    
    case 'U':
      const baseArea = shape.base.width * shape.base.length
      const leftLegArea = shape.leftLeg.width * shape.leftLeg.length
      const rightLegArea = shape.rightLeg.width * shape.rightLeg.length
      // Overlaps между base и legs
      const overlapArea = Math.min(shape.base.width, shape.leftLeg.width) * 
                         Math.min(shape.base.length, shape.leftLeg.length) * 2
      return baseArea + leftLegArea + rightLegArea - overlapArea
    
    default:
      throw new Error(`Unknown shape type: ${(shape as any).type}`)
  }
}
```

### Шаг 3: Обновить миграцию БД

**Файл:** `supabase/migrations/011_add_pergola_shapes.sql`

```sql
-- Добавить поддержку сложных форм пергол

-- Добавить поле типа формы
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS pergola_shape_type TEXT 
  CHECK (pergola_shape_type IN ('rectangle', 'L', 'X', 'U')) 
  DEFAULT 'rectangle';

-- Добавить JSONB поле для данных формы
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS pergola_shape_data JSONB;

-- Миграция существующих данных
UPDATE offers 
SET 
  pergola_shape_type = 'rectangle',
  pergola_shape_data = jsonb_build_object(
    'type', 'rectangle',
    'width', pergola_width,
    'length', pergola_length
  )
WHERE pergola_shape_data IS NULL;

-- Создать индекс для быстрого поиска по типу формы
CREATE INDEX IF NOT EXISTS idx_offers_pergola_shape_type 
ON offers(pergola_shape_type);

-- Комментарий
COMMENT ON COLUMN offers.pergola_shape_type IS 'Тип формы перголы: rectangle, L, X, U';
COMMENT ON COLUMN offers.pergola_shape_data IS 'JSON данные формы перголы (размеры, секции)';
```

### Шаг 4: Обновить API endpoints

**Файл:** `app/api/offers/route.ts`

- Обновить POST для сохранения `pergola_shape_type` и `pergola_shape_data`
- Обновить GET для возврата структурированных данных
- Использовать `calculatePergolaArea()` для расчета площади

### Шаг 5: Создать UI компоненты

**Файл:** `components/offers/PergolaShapeSelector.tsx`

```typescript
'use client'

import { useState } from 'react'
import { PergolaShape, PergolaShapeType } from '@/types/offer'

interface Props {
  value: PergolaShape
  onChange: (shape: PergolaShape) => void
}

export function PergolaShapeSelector({ value, onChange }: Props) {
  const [shapeType, setShapeType] = useState<PergolaShapeType>(value.type)

  // UI для выбора типа формы
  // UI для ввода размеров в зависимости от типа
  // Валидация размеров
}
```

**Файл:** `components/offers/shapes/RectangleShapeInput.tsx`
**Файл:** `components/offers/shapes/LShapeInput.tsx`
**Файл:** `components/offers/shapes/XShapeInput.tsx`
**Файл:** `components/offers/shapes/UShapeInput.tsx`

### Шаг 6: Обновить форму создания оффера

**Файл:** `app/[locale]/admin/offers/create/page.tsx` (или где создаются офферы)

- Добавить выбор типа формы
- Показывать соответствующие поля ввода
- Автоматически рассчитывать площадь при изменении размеров

---

## 📋 Checklist реализации

### Phase 1: Backend (БД + API)
- [ ] Создать миграцию `011_add_pergola_shapes.sql`
- [ ] Обновить типы в `types/offer.ts`
- [ ] Создать `lib/calculations/pergola-area.ts`
- [ ] Обновить `app/api/offers/route.ts` (POST)
- [ ] Обновить `app/api/offers/route.ts` (GET)
- [ ] Протестировать расчет площади для всех форм

### Phase 2: Frontend (UI)
- [ ] Создать `components/offers/PergolaShapeSelector.tsx`
- [ ] Создать `components/offers/shapes/RectangleShapeInput.tsx`
- [ ] Создать `components/offers/shapes/LShapeInput.tsx`
- [ ] Создать `components/offers/shapes/XShapeInput.tsx`
- [ ] Создать `components/offers/shapes/UShapeInput.tsx`
- [ ] Обновить форму создания оффера
- [ ] Добавить визуализацию формы (опционально)

### Phase 3: Тестирование
- [ ] Протестировать создание оффера с каждой формой
- [ ] Проверить расчет площади
- [ ] Проверить сохранение в БД
- [ ] Проверить отображение в списке офферов
- [ ] Проверить PDF генерацию (если есть)

---

## 🎨 UI/UX предложения

### Выбор типа формы:
```
┌─────────────────────────────────┐
│ Тип формы перголы:              │
│ ○ Прямоугольная                 │
│ ○ Г-образная (L)                │
│ ○ Х-образная (X)                │
│ ○ П-образная (U)                │
└─────────────────────────────────┘
```

### Ввод размеров для L-shape:
```
┌─────────────────────────────────┐
│ Г-образная пергола              │
│                                  │
│ Нога 1:                          │
│   Ширина: [4] м  Длина: [6] м   │
│                                  │
│ Нога 2:                          │
│   Ширина: [3] м  Длина: [4] м   │
│                                  │
│ Пересечение (опционально):      │
│   Ширина: [1] м  Длина: [1] м   │
│                                  │
│ Площадь: 35 м² (автоматически)  │
└─────────────────────────────────┘
```

### Визуализация (опционально):
- Простой SVG preview формы
- Показ размеров на схеме

---

## 🔄 Обратная совместимость

- Существующие офферы автоматически мигрируются в формат `rectangle`
- Старые поля `pergola_width` и `pergola_length` остаются для совместимости
- Можно добавить computed column или view для автоматического преобразования

---

## 📝 Дополнительные улучшения (будущее)

1. **Визуальный редактор** форм (drag & drop)
2. **3D preview** перголы
3. **Расчет материалов** на основе формы
4. **Расчет стоимости установки** (зависит от сложности формы)
5. **Экспорт схемы** в PDF/изображение

---

**Готов начать реализацию?** 🚀



