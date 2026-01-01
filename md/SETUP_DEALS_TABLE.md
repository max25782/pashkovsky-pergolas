# Создание таблицы deals в Supabase

## Проблема
Ошибка: `Could not find the table 'public.deals' in the schema cache`

## Решение

### Шаг 1: Откройте Supabase Dashboard
1. Перейдите на https://supabase.com/dashboard
2. Войдите в свой аккаунт
3. Выберите проект Pashkovsky

### Шаг 2: Откройте SQL Editor
1. В левом меню нажмите на **SQL Editor**
2. Нажмите **New Query**

### Шаг 3: Скопируйте и выполните SQL

Скопируйте весь код из файла `supabase/migrations/create_deals_table.sql` или используйте код ниже:

```sql
-- Create deals table for closed leads (won status)
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Basic information from lead
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_city TEXT,
  
  -- Deal information
  deal_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (deal_status IN ('in_progress', 'confirmed', 'in_production', 'completed', 'cancelled')),
  deal_type TEXT,
  project_address TEXT,
  project_description TEXT,
  
  -- Financial information
  total_amount DECIMAL(10, 2),
  deposit_amount DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'ILS',
  payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  
  -- Dates
  deal_date TIMESTAMPTZ DEFAULT NOW(),
  confirmed_date TIMESTAMPTZ,
  production_start_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  installation_date TIMESTAMPTZ,
  
  -- Project details
  project_config JSONB,
  materials JSONB,
  measurements JSONB,
  
  -- Communication
  notes TEXT,
  internal_notes TEXT,
  communication_log JSONB,
  
  -- Team assignment
  sales_person TEXT,
  project_manager TEXT,
  installer TEXT,
  
  -- Source tracking
  source TEXT,
  referral_source TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_customer_phone ON deals(customer_phone);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Шаг 4: Выполните SQL
1. Вставьте код в SQL Editor
2. Нажмите **Run** или **Ctrl+Enter**
3. Должно появиться сообщение об успешном выполнении

### Шаг 5: Проверьте
1. Обновите страницу `/he/admin/deals` в браузере
2. Ошибка должна исчезнуть
3. Таблица должна быть пустой (пока нет сделок)

## После создания таблицы

Когда лид получает статус "won" в простой CRM, он автоматически переносится в таблицу `deals` и появится в интерфейсе сделок.



