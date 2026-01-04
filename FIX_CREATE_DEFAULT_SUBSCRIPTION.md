# 🔧 СРОЧНОЕ ИСПРАВЛЕНИЕ: Функция create_default_subscription

## Проблема

При создании новой компании возникает ошибка:
```
ERROR: 42703: column "name" does not exist
QUERY: SELECT id FROM subscription_plans WHERE name = 'free' LIMIT 1
CONTEXT: PL/pgSQL function create_default_subscription() line 6
```

## Причина

Функция `create_default_subscription()` из миграции `015_add_subscription_plans.sql` использует колонку `name` в таблице `subscription_plans`, но:
- В миграции `024_subscription_management.sql` таблица пересоздана
- Новая структура использует `plan_key` вместо `name`
- Старая функция не обновлена

## Решение

Создана новая миграция `031_fix_create_default_subscription.sql` которая:
1. Исправляет SQL запрос: `WHERE name = 'free'` → `WHERE plan_key = 'trial'`
2. Обновляет логику создания subscription для новых компаний
3. Использует правильную структуру из `024_subscription_management.sql`

## Как применить

### Вариант 1: Через Supabase Studio (рекомендуется)

1. Открой **Supabase Studio** → твой проект
2. Перейди в **SQL Editor**
3. Скопируй и выполни:

```sql
-- Fix create_default_subscription function
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_trial_plan_id uuid;
BEGIN
  -- Get trial plan ID (use plan_key instead of name)
  SELECT id INTO v_trial_plan_id
  FROM subscription_plans
  WHERE plan_key = 'trial'
  LIMIT 1;
  
  -- Only create subscription if trial plan exists
  IF v_trial_plan_id IS NOT NULL THEN
    -- Create subscription (14 days trial)
    -- Note: billing_cycle is omitted (nullable) since constraint only allows 'monthly' or 'yearly'
    INSERT INTO company_subscriptions (
      company_id, 
      plan_id,
      status,
      payment_provider,
      trial_ends_at,
      current_period_end
    ) VALUES (
      NEW.id,
      v_trial_plan_id,
      'trialing',
      'manual',
      now() + interval '14 days',
      now() + interval '14 days'
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

4. Нажми **Run**

### Вариант 2: Через Supabase CLI

\`\`\`bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
npx supabase db push
\`\`\`

## Проверка

После применения попробуй снова создать компанию:
1. Открой `http://localhost:3001/superadmin/companies`
2. Введи `oryaron38@gmail.com`
3. Нажми "Create Company + Give Full Access"

Должно работать! ✅

## Что это исправит

- ✅ Создание новых компаний через SuperAdmin онбординг
- ✅ Автоматическое создание trial subscription
- ✅ Совместимость с новой структурой subscription_plans

---

**Статус**: Миграция создана, ждет применения в Supabase
**Файл**: `supabase/migrations/031_fix_create_default_subscription.sql`

