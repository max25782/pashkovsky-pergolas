-- Проверка и создание таблицы deals
-- Этот скрипт проверяет существование таблицы и создает её, если нужно

-- Шаг 1: Проверка существования таблицы
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'deals'
    ) 
    THEN 'Таблица deals УЖЕ СУЩЕСТВУЕТ ✅'
    ELSE 'Таблица deals НЕ НАЙДЕНА ❌ - будет создана'
  END as table_status;

-- Шаг 2: Создание таблицы (если не существует)
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

-- Шаг 3: Создание индексов
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_customer_phone ON deals(customer_phone);

-- Шаг 4: Создание функции для автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Шаг 5: Создание триггера
DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Шаг 6: Проверка после создания
SELECT 
  'Таблица deals успешно создана! ✅' as result,
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'deals';

-- Шаг 7: Показать структуру таблицы
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'deals'
ORDER BY ordinal_position;



