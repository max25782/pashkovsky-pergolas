import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Установка пути к ffmpeg
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
ffmpeg.setFfmpegPath(ffmpegPath.path)

const videoExtensions = ['.mp4', '.webm', '.mov', '.avi']

function isVideoFile(filename) {
  return videoExtensions.includes(path.extname(filename).toLowerCase())
}

function getAllVideos(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      getAllVideos(filePath, fileList)
    } else if (isVideoFile(file)) {
      fileList.push(filePath)
    }
  })
  
  return fileList
}

function compressVideo(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/(\.\w+)$/, '.compressed$1')
    const fileSize = fs.statSync(inputPath).size / (1024 * 1024) // MB
    
    // Если видео меньше 50 MB, пропускаем
    if (fileSize < 50) {
      console.log(`✓ ${path.basename(inputPath)} уже достаточно маленький (${fileSize.toFixed(2)} MB)`)
      resolve()
      return
    }
    
    console.log(`🎬 Сжимаю ${path.basename(inputPath)} (${fileSize.toFixed(2)} MB)...`)
    
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-crf 28', // Качество (18-28: чем выше, тем больше сжатие, 23 - default)
        '-preset medium', // Скорость кодирования
        '-movflags +faststart', // Для веб-оптимизации
        '-vf scale=1920:-2' // Максимальная ширина 1920px
      ])
      .on('end', () => {
        const newSize = fs.statSync(outputPath).size / (1024 * 1024)
        console.log(`✓ ${path.basename(inputPath)} сжат: ${fileSize.toFixed(2)} MB → ${newSize.toFixed(2)} MB`)
        
        // Заменяем оригинальный файл
        fs.unlinkSync(inputPath)
        fs.renameSync(outputPath, inputPath)
        
        resolve()
      })
      .on('error', (err) => {
        console.error(`✗ Ошибка при сжатии ${path.basename(inputPath)}:`, err.message)
        // Удаляем временный файл если он был создан
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath)
        }
        reject(err)
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r  Прогресс: ${Math.round(progress.percent)}%`)
        }
      })
      .save(outputPath)
  })
}

async function main() {
  const publicDir = path.join(__dirname, '../public')
  
  console.log('🔍 Поиск видео файлов...\n')
  const videos = getAllVideos(publicDir)
  
  if (videos.length === 0) {
    console.log('Видео не найдено.')
    return
  }
  
  console.log(`Найдено ${videos.length} видео:\n`)
  
  for (const video of videos) {
    try {
      await compressVideo(video)
      console.log('') // Новая строка после каждого видео
    } catch (err) {
      console.error(`Не удалось сжать ${video}`)
    }
  }
  
  console.log('\n✅ Готово!')
}

main()

