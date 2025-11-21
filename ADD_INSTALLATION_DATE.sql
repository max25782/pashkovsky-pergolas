-- ============================================
-- ДОБАВЛЕНИЕ ПОЛЯ "תאריך התקנה" (ДАТА УСТАНОВКИ)
-- ============================================

-- Добавляем колонку для даты установки
ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS installation_date TIMESTAMPTZ;

-- Создаем индекс для быстрого поиска по дате установки
CREATE INDEX IF NOT EXISTS idx_deals_installation_date ON deals(installation_date);

-- Проверяем результат
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'deals'
  AND column_name = 'installation_date';

