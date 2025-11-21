-- ============================================
-- ПОЛНОЕ СОЗДАНИЕ ТАБЛИЦЫ DEALS СО ВСЕМИ КОЛОНКАМИ
-- ============================================
-- Этот SQL создает таблицу deals со всеми необходимыми колонками
-- Используйте этот скрипт если таблицы еще нет
-- ============================================

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Информация о клиенте
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_city TEXT,
  
  -- Информация о проекте
  project_type TEXT,
  width NUMERIC,
  depth NUMERIC,
  shape TEXT,
  material TEXT,
  color_ral TEXT,
  lighting TEXT,
  
  -- Финансовая информация
  price NUMERIC,
  my_cost NUMERIC,
  
  -- Даты
  order_date TIMESTAMPTZ,
  material_order_date TIMESTAMPTZ,
  material_received_date TIMESTAMPTZ,
  
  -- Статус и управление
  stage TEXT DEFAULT 'new',
  manager TEXT,
  notes TEXT,
  files JSONB,
  
  -- Метаданные
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_project_type ON deals(project_type);
CREATE INDEX IF NOT EXISTS idx_deals_order_date ON deals(order_date);
CREATE INDEX IF NOT EXISTS idx_deals_material_order_date ON deals(material_order_date);

-- Создаем функцию для автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер
DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Проверка: показываем все колонки таблицы
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'deals'
ORDER BY ordinal_position;

