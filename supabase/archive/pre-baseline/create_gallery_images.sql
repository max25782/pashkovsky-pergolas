-- ============================================
-- Создание таблицы gallery_images
-- ============================================
-- Таблица для хранения метаданных изображений галереи
-- ============================================

CREATE TABLE IF NOT EXISTS gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL REFERENCES gallery_categories(key) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size INTEGER,
  width INTEGER,
  height INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_key, filename)
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_gallery_images_category_key ON gallery_images(category_key);
CREATE INDEX IF NOT EXISTS idx_gallery_images_created_at ON gallery_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_images_filename ON gallery_images(filename);

-- Функция для автообновления updated_at
CREATE OR REPLACE FUNCTION update_gallery_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автообновления updated_at
DROP TRIGGER IF EXISTS update_gallery_images_updated_at ON gallery_images;
CREATE TRIGGER update_gallery_images_updated_at
  BEFORE UPDATE ON gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION update_gallery_images_updated_at();

-- Функция для автоматического обновления счетчика изображений в категории
CREATE OR REPLACE FUNCTION update_gallery_category_image_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE gallery_categories
    SET image_count = image_count + 1
    WHERE key = NEW.category_key;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE gallery_categories
    SET image_count = GREATEST(image_count - 1, 0)
    WHERE key = OLD.category_key;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для автоматического обновления счетчика
DROP TRIGGER IF EXISTS update_category_count_on_insert ON gallery_images;
CREATE TRIGGER update_category_count_on_insert
  AFTER INSERT ON gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION update_gallery_category_image_count();

DROP TRIGGER IF EXISTS update_category_count_on_delete ON gallery_images;
CREATE TRIGGER update_category_count_on_delete
  AFTER DELETE ON gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION update_gallery_category_image_count();

