# 🔧 Исправление CORS ошибки для формы обратной связи

## Проблема

```
Access to fetch at 'http://localhost:3001/api/public/leads' from origin 'https://www.pashkovsky-group.com' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
The 'Access-Control-Allow-Origin' header has a value 'http://localhost:3000' that is not equal to the supplied origin.
```

**Причины:**
1. Сайт работает на `https://www.pashkovsky-group.com` (production)
2. Сайт пытается обратиться к `http://localhost:3001` (неправильный URL - должен быть production CRM)
3. CORS в CRM API настроен только на `http://localhost:3000`

## Решение

### ✅ Что исправлено:

1. **CORS в CRM API** (`apps/crm/app/api/public/leads/route.ts`):
   - Теперь динамически определяет origin из запроса
   - Разрешает запросы с:
     - `https://www.pashkovsky-group.com`
     - `https://pashkovsky-group.com`
     - `http://localhost:*` (для разработки)
   - Использует правильный origin для каждого запроса

### ⚠️ Что нужно сделать:

#### 1. Установить Environment Variables в Vercel (Site проект)

В Vercel Dashboard → Site проект → Settings → Environment Variables:

```env
NEXT_PUBLIC_CRM_API_URL=https://crm.pashkovsky-group.com
NEXT_PUBLIC_CRM_SITE_TOKEN=<ваш_токен>
```

**Важно:** Используйте production URL (`https://crm.pashkovsky-group.com`), а НЕ `localhost:3001`!

#### 2. Установить Environment Variables в Vercel (CRM проект)

В Vercel Dashboard → CRM проект → Settings → Environment Variables:

```env
NEXT_PUBLIC_SITE_URL=https://www.pashkovsky-group.com
CRM_SITE_TOKEN=<тот_же_токен>
DEFAULT_COMPANY_ID=<uuid_компании>
```

#### 3. Закоммитить изменения

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
git add apps/crm/app/api/public/leads/route.ts
git commit -m "fix(crm): allow CORS from production site domain"
git push
```

---

## После исправления

1. ✅ CORS будет правильно работать для production домена
2. ✅ Форма обратной связи будет работать на сайте
3. ✅ Локальная разработка тоже будет работать

---

## Проверка

После деплоя изменений:

1. Откройте сайт: https://www.pashkovsky-group.com
2. Заполните форму обратной связи
3. Нажмите "Отправить"
4. Должно появиться сообщение об успехе (без CORS ошибки)

---

## Если всё ещё ошибка

Проверьте:
- ✅ `NEXT_PUBLIC_CRM_API_URL` установлен в Site проекте = `https://crm.pashkovsky-group.com`
- ✅ `NEXT_PUBLIC_SITE_URL` установлен в CRM проекте = `https://www.pashkovsky-group.com`
- ✅ Оба проекта задеплоены с новыми переменными
- ✅ Изменения в `route.ts` закоммичены и задеплоены

