# Как перейти на S3 изображения

## Текущее состояние

Сейчас изображения загружаются локально:
```
URL: /_next/image?url=%2Fimages%2Fdgamim%2Fsanta%20fe%2F1.jpg
Status: 200 OK (from localhost)
```

## Что нужно сделать

### Вариант 1: Миграция + автоматическая замена URL (рекомендуется)

#### Шаг 1: Запустите миграцию
```powershell
npm run migrate:public-to-s3
```

Это загрузит все изображения из `public/images/` в S3.

#### Шаг 2: Обновите код для использования хелпера

Найдите все места, где используются изображения, и замените на хелпер `getImageUrl()`:

**Было:**
```tsx
<img src="/images/dgamim/santa fe/1.jpg" />
```

**Стало:**
```tsx
import { getImageUrl } from '@/lib/image-url'

<img src={getImageUrl('/images/dgamim/santa fe/1.jpg')} />
```

Или для Next.js Image:
```tsx
import { getImageUrl } from '@/lib/image-url'

<Image 
  src={getImageUrl('/images/dgamim/santa fe/1.jpg')}
  width={640}
  height={480}
  alt="..."
/>
```

#### Шаг 3: Обновите next.config.js
```powershell
Copy-Item next.config.s3.js next.config.js
```

#### Шаг 4: Перезапустите dev server
```powershell
npm run dev
```

После этого изображения будут загружаться из S3:
```
URL: https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/1.jpg
Status: 200 OK (from S3)
```

---

### Вариант 2: Прямые S3 URL (без локального fallback)

Если хотите использовать только S3, без `getImageUrl()`:

#### Шаг 1: Запустите миграцию
```powershell
npm run migrate:public-to-s3
```

#### Шаг 2: Создайте константу для S3 base URL

Файл `lib/constants.ts`:
```typescript
export const S3_BASE_URL = 'https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com'
```

#### Шаг 3: Используйте в коде

```tsx
import { S3_BASE_URL } from '@/lib/constants'

// Было:
<img src="/images/dgamim/santa fe/1.jpg" />

// Стало:
<img src={`${S3_BASE_URL}/images/dgamim/santa fe/1.jpg`} />
```

---

## Где обновить код

Найдите все файлы, где используются изображения:

```powershell
# Найти все компоненты с изображениями
grep -r "src=\"/images" --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js"
```

Основные файлы для обновления (примеры):
- `app/[locale]/pergulas/page.tsx` - галерея пергол
- `app/[locale]/models/page.tsx` - галерея моделей  
- `components/...` - компоненты с изображениями
- Любые другие файлы, где используется `/images/...`

---

## Как проверить, что работает S3

### 1. Откройте DevTools → Network
### 2. Отфильтруйте по "Img"
### 3. Обновите страницу
### 4. Проверьте URL изображений:

**До миграции (локально):**
```
Request URL: http://localhost:3000/_next/image?url=%2Fimages%2Fdgamim%2Fsanta%20fe%2F1.jpg
Remote Address: [::1]:3000
```

**После миграции (S3):**
```
Request URL: https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/1.jpg
Remote Address: 52.218.xxx.xxx (AWS IP)
Cache-Control: max-age=31536000
```

Или если используете Next.js Image с S3:
```
Request URL: /_next/image?url=https%3A%2F%2Fpashkovsky-gallery.s3.eu-north-1.amazonaws.com%2Fimages%2Fdgamim%2Fsanta%2520fe%2F1.jpg
X-Vercel-Cache: HIT
```

---

## Автоматизация замены (опционально)

Создайте скрипт для автоматической замены:

```javascript
// scripts/replace-image-urls.mjs
import fs from 'fs'
import path from 'path'

const files = [
  'app/[locale]/pergulas/page.tsx',
  'app/[locale]/models/page.tsx',
  // добавьте другие файлы
]

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8')
  
  // Заменить src="/images/... на src={getImageUrl('/images/...
  content = content.replace(
    /src="(\/images\/[^"]+)"/g,
    'src={getImageUrl("$1")}'
  )
  
  // Добавить импорт getImageUrl, если его нет
  if (!content.includes('import { getImageUrl }')) {
    content = `import { getImageUrl } from '@/lib/image-url'\n${content}`
  }
  
  fs.writeFileSync(file, content)
  console.log(`✅ Updated: ${file}`)
})
```

Запустите:
```powershell
node scripts/replace-image-urls.mjs
```

---

## Пример: До и После

### До (локальные изображения):

```tsx
// app/[locale]/pergulas/page.tsx
export default function PergulasPage() {
  return (
    <div>
      <img src="/images/pergulot/ashdod/1.jpg" alt="Pergola" />
      <Image 
        src="/images/dgamim/santa fe/1.jpg" 
        width={640} 
        height={480}
        alt="Model"
      />
    </div>
  )
}
```

DevTools:
```
Request URL: http://localhost:3000/_next/image?url=%2Fimages%2Fpergulot%2Fashdod%2F1.jpg
Remote Address: [::1]:3000
```

### После (S3 изображения):

```tsx
// app/[locale]/pergulas/page.tsx
import { getImageUrl } from '@/lib/image-url'

export default function PergulasPage() {
  return (
    <div>
      <img src={getImageUrl('/images/pergulot/ashdod/1.jpg')} alt="Pergola" />
      <Image 
        src={getImageUrl('/images/dgamim/santa fe/1.jpg')}
        width={640} 
        height={480}
        alt="Model"
      />
    </div>
  )
}
```

DevTools:
```
Request URL: https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/pergulot/ashdod/1.jpg
Remote Address: 52.218.xxx.xxx (AWS)
Cache-Control: max-age=31536000
```

---

## Преимущества использования getImageUrl()

✅ **Автоматический fallback**: Если S3 не настроен, используются локальные изображения
✅ **Легко тестировать**: Можно переключаться между S3 и локальными изображениями
✅ **Один раз обновить**: Не нужно менять код при изменении S3 bucket
✅ **Environment-specific**: Dev может использовать локальные, prod - S3

---

## Troubleshooting

### Изображения не загружаются из S3:
1. Проверьте, что миграция прошла успешно
2. Проверьте Bucket Policy (публичный доступ)
3. Проверьте CORS в S3
4. Проверьте `next.config.js` (должен включать S3 в remotePatterns)

### Ошибка CORS:
Добавьте CORS в S3 (см. `S3_MIGRATION_GUIDE.md`)

### Next.js Image не работает с S3:
Обновите `next.config.js`:
```javascript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'pashkovsky-gallery.s3.eu-north-1.amazonaws.com',
      pathname: '/images/**',
    },
  ],
}
```

### Медленная загрузка:
- Используйте CloudFront CDN
- Проверьте регион S3 (должен быть близко к пользователям)

