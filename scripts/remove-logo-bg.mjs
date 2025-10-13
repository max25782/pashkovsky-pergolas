#!/usr/bin/env node
import { PNG } from 'pngjs'
import fs from 'fs'
import path from 'path'

const projectRoot = process.cwd()
const srcPath = path.join(projectRoot, 'public', 'logo.png')
const outPath = path.join(projectRoot, 'public', 'logo-transparent.png')

// Цвет фона (почти белый) станет прозрачным. Порог можно подкрутить.
const WHITE_THRESHOLD = 250 // 0..255

function isNearWhite(r, g, b) {
  return r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD
}

fs.createReadStream(srcPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function () {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2
        const r = this.data[idx]
        const g = this.data[idx + 1]
        const b = this.data[idx + 2]
        const a = this.data[idx + 3]

        // Превращаем почти белый фон в прозрачный
        if (isNearWhite(r, g, b)) {
          this.data[idx + 3] = 0 // alpha = 0
        } else {
          // усилим непрозрачность логотипа
          this.data[idx + 3] = Math.max(a, 220)
        }
      }
    }

    this.pack().pipe(fs.createWriteStream(outPath)).on('finish', () => {
      console.log(`Saved: ${path.relative(projectRoot, outPath)}`)
    })
  })
  .on('error', (err) => {
    console.error('Failed to process logo:', err)
    process.exit(1)
  })


