-- ============================================
-- Добавление изображений Railings из S3
-- ============================================
-- 
-- ИНСТРУКЦИЯ:
-- 1. Замените URL ниже на реальные URL ваших изображений из S3
-- 2. Запустите этот скрипт в Supabase SQL Editor
-- 
-- Формат S3 URL:
-- https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/filename.webp
-- ============================================

-- Проверяем, что категория 'rails' существует
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gallery_categories WHERE key = 'rails') THEN
    INSERT INTO gallery_categories (key, name_he, name_ru, name_en, image_count)
    VALUES ('rails', 'מעקות', 'Перила', 'Rails', 0);
    RAISE NOTICE 'Created rails category';
  END IF;
END $$;

-- Добавляем изображения (ЗАМЕНИТЕ НА ВАШИ РЕАЛЬНЫЕ URL)
INSERT INTO gallery_images (category_key, filename, url, storage_path)
VALUES
  -- Пример 1: замените на ваш реальный URL
  ('rails', 'railing-1.webp', 'https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/railing-1.webp', 'images/rails/railing-1.webp'),
  
  -- Пример 2: замените на ваш реальный URL
  ('rails', 'railing-2.webp', 'https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/railing-2.webp', 'images/rails/railing-2.webp'),
  
  -- Пример 3: замените на ваш реальный URL
  ('rails', 'railing-3.webp', 'https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/railing-3.webp', 'images/rails/railing-3.webp')
  
  -- Добавьте больше изображений, используя тот же формат:
  -- ('rails', 'filename.webp', 'https://your-bucket.s3.region.amazonaws.com/images/rails/filename.webp', 'images/rails/filename.webp'),

ON CONFLICT (category_key, filename) DO NOTHING;

-- Показываем статистику
SELECT 
  'Статистика категории rails:' as info,
  COUNT(*) as total_images,
  MIN(created_at) as first_added,
  MAX(created_at) as last_added
FROM gallery_images 
WHERE category_key = 'rails';

