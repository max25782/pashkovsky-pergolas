# 🚀 Vercel Deployment Guide

## 📋 Шаги для деплоя в Vercel

### 1. Подключение репозитория

1. Откройте https://vercel.com/dashboard
2. Нажмите **"Add New Project"** или выберите существующий проект
3. Импортируйте репозиторий: `max25782/pashkovsky-pergolas`
4. Выберите branch: `master`

---

### 2. Настройка переменных окружения в Vercel

**В Vercel Dashboard → Settings → Environment Variables** добавьте:

#### 🔵 ОБЯЗАТЕЛЬНЫЕ (для работы приложения):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Multi-tenant
DEFAULT_COMPANY_ID=your-default-company-uuid

# Public Lead API
CRM_SITE_TOKEN=generate-random-32-char-token
```

#### 🟢 ОПЦИОНАЛЬНЫЕ (для полной функциональности):

```bash
# URLs
NEXT_PUBLIC_SITE_URL=https://pashkovsky-group.com
NEXT_PUBLIC_CRM_URL=https://crm.pashkovsky-group.com

# AWS S3 (для загрузки PDF и изображений)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=pashkovsky-gallery

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# WhatsApp (опционально)
WHATSAPP_API_KEY=your-whatsapp-api-key
WHATSAPP_PHONE=+972XXXXXXXXX

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

### 3. Где взять значения?

#### **Supabase:**
1. Откройте https://supabase.com/dashboard
2. Выберите проект
3. Settings → API
4. Скопируйте:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

#### **JWT_SECRET:**
```bash
# Сгенерируйте случайный ключ:
openssl rand -base64 32
```

#### **CRM_SITE_TOKEN:**
```bash
# Сгенерируйте токен для публичного API:
openssl rand -base64 32
```

#### **DEFAULT_COMPANY_ID:**
1. Откройте Supabase SQL Editor
2. Выполните:
```sql
SELECT id FROM companies LIMIT 1;
```
3. Скопируйте UUID

---

### 4. Настройка окружений (Production, Preview, Development)

В Vercel можно настроить разные переменные для разных окружений:

- **Production** - для `master` branch
- **Preview** - для pull requests
- **Development** - для локальной разработки

**Рекомендация:** Добавьте все переменные в **Production** и **Preview**.

---

### 5. Build Settings

Vercel автоматически определит Next.js проект. Проверьте:

- **Framework Preset:** Next.js
- **Root Directory:** `./` (корень проекта)
- **Build Command:** `npm run build` (автоматически)
- **Output Directory:** `.next` (автоматически)
- **Install Command:** `npm install` (автоматически)

---

### 6. После добавления переменных

1. **Redeploy** проект:
   - Dashboard → Deployments
   - Нажмите "..." на последнем деплое
   - Выберите "Redeploy"

2. **Проверьте логи:**
   - Откройте деплой
   - Проверьте Build Logs на ошибки

---

### 7. Проверка деплоя

После успешного деплоя проверьте:

- ✅ Главная страница загружается
- ✅ API routes работают (`/api/offers`)
- ✅ Аутентификация работает (`/login`)
- ✅ PDF генерация работает (если настроен S3)

---

### 8. Troubleshooting

#### **Ошибка: "Missing environment variables"**
→ Проверьте, что все обязательные переменные добавлены в Vercel

#### **Ошибка: "Cannot connect to Supabase"**
→ Проверьте `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`

#### **Ошибка: "JWT verification failed"**
→ Проверьте `JWT_SECRET` - должен быть одинаковым на всех окружениях

#### **PDF не генерируется**
→ Проверьте AWS S3 переменные (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`)

#### **401 Unauthorized на API**
→ Проверьте `JWT_SECRET` и `SUPABASE_SERVICE_ROLE_KEY`

---

### 9. Обновление переменных

После изменения переменных окружения:

1. **Vercel автоматически пересоберет проект** при следующем push
2. Или нажмите **"Redeploy"** вручную

---

### 10. Безопасность

⚠️ **ВАЖНО:**

- ❌ **НЕ коммитьте** `.env` файлы в Git
- ✅ Используйте **Vercel Environment Variables**
- ✅ Используйте **разные ключи** для Production и Development
- ✅ Регулярно **ротируйте** секретные ключи

---

## 📝 Чек-лист перед деплоем

- [ ] Все обязательные переменные добавлены в Vercel
- [ ] `JWT_SECRET` сгенерирован и добавлен
- [ ] `CRM_SITE_TOKEN` сгенерирован и добавлен
- [ ] `DEFAULT_COMPANY_ID` добавлен
- [ ] Supabase ключи добавлены
- [ ] AWS S3 ключи добавлены (если нужен PDF)
- [ ] SMTP настройки добавлены (если нужна отправка email)
- [ ] Проект подключен к GitHub репозиторию
- [ ] Production branch = `master`
- [ ] Автоматический деплой включен

---

## 🔗 Полезные ссылки

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Dashboard](https://supabase.com/dashboard)

---

**Готово! После настройки всех переменных Vercel автоматически задеплоит проект при каждом push в `master` branch!** 🎉

