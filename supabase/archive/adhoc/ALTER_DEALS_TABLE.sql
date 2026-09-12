-- ============================================
-- ОБНОВЛЕНИЕ ТАБЛИЦЫ DEALS - БЕЗ УДАЛЕНИЯ ДАННЫХ
-- ============================================
-- Этот SQL добавляет недостающие колонки к существующей таблице
-- Если таблицы нет, создаст новую
-- ============================================

-- Создаем таблицу если её нет
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Добавляем колонки клиента (если их нет)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='customer_name') THEN
    ALTER TABLE deals ADD COLUMN customer_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='customer_phone') THEN
    ALTER TABLE deals ADD COLUMN customer_phone TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='customer_email') THEN
    ALTER TABLE deals ADD COLUMN customer_email TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='customer_city') THEN
    ALTER TABLE deals ADD COLUMN customer_city TEXT;
  END IF;
END $$;

-- Добавляем колонки проекта (если их нет)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='project_type') THEN
    ALTER TABLE deals ADD COLUMN project_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='width') THEN
    ALTER TABLE deals ADD COLUMN width NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='depth') THEN
    ALTER TABLE deals ADD COLUMN depth NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='shape') THEN
    ALTER TABLE deals ADD COLUMN shape TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='material') THEN
    ALTER TABLE deals ADD COLUMN material TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='color_ral') THEN
    ALTER TABLE deals ADD COLUMN color_ral TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='price') THEN
    ALTER TABLE deals ADD COLUMN price NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='my_cost') THEN
    ALTER TABLE deals ADD COLUMN my_cost NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='order_date') THEN
    ALTER TABLE deals ADD COLUMN order_date TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='material_order_date') THEN
    ALTER TABLE deals ADD COLUMN material_order_date TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='material_received_date') THEN
    ALTER TABLE deals ADD COLUMN material_received_date TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='installation_date') THEN
    ALTER TABLE deals ADD COLUMN installation_date TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='lighting') THEN
    ALTER TABLE deals ADD COLUMN lighting TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='stage') THEN
    ALTER TABLE deals ADD COLUMN stage TEXT DEFAULT 'new';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='notes') THEN
    ALTER TABLE deals ADD COLUMN notes TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='files') THEN
    ALTER TABLE deals ADD COLUMN files JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='manager') THEN
    ALTER TABLE deals ADD COLUMN manager TEXT;
  END IF;
END $$;

-- Создаем индексы (если их нет)
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_project_type ON deals(project_type);
CREATE INDEX IF NOT EXISTS idx_deals_order_date ON deals(order_date);
CREATE INDEX IF NOT EXISTS idx_deals_material_order_date ON deals(material_order_date);
CREATE INDEX IF NOT EXISTS idx_deals_installation_date ON deals(installation_date);

-- Создаем функцию для автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер (удаляем старый если есть, создаем новый)
DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Проверка: показываем все колонки таблицы
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'deals'
ORDER BY ordinal_position;
