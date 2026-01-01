# Vercel Deployment - Monorepo

⚠️ **НЕ ИСПОЛЬЗУЙТЕ** этот файл для деплоя!

## Правильный подход:

Создайте **ДВА ОТДЕЛЬНЫХ ПРОЕКТА** в Vercel:

### 1. Проект для SITE (pashkovsky-group.com)
- Root Directory: `apps/site`
- См. инструкции: `apps/site/VERCEL_DEPLOY.md`

### 2. Проект для CRM (crm.pashkovsky-group.com)
- Root Directory: `apps/crm`
- См. инструкции: `apps/crm/VERCEL_DEPLOY.md`

---

## Почему два проекта?

- ✅ Изолированные переменные окружения
- ✅ Разные домены
- ✅ Независимые деплои
- ✅ Проще управлять

---

Этот файл (`vercel.json` в корне) можно удалить.

