-- ============================================
-- ПРОВЕРКА ВСЕХ КОЛОНОК В ТАБЛИЦЕ DEALS
-- ============================================
-- Этот SQL показывает все колонки таблицы deals
-- Используйте для проверки, какие колонки существуют
-- ============================================

-- Показываем все колонки deals
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'deals'
ORDER BY ordinal_position;

-- Проверяем конкретно даты
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'deals'
  AND column_name IN (
    'order_date',
    'material_order_date', 
    'material_received_date',
    'installation_date'
  )
ORDER BY column_name;

