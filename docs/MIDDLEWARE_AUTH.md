# 🔒 Middleware Authentication & Company Selection

## 🎯 Обзор

Middleware защищает все маршруты `/app/**` и требует:
1. ✅ **Аутентификацию** (JWT token)
2. ✅ **Выбор компании** (company_id в токене)

---

## 🛡️ Защищенные маршруты

### `/app/**` - CRM Routes
- **Требуется:** JWT token в cookie/header
- **Требуется:** `company_id` в JWT payload
- **Редирект без auth:** `/login?redirect=/app/...`
- **Редирект без company:** `/app/select-company?redirect=/app/...`

### Исключения:
- `/app/select-company` - доступен без company_id (только auth)

---

## 🔑 JWT Structure

```typescript
{
  sub: "user-uuid",           // User ID
  user_id: "user-uuid",       // User ID (duplicate for compatibility)
  company_id: "company-uuid", // Selected company
  role: "admin",              // User role in company
  iat: 1234567890,           // Issued at
  exp: 1234567890            // Expires at
}
```

---

## 📝 Публичные маршруты

Не требуют аутентификации:
- `/login`
- `/register`
- `/reset-password`
- `/verify-email`
- `/{locale}/**` - все публичные страницы с локалью (`/he`, `/ru`, `/en`)

---

## 🏢 Company Selection Flow

### 1. User logs in → получает JWT **без** company_id

```typescript
// POST /api/auth/login
{
  token: "eyJhbGc...",  // JWT без company_id
  user: { ... }
}
```

### 2. Redirect на `/app/select-company`

Пользователь видит список компаний, где он member.

### 3. User выбирает компанию

```typescript
// POST /api/auth/select-company
{
  company_id: "company-uuid"
}

// Response:
{
  token: "eyJhbGc...",  // NEW JWT с company_id
  company_id: "company-uuid"
}
```

### 4. Redirect на оригинальный URL

Пользователь попадает в CRM с выбранной компанией.

---

## 🔐 Security Features

### ✅ Token Validation
- Проверяет JWT signature
- Проверяет expiration
- Извлекает `user_id` и `company_id`

### ✅ Company Membership Validation
- `/api/auth/select-company` проверяет, что user действительно member компании
- Запрещает выбор компании, к которой user не принадлежит

### ❌ NO query params validation
- company_id **только** из JWT payload
- **НЕТ** логики `?companyId=...` без валидации

### ✅ Headers для API
Middleware добавляет headers для downstream API:
```typescript
'x-company-id': auth.companyId
'x-user-id': auth.userId
```

---

## 📡 API Endpoints

### GET `/api/auth/companies`
Возвращает список компаний пользователя:
```typescript
{
  companies: [
    {
      id: "company-uuid",
      name: "Pashkovsky Group",
      role: "admin"
    }
  ]
}
```

### POST `/api/auth/select-company`
Выбор компании и получение нового JWT:
```typescript
// Request:
{
  company_id: "company-uuid"
}

// Response:
{
  token: "new-jwt-with-company",
  refreshToken: "...",
  company_id: "company-uuid"
}
```

---

## 🔄 Subdomain Support

### `crm.domain.com` or `admin.domain.com`
- Автоматический redirect на `/app/admin`
- Те же правила защиты

---

## 🎨 UI Flow

```
Login Page (/login)
    ↓
User enters credentials
    ↓
JWT token saved (no company_id)
    ↓
Redirect to /app/admin
    ↓
Middleware: No company_id → redirect to /app/select-company
    ↓
Select Company Page
    ↓
User clicks on company
    ↓
New JWT with company_id
    ↓
Redirect to /app/admin
    ↓
✅ Access granted!
```

---

## 🛠️ Environment Variables

```env
JWT_SECRET=your-secret-key-change-in-production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## 📝 Migration Notes

### From Admin Token to JWT
- **Old:** `localStorage.getItem('admin_token')`
- **New:** Cookie-based JWT or `localStorage.getItem('token')`

### Backward Compatibility
- Admin token pages still check `localStorage.getItem('admin_token')`
- Middleware only checks JWT
- Gradually migrate pages to use JWT

---

## ✅ Testing

### Test Protected Routes
```bash
# Without token → redirect to /login
curl http://localhost:3000/app/admin

# With token but no company → redirect to /app/select-company
curl -H "Authorization: Bearer <token-without-company>" http://localhost:3000/app/admin

# With token and company → 200 OK
curl -H "Authorization: Bearer <token-with-company>" http://localhost:3000/app/admin
```

---

## 📚 Related Files

- `middleware.ts` - Main protection logic
- `app/(crm)/app/select-company/page.tsx` - Company selection UI
- `app/api/auth/companies/route.ts` - List companies
- `app/api/auth/select-company/route.ts` - Select company & get new JWT
- `lib/middleware/company-context.ts` - Extract company from request

---

## 🚀 Next Steps

1. ✅ Middleware protection implemented
2. ✅ Company selection page created
3. ✅ API endpoints for company management
4. 🔄 Update login flow to include company selection
5. 🔄 Migrate admin token pages to JWT
6. 🔄 Add company switcher in CRM UI

