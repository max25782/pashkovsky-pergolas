-- ============================================
-- Создание таблицы gallery_categories
-- ============================================
-- Таблица для хранения метаданных категорий галереи
-- ============================================

CREATE TABLE IF NOT EXISTS gallery_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name_he TEXT,
  name_ru TEXT,
  name_en TEXT,
  description_he TEXT,
  description_ru TEXT,
  description_en TEXT,
  image_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_gallery_categories_key ON gallery_categories(key);
CREATE INDEX IF NOT EXISTS idx_gallery_categories_created_at ON gallery_categories(created_at DESC);

-- Функция для автообновления updated_at
CREATE OR REPLACE FUNCTION update_gallery_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автообновления updated_at
DROP TRIGGER IF EXISTS update_gallery_categories_updated_at ON gallery_categories;
CREATE TRIGGER update_gallery_categories_updated_at
  BEFORE UPDATE ON gallery_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_gallery_categories_updated_at();

-- Вставляем существующие категории из data/gallery/index.json
INSERT INTO gallery_categories (key, name_he, name_ru, name_en, image_count)
VALUES
  ('fancy', 'פאנסי', 'Фэнси', 'Fancy', 0),
  ('mestor', 'מסתור', 'Местор', 'Mestor', 0),
  ('rails', 'מעקות', 'Перила', 'Rails', 0),
  ('windows', 'חלונות', 'Окна', 'Windows', 0),
  ('fromShetah', 'מהשטח', 'С площадки', 'From Site', 0),
  ('pergulot', 'פרגולות', 'Перголы', 'Pergolas', 0),
  ('dgamim', 'דגמים', 'Модели', 'Models', 0)
ON CONFLICT (key) DO NOTHING;


