-- ============================================
-- БЫСТРОЕ ДОБАВЛЕНИЕ НОВЫХ КОЛОНОК В ТАБЛИЦУ DEALS
-- ============================================
-- Выполните этот SQL в Supabase SQL Editor
-- ============================================

-- Добавляем все новые колонки одной командой
ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS my_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS order_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS material_order_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS material_received_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS installation_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lighting TEXT;

-- Проверяем результат
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'deals'
  AND column_name IN ('my_cost', 'order_date', 'material_order_date', 'material_received_date', 'installation_date', 'lighting')
ORDER BY column_name;

