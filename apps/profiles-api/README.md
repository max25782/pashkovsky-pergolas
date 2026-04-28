# Profiles API - Aluminum Profiles E-Commerce Backend

NestJS API for managing aluminum profiles inventory, orders, and supplier billing.

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd apps/profiles-api
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
- `JWT_SECRET` - Same JWT secret as CRM (optional if you only use Supabase JWT validation via `getUser`)

### 3. Apply Database Migration

**⚠️ IMPORTANT:** Before running the API, you must apply the database migration:

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `apps/crm/supabase/migrations/018_create_profiles_system.sql`
3. Paste and run in SQL Editor
4. Verify 7 tables were created

### 4. Run the API

**Development mode:**
```bash
npm run start:dev
```

**Production mode:**
```bash
npm run build
npm run start:prod
```

API will be available at: `http://localhost:3002`

## 📋 API Endpoints

### Profiles (Catalog Management)

```
GET    /profiles?company_id=&read_token=   # List active profiles (storefront; read_token if company requires it)
GET    /profiles/with-stock                 # List with stock info (admin JWT + X-Company-Id)
GET    /profiles/:id?company_id=&read_token=
POST   /profiles                            # Create (JWT + X-Company-Id or matching company_id query)
PATCH  /profiles/:id
DELETE /profiles/:id
```

### Other Modules (TODO)

- Batches: `/batches` - Supplier deliveries (Phase 2)
- Stock: `/stock` - Inventory management (Phase 2)
- Orders: `/orders` - Customer orders & pricing (Phase 3)
- Usage: `/usage` - Supplier billing tracking (Phase 4)
- Suppliers: `/suppliers` - Supplier management (Phase 4)

## Authentication

Protected endpoints require a Supabase JWT:

```bash
Authorization: Bearer <your-jwt-token>
X-Company-Id: <active-company-uuid>   # recommended when the user has multiple company_members rows
```

Get the token from Supabase auth (same as CRM).

## Multi-tenancy

- **Data:** Catalog and orders are scoped by `company_id` on each row.
- **Authenticated users:** Resolved tenant = `X-Company-Id` header if the user is a member of that company, else `company_id` query if they are a member, else their newest `company_members` row. CRM and admin clients should send **`X-Company-Id`** together with the Bearer token when a user belongs to multiple companies.
- **Anonymous storefront:** `GET /profiles`, `GET /profiles/:id`, and `POST /orders` require `company_id`. If `companies.settings.profiles_store_public_token` is set (non-empty string), the same value must be passed as query param **`read_token`**. If unset, anonymous reads remain open for that company (legacy).

## 🧪 Testing the API

### Create a profile (requires auth):

```bash
curl -X POST http://localhost:3002/profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -H "X-Company-Id: <company-uuid>" \
  -d '{
    "code": "F5020",
    "name_he": "פרופיל פרגולה",
    "name_ru": "Профиль для перголы",
    "name_en": "Pergola Profile",
    "dimensions": "50x20mm",
    "weight_per_meter": 0.85,
    "available_lengths": [6.0, 6.5, 7.0, 8.0],
    "category": "pergulas",
    "price_per_kg": 120,
    "is_active": true
  }'
```

### List profiles (public):

```bash
curl http://localhost:3002/profiles?company_id=<your-company-id>
```

## 📁 Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── config/
│   └── supabase.config.ts  # Supabase client setup
├── common/
│   ├── guards/
│   │   ├── auth.guard.ts   # JWT authentication
│   │   └── company.guard.ts # Company access control
│   └── decorators/
│       └── current-user.decorator.ts
├── profiles/               # ✅ IMPLEMENTED (Phase 1)
│   ├── profiles.module.ts
│   ├── profiles.controller.ts
│   ├── profiles.service.ts
│   └── dto/
├── batches/                # TODO: Phase 2
├── stock/                  # TODO: Phase 2
├── orders/                 # TODO: Phase 3
├── usage/                  # TODO: Phase 4
├── suppliers/              # TODO: Phase 4
└── webhooks/               # TODO: Phase 4
```

## ✅ Phase 1 Complete!

**What's Done:**
- ✅ Database migration created (7 tables)
- ✅ NestJS app structure
- ✅ Supabase integration
- ✅ Authentication & authorization guards
- ✅ Multi-tenant company resolution (`X-Company-Id` / membership)
- ✅ Profiles module CRUD (fully implemented)

**Next Steps:**
1. Apply database migration in Supabase
2. Set up `.env` file
3. Run `npm install && npm run start:dev`
4. Test profiles endpoints
5. Move to Phase 2 (Batches & Stock modules)

## 🐛 Troubleshooting

**Error: "Missing Supabase environment variables"**
- Make sure `.env` file exists and has correct values

**Error: "User must be authenticated with a company membership"**
- Ensure the user has a row in `company_members` and send `X-Company-Id` when they belong to more than one company.

**Error: "Invalid or missing read_token for storefront access"**
- Set `companies.settings.profiles_store_public_token` to empty to allow open reads, or pass the same token as `read_token` on anonymous requests.

**Error: "Authentication failed"**
- Verify JWT token is valid
- Check `JWT_SECRET` matches your CRM configuration

## 📚 Documentation

See `/Users/user/.cursor/skills-cursor/create-skill/BACKEND_SUMMARY.md` for complete backend architecture and implementation plan.
