# Обновление AWS ключей для S3

## Текущая ситуация

✅ **Новый активный ключ найден в AWS IAM:**
- Access Key ID: `your-access-key-id`
- Статус: Active
- Создан: недавно
- Никогда не использовался

❌ **Старый ключ в логах (неверный):**
- `AKIA4PFZSZFMBYZSLE7L` - вызывает ошибку `InvalidAccessKeyId`

## Шаг 1: Получите Secret Access Key

### Вариант A: Если ключ только что создан
Если вы только что создали ключ, Secret Access Key должен быть показан в модальном окне. **Сохраните его немедленно** - он показывается только один раз!

### Вариант B: Если Secret Key потерян
1. В AWS IAM → Users → `pashkovsky-s3`
2. Security credentials → Access keys
3. Нажмите "Create access key"
4. Выберите "Application running outside AWS"
5. Сохраните оба значения:
   - Access Key ID
   - Secret Access Key ⚠️ **Показывается только один раз!**

## Шаг 2: Обновите переменные окружения

### Для локальной разработки

Создайте или обновите файл `apps/site/.env.local`:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
```

### Для Vercel (Production)

1. Зайдите в Vercel Dashboard
2. Выберите проект `pashkovsky-site` (или ваш проект)
3. Settings → Environment Variables
4. Обновите или создайте:
   - `AWS_ACCESS_KEY_ID` = `your-access-key-id`
   - `AWS_SECRET_ACCESS_KEY` = `your-secret-access-key`
   - `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` = `pashkovsky-gallery`
   - `NEXT_PUBLIC_AWS_S3_REGION` = `eu-north-1`

5. **Важно:** После обновления переменных в Vercel нужно передеплоить проект!

## Шаг 3: Проверка

### Локально:
```bash
cd apps/site
npm run dev
```

Откройте в браузере:
```
http://localhost:3000/api/gallery/test-s3?prefix=images/dgamim/
```

Должно вернуть список файлов из S3 без ошибок.

### В логах сервера должно быть:
```
[Models API] S3 Configuration: {
  bucket: 'pashkovsky-gallery',
  region: 'eu-north-1',
  hasAccessKey: true,
  hasSecretKey: true
}
[Models API] Found X model folders: [...]
```

### В production (Vercel):
1. После обновления переменных → Redeploy
2. Проверьте логи в Vercel Dashboard
3. Откройте: `https://your-domain.com/api/gallery/test-s3?prefix=images/dgamim/`

## Проверка прав доступа

Убедитесь, что пользователь `pashkovsky-s3` имеет политики:
- ✅ `AmazonS3FullAccess` (уже прикреплена)
- ✅ Или минимальные права:
  - `s3:ListBucket` для bucket
  - `s3:GetObject` для объектов

## Важно

⚠️ **Безопасность:**
- Никогда не коммитьте `.env.local` в git
- Secret Access Key показывается только один раз при создании
- Если потеряли Secret Key - создайте новый и удалите старый
- Регулярно ротируйте ключи (каждые 90 дней)

## После обновления

После обновления ключей:
1. ✅ Ошибка `InvalidAccessKeyId` исчезнет
2. ✅ MediaGallery и DgamimCarousel будут получать изображения из S3
3. ✅ API endpoints вернут данные вместо пустых массивов




