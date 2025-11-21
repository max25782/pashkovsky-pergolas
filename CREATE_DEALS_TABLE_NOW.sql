-- ============================================
-- СОЗДАНИЕ/ОБНОВЛЕНИЕ ТАБЛИЦЫ DEALS
-- ============================================
-- ВАЖНО: Используйте файл ALTER_DEALS_TABLE.sql для безопасного обновления
-- Этот файл удаляет таблицу и все данные!
-- ============================================
-- Инструкция:
-- 1. Откройте https://supabase.com/dashboard
-- 2. Выберите ваш проект
-- 3. Нажмите "SQL Editor" в левом меню
-- 4. Нажмите "New Query"
-- 5. Скопируйте ВЕСЬ код ниже
-- 6. Вставьте в SQL Editor
-- 7. Нажмите "Run" или Ctrl+Enter
-- ============================================
-- ВНИМАНИЕ: Этот SQL удалит все данные!
-- Для безопасного обновления используйте ALTER_DEALS_TABLE.sql
-- ============================================

-- Удаляем старую таблицу если существует (ОСТОРОЖНО: удалит все данные!)
DROP TABLE IF EXISTS deals CASCADE;

-- Создаем новую таблицу deals
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  -- Информация о клиенте (из лида)
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_city TEXT,
  -- Информация о проекте
  project_type TEXT CHECK (project_type IN ('pergola', 'railing', 'gates', 'windows')),
  width NUMERIC,
  depth NUMERIC,
  shape TEXT CHECK (shape IN ('прямоугольник', 'Г-образная')),
  material TEXT,
  color_ral TEXT,
  price NUMERIC,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'call', 'measure', 'offer', 'approved', 'production', 'install', 'done')),
  notes TEXT,
  files JSONB,
  manager TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_project_type ON deals(project_type);

-- Создаем функцию для автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для автообновления updated_at
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Проверка: должно вернуть количество колонок (должно быть 15)
SELECT COUNT(*) as columns_count FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'deals';
