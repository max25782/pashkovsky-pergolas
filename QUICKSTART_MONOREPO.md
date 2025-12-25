# 🎯 Quick Start после разделения монорепо

## ⚠️ ВАЖНО!

Проект теперь разделён на **2 независимых приложения**!

---

## 📁 Новая структура

```
apps/
  ├── site/   # Port 3000 - Публичный сайт
  └── crm/    # Port 3001 - CRM система
```

---

## 🚀 Как запустить

### 1. Установить зависимости (из root)

```bash
npm install
```

### 2. Настроить .env.local для Site

Создайте `apps/site/.env.local`:

```bash
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery
NEXT_PUBLIC_AWS_S3_REGION=eu-north-1
NEXT_PUBLIC_CRM_API_URL=http://localhost:3001
CRM_SITE_TOKEN=your-secret-token
```

### 3. Настроить .env.local для CRM

Создайте `apps/crm/.env.local`:

```bash
# Скопируйте ВСЕ переменные из старого .env.local
# + добавьте:
CRM_SITE_TOKEN=your-secret-token
```

### 4. Запустить оба приложения

```bash
# Из root директории:
npm run dev
```

Или по отдельности:

```bash
# Site (3000)
npm run dev:site

# CRM (3001)
npm run dev:crm
```

---

## ✅ Проверка

- **Site**: http://localhost:3000
- **CRM**: http://localhost:3001/app/admin

---

## 📝 Дополнительно

- **Документация**: `/README.md`
- **Деплой**: `/docs/MONOREPO_DEPLOY.md`
- **Полная информация**: `/docs/MONOREPO_COMPLETE.md`

---

## 🐛 Проблемы?

### "Cannot find module"

**Решение**: `npm install` из root директории

### "Port already in use"

**Решение**: Остановите старый dev server

### "Environment variables not loaded"

**Решение**: Создайте `.env.local` в `apps/site` и `apps/crm`

---

🎉 **Готово! Теперь у вас 2 независимых приложения!**

