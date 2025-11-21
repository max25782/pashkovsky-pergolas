-- ============================================
-- БЫСТРОЕ ИСПРАВЛЕНИЕ: ДОБАВЛЕНИЕ ВСЕХ НЕДОСТАЮЩИХ КОЛОНОК
-- ============================================
-- Скопируйте и выполните этот SQL в Supabase SQL Editor
-- Это добавит все недостающие колонки за один раз
-- ============================================

DO $$ 
BEGIN
  -- Моя стоимость
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='my_cost') THEN
    ALTER TABLE deals ADD COLUMN my_cost NUMERIC;
    RAISE NOTICE 'Added column: my_cost';
  END IF;
  
  -- Дата заказа проекта
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='order_date') THEN
    ALTER TABLE deals ADD COLUMN order_date TIMESTAMPTZ;
    RAISE NOTICE 'Added column: order_date';
  END IF;
  
  -- Дата заказа материала
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='material_order_date') THEN
    ALTER TABLE deals ADD COLUMN material_order_date TIMESTAMPTZ;
    RAISE NOTICE 'Added column: material_order_date';
  END IF;
  
  -- Дата получения материала
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='material_received_date') THEN
    ALTER TABLE deals ADD COLUMN material_received_date TIMESTAMPTZ;
    RAISE NOTICE 'Added column: material_received_date';
  END IF;
  
  -- Дата установки
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='installation_date') THEN
    ALTER TABLE deals ADD COLUMN installation_date TIMESTAMPTZ;
    RAISE NOTICE 'Added column: installation_date';
  END IF;
  
  -- Проверяем, что все колонки дат созданы
  RAISE NOTICE 'Checking date columns...';
  
  -- Освещение
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deals' AND column_name='lighting') THEN
    ALTER TABLE deals ADD COLUMN lighting TEXT;
    RAISE NOTICE 'Added column: lighting';
  END IF;
  
  RAISE NOTICE 'All columns checked and added if needed';
END $$;

-- Проверяем результат - показываем все колонки deals
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'deals'
ORDER BY ordinal_position;

