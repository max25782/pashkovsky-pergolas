# 🎯 СОХРАНЕНИЕ СУЩЕСТВУЮЩЕЙ КОМПАНИИ

Вы правы! У вас уже есть компания **Pashkovsky Group** в Supabase!

Давайте свяжем её с Supabase Auth, **не теряя данные**.

---

## 📋 ШАГ 1: Выполните миграцию (сохраняет компанию)

**В Supabase SQL Editor выполните:**
```
supabase/MIGRATION_KEEP_COMPANY.sql
```

Это:
- ✅ Изменит FK на `auth.users`
- ✅ Сохранит вашу компанию
- ✅ Отключит RLS

---

## 📋 ШАГ 2: Зарегистрируйтесь в CRM

1. Откройте: `http://localhost:3001/register`
2. Используйте **ваш email**: `office@pashkovsky-group.com`
3. Придумайте пароль (минимум 8 символов)
4. В поле **Company Name** введите **другое** имя (например: "Temp Company")
   - Это создаст временную компанию, которую мы удалим

---

## 📋 ШАГ 3: Подтвердите email

Supabase отправит письмо с подтверждением. Нажмите на ссылку.

---

## 📋 ШАГ 4: Свяжите auth user с вашей компанией

**В Supabase SQL Editor:**

1. Выполните первый запрос из `supabase/LINK_AUTH_USER.sql`:
```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;
```

2. Скопируйте ваш `id` (например: `abc123-456...`)

3. Выполните UPDATE (замените `YOUR_AUTH_USER_ID_HERE`):
```sql
UPDATE public.company_members
SET user_id = 'ВСТАВЬТЕ_ВАШ_ID_ЗДЕСЬ'
WHERE company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';
```

4. Проверьте результат:
```sql
SELECT cm.*, au.email, c.name 
FROM company_members cm
JOIN auth.users au ON au.id = cm.user_id
JOIN companies c ON c.id = cm.company_id
WHERE cm.company_id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';
```

Должно показать: **ваш email → Pashkovsky Group → owner**

---

## 📋 ШАГ 5: Удалите временную компанию

Если setup-company API создал дубликат:

```sql
-- Найдите временную компанию
SELECT id, name FROM companies ORDER BY created_at DESC;

-- Удалите её (НЕ Pashkovsky Group!)
DELETE FROM companies WHERE name = 'Temp Company';
```

---

## ✅ ГОТОВО!

Теперь войдите: `http://localhost:3001/login`

Вы увидите:
- ✅ Вашу оригинальную компанию **Pashkovsky Group**
- ✅ План **enterprise**
- ✅ Все существующие данные (deals, workers, leads)

---

## 🎯 Преимущества этого подхода:

| ✅ Сохранено | ❌ Без этого |
|--------------|--------------|
| Компания Pashkovsky Group | Пришлось бы создавать заново |
| План enterprise | Был бы trial |
| Все deals, workers, leads | Потеряны |
| Company settings | Потеряны |

---

**Начните с ШАГ 1: выполните `MIGRATION_KEEP_COMPANY.sql` в Supabase!** 🚀

