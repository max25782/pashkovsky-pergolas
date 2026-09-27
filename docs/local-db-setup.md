# Local Database Setup Runbook

Step 1 (baseline + archive) is done. Follow this to complete Steps 2 and 3.

## Prerequisites

Install Docker Desktop: https://docs.docker.com/desktop/install/mac-install/

Then install the Supabase CLI (already installed if you ran the agent):
```
brew install supabase/tap/supabase
```

Install pg tools for the data dump:
```
brew install postgresql@16
export PATH="/usr/local/opt/postgresql@16/bin:$PATH"
```

---

## Step 2 — Local database

### 2a. Init and start local Supabase

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/crm

# One-time init (creates supabase/config.toml if it doesn't exist)
supabase init --with-intellij-settings false

# Start Docker containers (first run downloads ~2 GB images)
supabase start
```

After `supabase start`, copy the output — you'll need the anon key and service_role key.

### 2b. Apply the baseline schema

```bash
# supabase start creates a local DB at postgres://postgres:postgres@127.0.0.1:54322/postgres
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f apps/crm/supabase/migrations/000_baseline.sql
```

### 2c. Dump prod data (schema-only already loaded — data only)

You need the database password from the Supabase dashboard:
Project Settings → Database → Database password

```bash
export PROD_DB_URL="postgresql://postgres.[PASSWORD]@db.kvqupacmdishpfnscnio.supabase.co:5432/postgres"

# Data-only dump (no schema, no ownership)
pg_dump "$PROD_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-table=supabase_migrations \
  -f /tmp/prod-data.sql
```

### 2d. Restore to local

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f /tmp/prod-data.sql
```

### 2e. Anonymize

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f apps/crm/scripts/anonymize-local-db.sql
```

The script prints a verification row — both columns should be 0.

### 2f. Configure .env.local

```bash
cp apps/crm/.env.local.example apps/crm/.env.local
# Edit apps/crm/.env.local:
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_ANON_KEY=<from supabase status>
#   SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
```

---

## Step 3 — Verification

### 3a. supabase status

```bash
supabase status
```

Expected output includes Studio URL, API URL, anon/service_role keys, DB URL.

### 3b. Lead and offer counts vs prod

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT 'leads' AS tbl, COUNT(*) FROM leads UNION ALL SELECT 'offers', COUNT(*) FROM offers UNION ALL SELECT 'deals', COUNT(*) FROM deals;"
```

Compare against prod (current as of 2026-09-27):
- leads: 4018
- offers: 171
- deals: 175

### 3c. Start CRM against local DB

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
npm run dev:crm
# or: cd apps/crm && npm run dev
```

Open http://localhost:3001 — check that the leads list shows ~4 000 rows.

### 3d. Create a quick-offer and download the PDF

Use the CRM form:
- Fill in customer name (required — cannot be empty)
- Draw a pergola plan
- Submit

Expected PDF:
- Customer name as entered
- Offer number: 2026-XXXX (counter is local, starts at 0001)
- Payment 20/80
- 30 working days
- Clauses 1–16

---

## After verification

Signal back with:
1. `supabase status` output
2. Lead / offer counts (local vs prod diff if any)
3. PDF from local DB

Then we proceed to writing the lead-migration SQL.
