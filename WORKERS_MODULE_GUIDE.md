# Модуль учёта рабочих и себестоимости проекта

Полнофункциональный модуль для учёта рабочих, их смен и расчёта себестоимости проектов.

## 📋 Структура

### База данных

**Таблицы:**
- `workers` - Рабочие/сотрудники
- `work_shifts` - Смены/выезды рабочих на проекты

**Миграция:**
```sql
-- Запустить в Supabase SQL Editor
-- Файл: supabase/migrations/create_workers_work_shifts.sql
```

### TypeScript типы

**Файл:** `types/workers.ts`

- `Worker` - Рабочий
- `WorkShift` - Смена
- `WorkShiftDraft` - Черновик смены
- `WorkShiftGroupedByDate` - Смены, сгруппированные по датам
- `ProjectProfit` - Расчёт прибыли проекта
- `MonthlyReport` - Месячный отчёт

### Helper функции

**Файл:** `lib/workers/calculations.ts`

- `calcLaborCost(shifts)` - Рассчитать стоимость рабочих
- `calcProfit(revenue, laborCost)` - Рассчитать прибыль
- `groupShiftsByDate(shifts)` - Сгруппировать смены по датам
- `calculateProjectProfit(revenue, shifts)` - Полный расчёт прибыли проекта
- `formatCurrencyILS(amount)` - Форматировать валюту (₪)

## 🚀 API Endpoints

### Workers

**GET `/api/workers`**
- Получить список всех активных рабочих
- Query: `?includeInactive=true` - включить неактивных

**POST `/api/workers`**
- Создать нового рабочего
- Body: `{ firstName, lastName, phone?, role?, dailyRate, isActive? }`

**PATCH `/api/workers/[id]`**
- Обновить рабочего
- Body: `{ firstName?, lastName?, phone?, role?, dailyRate?, isActive? }`

**DELETE `/api/workers/[id]`**
- Удалить рабочего

### Work Shifts

**GET `/api/work-shifts?projectId=xxx`**
- Получить все смены для проекта
- Возвращает смены с данными рабочих

**POST `/api/work-shifts`**
- Создать новую смену
- Body: `{ projectId, workerId, date, dailyRateSnapshot, notes? }`

**PATCH `/api/work-shifts/[id]`**
- Обновить смену
- Body: `{ date?, dailyRateSnapshot?, notes? }`

**DELETE `/api/work-shifts/[id]`**
- Удалить смену

### Reports

**GET `/api/reports/monthly?month=YYYY-MM`**
- Получить месячный отчёт
- Возвращает: `{ report: { month, totalRevenue, totalLaborCost, totalProfit, projects[] } }`

## 🎨 UI Компоненты

### 1. WorkLogSection

**Файл:** `components/workers/WorkLogSection.tsx`

Блок "יומן עבודה" на странице проекта:
- Список смен по датам
- Кнопка "+ הוסף משמרת"
- Удаление смен

**Использование:**
```tsx
<WorkLogSection projectId={deal.id} />
```

### 2. ProfitWidget

**Файл:** `components/workers/ProfitWidget.tsx`

Виджет "רווח" с расчётом прибыли:
- Выручка (из offers)
- Затраты на рабочих
- Чистая прибыль
- Процент затрат от выручки

**Использование:**
```tsx
const revenue = useProjectRevenue(deal.id)
<ProfitWidget projectId={deal.id} revenue={revenue} />
```

### 3. AddWorkShiftModal

**Файл:** `components/workers/AddWorkShiftModal.tsx`

Модальное окно для добавления смены:
- Выбор рабочего
- Выбор даты
- Редактирование ставки (dailyRateSnapshot)
- Заметки

### 4. Monthly Report Page

**Файл:** `app/[locale]/admin/reports/monthly/page.tsx`

Страница месячного отчёта:
- Выбор месяца
- Итоги (revenue, labor cost, profit)
- Таблица по проектам

**URL:** `/he/admin/reports/monthly`

## 📝 Интеграция в DealModal

Компоненты автоматически добавлены в `DealModal`:

```tsx
// В DealModal.tsx уже добавлено:
import { WorkLogSection } from '../workers/WorkLogSection'
import { ProfitWidget } from '../workers/ProfitWidget'
import { useProjectRevenue } from '@/hooks/useProjectRevenue'

// В компоненте:
const revenue = useProjectRevenue(deal.id)

// В JSX:
<ProfitWidget projectId={deal.id} revenue={revenue} />
<WorkLogSection projectId={deal.id} />
```

## 🔧 Настройка

### 1. Запустить миграцию БД

```sql
-- В Supabase SQL Editor выполнить:
-- supabase/migrations/create_workers_work_shifts.sql
```

### 2. Добавить рабочих

Через API или напрямую в БД:

```sql
INSERT INTO workers (first_name, last_name, daily_rate, is_active)
VALUES ('יוסי', 'כהן', 500, true);
```

### 3. Использовать в проектах

На странице проекта (DealModal) автоматически доступны:
- Блок "יומן עבודה" - добавление/просмотр смен
- Виджет "רווח" - расчёт прибыли

## 📊 Логика расчётов

### Себестоимость рабочих (Labor Cost)

```
laborCost = Σ(dailyRateSnapshot всех смен проекта)
```

### Прибыль (Profit)

```
profit = revenue - laborCost
```

Где `revenue` берётся из:
- `Offer.finalPrice` (если есть утверждённое предложение)
- Или максимальный `finalPrice` из всех предложений проекта

### Месячный отчёт

- **Total Revenue:** Сумма `finalPrice` всех предложений за месяц
- **Total Labor Cost:** Сумма `dailyRateSnapshot` всех смен за месяц
- **Total Profit:** `totalRevenue - totalLaborCost`

## ✅ Особенности

1. **Snapshot ставки:** `dailyRateSnapshot` сохраняется на момент смены (важно для исторической точности)

2. **Один рабочий в день:** UNIQUE constraint на `(project_id, worker_id, date)`

3. **Валидация ставки:** `dailyRate` должен быть больше 0 (любая положительная сумма)

4. **Автоматический расчёт:** Прибыль пересчитывается автоматически при добавлении/удалении смен

5. **RTL поддержка:** Все компоненты поддерживают иврит и RTL

## 🐛 Troubleshooting

**Проблема:** Смены не отображаются
- Проверь, что `projectId` правильный (это `deal.id`)
- Проверь консоль браузера на ошибки API

**Проблема:** Revenue = 0
- Убедись, что есть предложения (offers) для проекта
- Проверь, что `finalPrice` заполнен в предложениях

**Проблема:** Ошибка при создании смены
- Проверь, что рабочий существует и активен
- Проверь формат даты (YYYY-MM-DD)
- Проверь, что `dailyRateSnapshot` больше 0

## 📚 Дополнительно

- Все компоненты используют TypeScript
- Все API endpoints типизированы
- Поддержка RTL и иврита
- Адаптивный дизайн (Tailwind CSS)
- Автоматическое обновление при изменениях


