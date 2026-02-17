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
- `JWT_SECRET` - Same JWT secret as CRM
- `PASHKOVSKY_COMPANY_ID` - Your company UUID (get from Supabase)

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
GET    /profiles                    # List profiles (public: active only)
GET    /profiles/with-stock          # List with stock info (admin only)
GET    /profiles/:id                 # Get single profile
POST   /profiles                     # Create profile (admin, Pashkovsky only)
PATCH  /profiles/:id                 # Update profile (admin)
DELETE /profiles/:id                 # Soft delete (admin)
```

### Other Modules (TODO)

- Batches: `/batches` - Supplier deliveries (Phase 2)
- Stock: `/stock` - Inventory management (Phase 2)
- Orders: `/orders` - Customer orders & pricing (Phase 3)
- Usage: `/usage` - Supplier billing tracking (Phase 4)
- Suppliers: `/suppliers` - Supplier management (Phase 4)

## 🔒 Authentication

Protected endpoints require JWT token in `Authorization` header:

```bash
Authorization: Bearer <your-jwt-token>
```

Get token from Supabase auth (same as CRM).

## 🏢 Multi-tenancy & Feature Flags

- **Company Isolation:** All data is isolated by `company_id` via RLS policies
- **Feature Access:** Profiles module is ONLY enabled for Pashkovsky Group (set via `PASHKOVSKY_COMPANY_ID`)
- Other companies will get `403 Forbidden` if they try to access profiles endpoints

## 🧪 Testing the API

### Create a profile (requires auth):

```bash
curl -X POST http://localhost:3002/profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
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
- ✅ Company-based feature flags
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

**Error: "Profiles module not enabled for your company"**
- Check `PASHKOVSKY_COMPANY_ID` matches your company UUID in database

**Error: "Authentication failed"**
- Verify JWT token is valid
- Check `JWT_SECRET` matches your CRM configuration

## 📚 Documentation

See `/Users/user/.cursor/skills-cursor/create-skill/BACKEND_SUMMARY.md` for complete backend architecture and implementation plan.
