/**
 * Скрипт для автоматического добавления изображений из S3 в Supabase
 * 
 * Использование:
 * 1. Убедитесь, что у вас настроены переменные окружения:
 *    - AWS_ACCESS_KEY_ID
 *    - AWS_SECRET_ACCESS_KEY
 *    - NEXT_PUBLIC_AWS_S3_BUCKET_NAME
 *    - NEXT_PUBLIC_AWS_S3_REGION
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 * 
 * 2. Запустите: node scripts/import-gallery-from-s3.js rails
 */

require('dotenv').config({ path: '.env.local' })
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { createClient } = require('@supabase/supabase-js')

// Конфигурация
const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Валидация
if (!S3_BUCKET || !S3_REGION) {
  console.error('❌ Ошибка: AWS S3 не настроен')
  console.error('   Установите NEXT_PUBLIC_AWS_S3_BUCKET_NAME и NEXT_PUBLIC_AWS_S3_REGION')
  process.exit(1)
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Ошибка: Supabase не настроен')
  console.error('   Установите SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Клиенты
const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: 'public' }
})

/**
 * Получить список файлов из S3 для категории
 */
async function listS3Images(category) {
  const prefix = `images/${category}/`
  
  console.log(`📂 Сканирование S3: ${S3_BUCKET}/${prefix}`)
  
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  })
  
  const response = await s3Client.send(command)
  
  if (!response.Contents || response.Contents.length === 0) {
    console.log(`⚠️  Нет файлов в S3 для категории ${category}`)
    return []
  }
  
  // Фильтруем только изображения и видео
  const mediaFiles = response.Contents.filter(item => {
    const key = item.Key || ''
    return /\.(webp|jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(key)
  })
  
  console.log(`✅ Найдено ${mediaFiles.length} медиафайлов в S3`)
  
  return mediaFiles.map(item => {
    const filename = item.Key.split('/').pop()
    const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${item.Key}`
    
    return {
      category_key: category,
      filename,
      url,
      storage_path: item.Key,
      size: item.Size || null,
    }
  })
}

/**
 * Добавить изображения в Supabase
 */
async function importImagesToSupabase(images) {
  console.log(`\n📤 Загрузка ${images.length} изображений в Supabase...`)
  
  let successCount = 0
  let skipCount = 0
  let errorCount = 0
  
  for (const image of images) {
    try {
      const { error } = await supabase
        .from('gallery_images')
        .insert(image)
      
      if (error) {
        if (error.code === '23505') { // Duplicate key
          console.log(`⏭️  Пропущено (уже существует): ${image.filename}`)
          skipCount++
        } else {
          console.error(`❌ Ошибка для ${image.filename}:`, error.message)
          errorCount++
        }
      } else {
        console.log(`✅ Добавлено: ${image.filename}`)
        successCount++
      }
    } catch (err) {
      console.error(`❌ Неожиданная ошибка для ${image.filename}:`, err.message)
      errorCount++
    }
  }
  
  console.log(`\n📊 Результат:`)
  console.log(`   ✅ Добавлено: ${successCount}`)
  console.log(`   ⏭️  Пропущено: ${skipCount}`)
  console.log(`   ❌ Ошибок: ${errorCount}`)
}

/**
 * Основная функция
 */
async function main() {
  const category = process.argv[2]
  
  if (!category) {
    console.error('❌ Ошибка: укажите категорию')
    console.error('   Использование: node scripts/import-gallery-from-s3.js <category>')
    console.error('   Пример: node scripts/import-gallery-from-s3.js rails')
    console.error('')
    console.error('   Доступные категории:')
    console.error('   - rails (מעקות)')
    console.error('   - pergulot (פרגולות)')
    console.error('   - windows (חלונות)')
    console.error('   - mestor (מסתור)')
    console.error('   - fancy (פאנסי)')
    console.error('   - fromShetah (מהשטח)')
    console.error('   - dgamim (דגמים)')
    process.exit(1)
  }
  
  console.log(`\n🚀 Импорт изображений для категории: ${category}`)
  console.log(`   S3 Bucket: ${S3_BUCKET}`)
  console.log(`   S3 Region: ${S3_REGION}`)
  console.log(`   Supabase: ${SUPABASE_URL}`)
  console.log('')
  
  // Проверяем, что категория существует в Supabase
  const { data: categoryData, error: categoryError } = await supabase
    .from('gallery_categories')
    .select('key, name_he')
    .eq('key', category)
    .single()
  
  if (categoryError || !categoryData) {
    console.error(`❌ Категория '${category}' не найдена в Supabase`)
    console.error('   Запустите миграцию create_gallery_categories.sql')
    process.exit(1)
  }
  
  console.log(`✅ Категория найдена: ${categoryData.name_he || category}`)
  
  // Получаем файлы из S3
  const images = await listS3Images(category)
  
  if (images.length === 0) {
    console.log('\n⚠️  Нечего импортировать')
    return
  }
  
  // Импортируем в Supabase
  await importImagesToSupabase(images)
  
  // Показываем статистику
  const { data: stats } = await supabase
    .from('gallery_images')
    .select('id', { count: 'exact', head: true })
    .eq('category_key', category)
  
  console.log(`\n📈 Всего изображений в категории '${category}': ${stats?.length || 0}`)
  console.log('✨ Готово!')
}

// Запуск
main().catch(err => {
  console.error('❌ Критическая ошибка:', err)
  process.exit(1)
})

