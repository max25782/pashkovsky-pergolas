# 📄 Pashkovsky Group - Public Site

Публичный сайт компании Pashkovsky Group.

## 🚀 Запуск

```bash
# Из root директории монорепо
npm run dev:site

# Или из apps/site
npm run dev
```

Откроется на `http://localhost:3000`

## 📦 Что включает

- Главная страница
- Портфолио проектов (перголы, заборы, окна)
- Блог и статьи
- Страница контактов
- 3D конфигуратор пергол

## 🔗 API

Отправляет лиды в CRM через:
```
POST https://crm.pashkovsky-group.com/api/public/leads
```

## 🛠️ Технологии

- Next.js 14
- React 18
- TailwindCSS
- Framer Motion
- AWS S3 (изображения)

## 📝 Environment Variables

См. `/docs/ENV_LOCAL_SETUP.md`

