# Проверка таблицы deals в Supabase

## Как проверить, существует ли таблица deals

### Способ 1: Через Supabase Dashboard

1. Откройте **Supabase Dashboard** → ваш проект
2. Перейдите в **Table Editor** (в левом меню)
3. Проверьте список таблиц - должна быть таблица `deals`
4. Если таблицы нет - выполните SQL миграцию

### Способ 2: Через SQL Editor (рекомендуется)

1. Откройте **Supabase Dashboard** → **SQL Editor**
2. Выполните этот SQL для проверки:

```sql
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'deals'
    ) 
    THEN 'Таблица deals СУЩЕСТВУЕТ ✅'
    ELSE 'Таблица deals НЕ НАЙДЕНА ❌'
  END as status;
```

3. Если таблица не найдена, выполните полный SQL из файла `supabase/migrations/check_and_create_deals.sql`

### Способ 3: Быстрое создание (если таблицы нет)

Выполните этот SQL в **SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_city TEXT,
  deal_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (deal_status IN ('in_progress', 'confirmed', 'in_production', 'completed', 'cancelled')),
  deal_type TEXT,
  project_address TEXT,
  project_description TEXT,
  total_amount DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'ILS',
  payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  deal_date TIMESTAMPTZ DEFAULT NOW(),
  confirmed_date TIMESTAMPTZ,
  production_start_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  installation_date TIMESTAMPTZ,
  project_config JSONB,
  materials JSONB,
  measurements JSONB,
  notes TEXT,
  internal_notes TEXT,
  communication_log JSONB,
  sales_person TEXT,
  project_manager TEXT,
  installer TEXT,
  source TEXT,
  referral_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_customer_phone ON deals(customer_phone);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## После создания таблицы

1. **Обновите страницу** `/he/admin/deals` в браузере
2. Ошибка должна исчезнуть
3. Если есть существующие "won" лиды, выполните миграцию из `supabase/migrations/migrate_existing_won_leads.sql`

## Если ошибка все еще появляется

1. Подождите 10-30 секунд (кэш Supabase может обновляться)
2. Перезапустите dev сервер
3. Проверьте, что вы используете правильный проект Supabase (проверьте переменные окружения)



