# Как пользователь получает доступ к CRM

## Проблема
После создания компании через SuperAdmin, пользователь (`oryaron38@gmail.com`) не знает, как войти в CRM.

## Решение

### Вариант 1: Magic Link (Рекомендуется)
SuperAdmin может сгенерировать и отправить magic link пользователю.

#### Через Supabase Dashboard:
1. Откройте Supabase Dashboard
2. Перейдите в **Authentication** → **Users**
3. Найдите пользователя `oryaron38@gmail.com`
4. Нажмите на пользователя
5. Нажмите **Send magic link**
6. Укажите redirect URL: `https://crm.pashkovsky-group.com/app/admin`
7. Пользователь получит email с ссылкой для входа

#### Через API (для автоматизации):
```bash
# Создать magic link для пользователя
curl -X POST http://localhost:3001/api/superadmin/users/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "oryaron38@gmail.com",
    "redirectTo": "https://crm.pashkovsky-group.com/app/admin"
  }'
```

### Вариант 2: Установить пароль
SuperAdmin может установить временный пароль для пользователя.

#### Через Supabase Dashboard:
1. Откройте Supabase Dashboard
2. Перейдите в **Authentication** → **Users**
3. Найдите пользователя `oryaron38@gmail.com`
4. Нажмите на пользователя
5. Нажмите **Reset password**
6. Установите временный пароль (например: `TempPass123!`)
7. Отправьте пользователю:
   - Email: `oryaron38@gmail.com`
   - Временный пароль: `TempPass123!`
   - URL для входа: `https://crm.pashkovsky-group.com/login`

### Вариант 3: Password Reset Email
Пользователь может сам запросить сброс пароля.

1. Пользователь переходит на `https://crm.pashkovsky-group.com/login`
2. Нажимает **"Forgot password?"**
3. Вводит свой email: `oryaron38@gmail.com`
4. Получает email со ссылкой для сброса пароля
5. Устанавливает новый пароль
6. Входит в CRM

---

## Исправление подписки (сделать бессрочной)

### Проблема
Текущая подписка истекает через 14 дней:
```json
{
  "trial_ends_at": "2026-01-19T16:19:26.337641+00:00",
  "current_period_end": "2026-01-19T16:19:26.337641+00:00"
}
```

### Решение
Выполните SQL скрипт для исправления:

```bash
# Через Supabase SQL Editor
# Скопируйте и выполните содержимое файла:
cat fix-subscription-unlimited.sql
```

Или выполните напрямую:

```sql
UPDATE company_subscriptions
SET 
  trial_ends_at = NULL,
  current_period_end = NULL,
  next_billing_date = NULL,
  auto_renew = false,
  payment_provider = 'manual',
  status = 'active'
WHERE company_id = '82b7f5ca-50bd-4675-a62a-dc2e8f2849df';
```

После этого подписка станет **бессрочной** (unlimited).

---

## Автоматизация в будущем

Чтобы автоматизировать процесс, можно:

1. **Добавить чекбокс в форму onboarding:**
   - ☐ Send magic link to user
   - ☐ Set temporary password

2. **Создать API endpoint:**
   - `POST /api/superadmin/users/send-magic-link`
   - `POST /api/superadmin/users/set-password`

3. **Добавить в UI кнопки:**
   - "Send Login Link" - отправить magic link
   - "Set Password" - установить временный пароль
   - "Copy Login URL" - скопировать ссылку для входа

---

## Текущий статус

### Компания: oryaron38
- **Company ID:** `82b7f5ca-50bd-4675-a62a-dc2e8f2849df`
- **Owner Email:** `oryaron38@gmail.com`
- **Plan:** Enterprise
- **Status:** Active
- **Payment:** Manual (free)
- **Expiration:** ⚠️ 14 days (нужно исправить на unlimited)

### Что нужно сделать:
1. ✅ Исправить подписку (сделать бессрочной) - выполнить SQL скрипт
2. ⏳ Отправить пользователю способ входа (magic link или пароль)
3. ✅ Убедиться, что пользователь может войти в CRM

---

## Проверка доступа

После того, как пользователь получит доступ:

1. Пользователь переходит на `https://crm.pashkovsky-group.com/login`
2. Входит через magic link или пароль
3. Автоматически перенаправляется в `/app/admin`
4. Видит свою компанию: **oryaron38**
5. Имеет полный доступ (роль: owner)

---

## Полезные ссылки

- **CRM Login:** https://crm.pashkovsky-group.com/login
- **CRM Dashboard:** https://crm.pashkovsky-group.com/app/admin
- **SuperAdmin Panel:** https://crm.pashkovsky-group.com/superadmin/companies
- **Supabase Dashboard:** https://supabase.com/dashboard/project/YOUR_PROJECT_ID

