# Subscription Management API

## 📋 Overview

RESTful API для управления подписками компаний.

**Architecture:**
- ✅ Service Layer Pattern (готово к NestJS)
- ✅ Thin Controllers
- ✅ Strong TypeScript typing
- ✅ Easy migration to NestJS Injectable services

---

## 🔌 API Endpoints

### 1. GET `/api/subscriptions/plans`

Получить список всех доступных планов.

**Auth:** Required (JWT)

**Response:**
```typescript
{
  plans: SubscriptionPlan[]
  current_plan_key?: string
}
```

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/subscriptions/plans
```

---

### 2. GET `/api/subscriptions/current`

Получить текущую подписку компании.

**Auth:** Required (JWT)

**Query Params:**
- `include_usage=true` - включить usage статистику

**Response:**
```typescript
{
  subscription: CompanySubscription
  plan: SubscriptionPlan
  usage?: SubscriptionUsage
}
```

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/subscriptions/current?include_usage=true"
```

---

### 3. POST `/api/subscriptions/change-plan`

Изменить план подписки.

**Auth:** Required (JWT + owner/admin role)

**Request Body:**
```typescript
{
  new_plan_key: string
  billing_cycle?: 'monthly' | 'yearly'
  reason?: string
}
```

**Response:**
```typescript
{
  success: boolean
  subscription: CompanySubscription
  message: string
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_plan_key": "pro", "billing_cycle": "monthly"}' \
  http://localhost:3001/api/subscriptions/change-plan
```

---

### 4. GET `/api/subscriptions/history`

Получить историю изменений подписки.

**Auth:** Required (JWT)

**Query Params:**
- `limit=50` - количество записей (default: 50)

**Response:**
```typescript
{
  history: (SubscriptionHistory & {
    old_plan?: SubscriptionPlan
    new_plan: SubscriptionPlan
  })[]
  total: number
}
```

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/subscriptions/history?limit=10"
```

---

### 5. GET `/api/subscriptions/usage`

Получить детальную статистику использования.

**Auth:** Required (JWT)

**Response:**
```typescript
{
  users: { current: number, limit: number, percentage: number }
  deals: { current: number, limit: number, percentage: number }
  storage: { current_gb: number, limit_gb: number, percentage: number }
  ai_requests: { current_month: number, limit: number, percentage: number }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/subscriptions/usage
```

---

## 🏗️ Service Layer

### SubscriptionService

Вся бизнес-логика в одном месте:

```typescript
import { subscriptionService } from '@/lib/services/subscription-service'

// Get all plans
const plans = await subscriptionService.getPlans()

// Get current plan
const plan = await subscriptionService.getCurrentPlan(company_id)

// Get usage
const usage = await subscriptionService.getUsage(company_id)

// Change plan
const subscription = await subscriptionService.changePlan(
  company_id,
  user_id,
  { new_plan_key: 'pro', billing_cycle: 'monthly' }
)

// Check limits
const result = await subscriptionService.canPerformAction(
  company_id,
  'add_user'
)
```

---

## 🚀 Migration to NestJS

### Current Structure:
```
lib/services/subscription-service.ts  → Service (singleton)
app/api/subscriptions/*/route.ts     → Controller (thin)
types/subscription.ts                 → DTOs/Types
```

### NestJS Structure (future):
```typescript
// subscription.service.ts
@Injectable()
export class SubscriptionService { /* same code */ }

// subscription.controller.ts
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService
  ) {}
  
  @Get('plans')
  async getPlans() {
    return this.subscriptionService.getPlans()
  }
}

// subscription.dto.ts
export class ChangePlanDto { /* same types */ }
```

**Minimal changes needed! 🎯**

---

## 🧪 Testing

### Test with curl:

```bash
# 1. Get plans
curl http://localhost:3001/api/subscriptions/plans

# 2. Get current subscription
curl http://localhost:3001/api/subscriptions/current?include_usage=true

# 3. Change plan (SuperAdmin only for now)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"new_plan_key": "pro"}' \
  http://localhost:3001/api/subscriptions/change-plan

# 4. Get history
curl http://localhost:3001/api/subscriptions/history

# 5. Get usage
curl http://localhost:3001/api/subscriptions/usage
```

---

## 📝 Next Steps

1. ✅ **API Routes** - DONE
2. ⏳ **SuperAdmin Panel** - для ручного управления
3. ⏳ **Settings Page** - для users
4. ⏳ **Payment Integration** - Stripe/Bit/Paybox
5. ⏳ **Webhooks** - для автоматизации

---

## 🔐 Security

- ✅ JWT Authentication required
- ✅ Company isolation (RLS ready)
- ✅ Permission checks (owner/admin)
- ✅ Rate limiting ready
- ✅ Input validation

---

## 📊 Data Flow

```
User Request
    ↓
API Route (thin controller)
    ↓
SubscriptionService (business logic)
    ↓
Supabase (database)
    ↓
Response
```

Easy to add:
- Caching (Redis)
- Message Queue (RabbitMQ)
- Event Bus (NestJS EventEmitter)

