# Subscription Debugging Guide

## Проблема
Подписка не отображается на странице деталей компании в SuperAdmin панели.

## Что было сделано

### 1. Исправлен запрос к базе данных
**Было:**
```typescript
const { data: subscription } = await supabaseAdmin
  .from('company_subscriptions')
  .select('...')
  .eq('company_id', companyId)
  .single() // ❌ Выдает ошибку если записи нет
```

**Стало:**
```typescript
const { data: subscriptionData, error: subError } = await supabaseAdmin
  .from('company_subscriptions')
  .select('...')
  .eq('company_id', companyId)
  .limit(1) // ✅ Возвращает пустой массив если записи нет

const subscription = subscriptionData?.[0] || null
```

### 2. Добавлено логирование
Теперь в консоли сервера будут видны:
- Результаты запросов к БД
- Ошибки при получении данных
- Количество найденных записей

### 3. Улучшено отображение подписки
- Цветные бейджи для разных типов планов (enterprise = фиолетовый, trial = желтый)
- Показ payment_provider с цветовой индикацией
- Отображение периода подписки (если есть)
- ID подписки для отладки

### 4. Создан API endpoint для отладки
**Endpoint:** `GET /api/superadmin/companies/[id]/subscription`

Возвращает:
```json
{
  "success": true,
  "subscription": { ... },
  "history": [ ... ],
  "debug": {
    "companyId": "...",
    "subscriptionFound": true,
    "historyCount": 2
  }
}
```

## Как проверить подписку

### Через браузер
1. Откройте DevTools (F12)
2. Перейдите на вкладку Console
3. Обновите страницу деталей компании
4. Найдите логи с префиксом `[CompanyDetails]`

### Через API
```bash
# Замените COMPANY_ID на ID вашей компании
curl http://localhost:3001/api/superadmin/companies/COMPANY_ID/subscription | jq '.'
```

Или используйте созданный скрипт:
```bash
/tmp/check-subscription.sh 82b7f5ca-50bd-4675-a62a-dc2e8f2849df
```

### Через Supabase SQL Editor
```sql
-- Проверить подписки для компании
SELECT 
  cs.*,
  sp.plan_key,
  sp.name as plan_name
FROM company_subscriptions cs
LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
WHERE cs.company_id = '82b7f5ca-50bd-4675-a62a-dc2e8f2849df';

-- Проверить историю подписок
SELECT 
  sh.*,
  sp.plan_key,
  sp.name as plan_name
FROM subscription_history sh
LEFT JOIN subscription_plans sp ON sh.new_plan_id = sp.id
WHERE sh.company_id = '82b7f5ca-50bd-4675-a62a-dc2e8f2849df'
ORDER BY sh.changed_at DESC;
```

## Возможные причины проблемы

1. **Подписка не была создана**
   - Проверьте логи при создании компании
   - Убедитесь, что функция `grantEnterpriseAccess()` выполнилась успешно

2. **Проблема с foreign key**
   - `plan_id` не соответствует существующему плану
   - Проверьте таблицу `subscription_plans`

3. **RLS политики блокируют доступ**
   - Используем SERVICE_ROLE_KEY, который обходит RLS
   - Но стоит проверить политики на таблице `company_subscriptions`

4. **Триггер создает trial вместо enterprise**
   - Триггер `create_default_subscription()` создает trial подписку
   - Наш код должен обновить её на enterprise
   - Проверьте, что обновление выполняется

## Следующие шаги

1. **Обновите страницу в браузере** и проверьте логи в консоли
2. **Вызовите API endpoint** для проверки данных
3. **Проверьте БД напрямую** через Supabase SQL Editor
4. Если подписка есть в БД, но не отображается - проверьте структуру данных в логах
5. Если подписки нет в БД - проблема в процессе создания компании

## Файлы, которые были изменены

- `apps/crm/app/superadmin/companies/[id]/page.tsx` - добавлено логирование и улучшено отображение
- `apps/crm/app/api/superadmin/companies/[id]/subscription/route.ts` - новый API endpoint для отладки
- `apps/crm/lib/services/company-onboarding-service.ts` - логика создания подписки




