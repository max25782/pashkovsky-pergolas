# AI Director (Bedrock) - Премиум функция

## ✅ Что сделано

AI Director (Bedrock) теперь доступен **только для платных планов**:
- ✅ **Pro** план - имеет доступ
- ✅ **Enterprise** план - имеет доступ
- ❌ **Trial** план - нет доступа
- ❌ **Basic** план - нет доступа

## 🔒 Как работает ограничение доступа

### 1. Проверка подписки в API
- Файл: `apps/crm/lib/middleware/ai-director-subscription.ts`
- Проверяет план компании перед каждым запросом к AI Director
- Возвращает ошибку 403 с сообщением об апгрейде для неплатных планов

### 2. Обновленный endpoint
- Файл: `apps/crm/app/api/ai-director/chat/route.ts`
- Добавлена проверка `checkAIDirectorAccess()` перед вызовом Bedrock

### 3. UI сообщения
- Файл: `apps/crm/app/app/admin/ai-director/page.tsx`
- Показывает понятное сообщение об апгрейде при ошибке 403

### 4. Обновление планов в БД
- Миграция: `supabase/migrations/029_add_ai_director_to_pro_plans.sql`
- Добавляет "AI Director (Bedrock)" в features планов Pro и Enterprise

## 📋 Что нужно сделать

### 1. Применить миграцию БД
```bash
# В Supabase Dashboard или через CLI
psql -f supabase/migrations/029_add_ai_director_to_pro_plans.sql
```

Или выполните SQL вручную:
```sql
UPDATE public.subscription_plans
SET 
  features = features || '["AI Director (Bedrock)"]'::jsonb
WHERE plan_key IN ('pro', 'enterprise');
```

### 2. Проверить работу
1. Создайте тестовую компанию с планом **Trial** или **Basic**
2. Попробуйте открыть `/app/admin/ai-director`
3. Попробуйте отправить сообщение
4. Должно появиться сообщение: "AI Director доступен только для планов Pro и Enterprise"

### 3. Для платных компаний
- Компании с планом **Pro** или **Enterprise** имеют полный доступ
- Никаких изменений в их работе не требуется

## 💰 Монетизация

Теперь AI Director можно использовать как:
- **Премиум фичу** для привлечения клиентов на платные планы
- **Upsell** для компаний на Trial/Basic планах
- **Дополнительную ценность** для Pro/Enterprise подписок

## 🔍 Технические детали

### Разрешенные планы
```typescript
const AI_DIRECTOR_ALLOWED_PLANS = ['pro', 'enterprise']
```

### Сообщения об ошибке
- **403 Forbidden** - план не поддерживает AI Director
- В ответе: `upgrade_required: true`, `current_plan`, `allowed_plans`

### Проверка подписки
- Проверяет `company_subscriptions.status = 'active'`
- Проверяет `subscription_plans.plan_key IN ('pro', 'enterprise')`
- Возвращает понятное сообщение на русском языке

## 📝 Пример ответа при отсутствии доступа

```json
{
  "error": "AI Director недоступен",
  "message": "AI Director доступен только для планов Pro и Enterprise. Ваш текущий план: trial",
  "upgrade_required": true,
  "current_plan": "trial",
  "allowed_plans": ["pro", "enterprise"]
}
```




