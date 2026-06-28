# Pashkovsky Group — Monorepo

Full-stack platform for **Pashkovsky Group**, an Israeli aluminum construction company specialising in pergolas, railings, fences, wall cladding, and custom windows. The repository includes a public marketing site, a multi-tenant SaaS CRM, an e-commerce storefront for aluminum profiles, and a SaaS landing page — all orchestrated with Turborepo.

---

## Repository Structure

```
pashkovsky-monorepo/
├── apps/
│   ├── site/              Public website (pashkovsky-group.com)
│   ├── crm/               Multi-tenant SaaS CRM (AluminCRM)
│   ├── landing/           AluminCRM marketing landing (alumincrm.com)
│   ├── profiles-api/      NestJS REST API for aluminum profiles catalog
│   └── profiles-store/    E-commerce storefront for aluminum profiles
├── packages/
│   ├── pergola-configurator/  Shared 3D pergola editor (Three.js / R3F)
│   └── shared-types/          Shared TypeScript interfaces (API contracts)
├── infrastructure/        AWS CDK stack (profiles-api on ECS/Fargate)
├── supabase/              PostgreSQL migrations (Supabase)
├── scripts/               Gallery generation, i18n, video poster utilities
├── mcp-servers/           Amazon Bedrock MCP server for Cursor IDE
└── bedrock-schemas/       Bedrock agent action schemas
```

---

## Applications

### `apps/site` — Public Website

**Port:** 3000 | **Domain:** pashkovsky-group.com

The customer-facing website for Pashkovsky Group. Built with Next.js 14 App Router.

**Pages and features:**
- Portfolio of completed projects (pergolas, railings, fences, cladding)
- Interactive 3D pergola configurator (shared `@pashkovsky/pergola-configurator` package)
- S3-backed image catalog with PDF export (Puppeteer)
- Multi-locale support: Hebrew (default), Russian, English
- Contact and lead capture forms — submitted to the CRM via the public leads API
- Cloudflare Turnstile CAPTCHA on public forms
- Rate limiting via Upstash Redis

**Required environment variables:**
```env
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=
NEXT_PUBLIC_AWS_S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
NEXT_PUBLIC_CRM_API_URL=
CRM_SITE_TOKEN=
NEXT_PUBLIC_SITE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

---

### `apps/crm` — AluminCRM

**Port:** 3001 | **Domain:** crm.pashkovsky-group.com

Multi-tenant SaaS CRM built for aluminum and pergola construction companies. Each company is fully isolated via Supabase Row Level Security.

**Key modules:**
| Module | Description |
|--------|-------------|
| Leads | Incoming lead kanban with scoring, status tracking, and import (Facebook, Excel, Zapier) |
| Deals | Sales pipeline with profit, materials, payment stages, and installation tracking |
| Offers | PDF quote generation with branded templates, WhatsApp sharing |
| Workers | Team management, shifts, payroll |
| Material Orders | Procurement linked to deals |
| Gallery / Media | S3-backed file management |
| 3D Configurator | Staff-side pergola designer — saves directly to offers |
| AI Director | AWS Bedrock-powered business assistant (deal analysis, reports, insights) |
| Statistics | Weekly/monthly analytics reports with AI summaries |
| Subscriptions | Trial, plan management, billing |
| SuperAdmin | Platform-wide company management, audit logs, manual onboarding |

**Authentication:** Supabase Auth (email/password + Google OAuth), JWT middleware, role-based permissions (owner / admin / manager / viewer)

**Integrations:**
- WhatsApp (offer sharing, webhooks)
- Facebook Lead Ads (webhook import)
- Zapier (webhook leads)
- Google Ads (offline conversion tracking)
- AWS Bedrock (AI Director agent)
- Gemini API (AI text improvement, weekly reports)
- Resend / Nodemailer (transactional email)
- Cloudflare Turnstile (CAPTCHA)
- Upstash Redis (distributed rate limiting)

**Required environment variables:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=

# Auth
JWT_SECRET=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
NEXT_PUBLIC_AWS_S3_BUCKET_NAME=
NEXT_PUBLIC_AWS_S3_REGION=

# AI
BEDROCK_AGENT_ID=
BEDROCK_AGENT_ALIAS_ID=
AI_DIRECTOR_API_TOKEN=
GEMINI_API_KEY=

# Integrations
CRM_SITE_TOKEN=
DEFAULT_COMPANY_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
ZAPIER_LEADS_SECRET=
FB_LEADS_COMPANY_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=

# Rate limiting / CAPTCHA
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TURNSTILE_SECRET_KEY=

# Cron
CRON_SECRET_TOKEN=
```

---

### `apps/landing` — AluminCRM Marketing

**Port:** 4004 | **Domain:** alumincrm.com

SaaS marketing page for AluminCRM. Next.js 15 + next-intl. Locales: Hebrew, Russian, English, Serbian. Features, pricing, screenshots, and free trial CTA linking to the CRM registration page.

---

### `apps/profiles-api` — Aluminum Profiles API

**Port:** 3002

NestJS REST API for the aluminum profiles catalog. Multi-tenant via `X-Company-Id` header and Supabase JWT authentication. Deployable to AWS ECS/Fargate via the CDK stack in `/infrastructure`.

---

### `apps/profiles-store` — Profiles Storefront

**Port:** 3003

Next.js e-commerce frontend for aluminum profiles. Cart managed with Zustand (localStorage persistence). Locales: Hebrew, Russian, English. Talks to the profiles-api.

---

## Shared Packages

### `@pashkovsky/pergola-configurator`

Shared 3D pergola editor used on both the public site (customer-facing) and inside the CRM (staff-facing). Built with Three.js and React Three Fiber.

Features: pergola shapes, aluminum profiles, post/beam/lamella configuration, colors (RAL), LED beam options, hanging pergola types, dimension controls.

### `@pashkovsky/shared-types`

TypeScript interfaces shared between site and CRM: `PublicLeadPayload`, order types, profile catalog types.

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Build system | Turborepo + npm workspaces |
| Frontend framework | Next.js 14 / 15, React 18 |
| Language | TypeScript |
| Backend (profiles) | NestJS 10 |
| Styling | Tailwind CSS |
| State management | Zustand (store), MobX (site/crm) |
| 3D rendering | Three.js, React Three Fiber |
| Database | Supabase (PostgreSQL) with RLS |
| Auth | Supabase Auth, JWT (jose) |
| File storage | AWS S3 |
| AI | AWS Bedrock (agent), Gemini API |
| Rate limiting | Upstash Redis |
| CAPTCHA | Cloudflare Turnstile |
| PDF | @react-pdf/renderer, Puppeteer, pdf-lib |
| Email | Resend, Nodemailer |
| Animations | Framer Motion |
| Deployment | Vercel (Next.js apps), AWS ECS/Fargate (profiles-api) |
| Infrastructure | AWS CDK |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Run all apps in development

```bash
npm run dev
```

### Run a specific app

```bash
npm run dev:site       # Site only (port 3000)
npm run dev:crm        # CRM only (port 3001)
npm run dev:landing    # Landing (port 4004)
npm run dev:profiles   # profiles-api + profiles-store (ports 3002 + 3003)
```

### Build

```bash
npm run build          # All apps
npm run build:site
npm run build:crm
npm run build:landing
```

### Tests

```bash
cd apps/crm
npm test
npm run test:coverage
```

---

## Database Migrations

Migrations are in `/supabase/migrations/` and applied via the Supabase CLI.

```bash
supabase db push          # Apply all pending migrations
supabase migration new    # Create a new migration
```

Major migration groups:
- `001–020` — Core schema (companies, users, deals, leads, offers, RLS policies)
- `021–030` — Subscriptions, audit logs, AI Director sessions, platform admin
- `031–043` — Google Ads tracking, configurator offers, lead statuses, early bird program
- `044` — Company registration source tracking (UTM, referrer)

---

## Deployment

### Vercel (Next.js apps)

Each Next.js app is deployed as a separate Vercel project pointing to the monorepo root.

**Example — CRM:**
- Root Directory: `apps/crm`
- Build Command: `cd ../.. && npx turbo run build --filter=@alumincrm/app`
- Output Directory: `apps/crm/.next`
- Install Command: `cd ../.. && npm install`

Set all required environment variables in each Vercel project dashboard.

### AWS (profiles-api)

```bash
cd infrastructure
npm run deploy:profiles-api
```

Deploys `ProfilesApiStack` — NestJS on ECS/Fargate behind an Application Load Balancer.

---

## Architecture Overview

```
Customer browser
    |
    |-- pashkovsky-group.com (apps/site)
    |       |-- 3D configurator
    |       |-- Lead forms
    |       |   |-- POST /api/public/leads --> CRM
    |       |-- Catalog + PDF (S3 + Puppeteer)
    |
    |-- crm.pashkovsky-group.com (apps/crm)
    |       |-- Supabase Auth (email + Google OAuth)
    |       |-- Multi-tenant RLS (company isolation)
    |       |-- WhatsApp / Facebook / Zapier webhooks
    |       |-- AI Director (AWS Bedrock agent)
    |       |-- PDF offers (@react-pdf / Puppeteer)
    |       |-- Supabase PostgreSQL
    |
    |-- profiles storefront (apps/profiles-store)
            |-- Cart, catalog, checkout
            |-- profiles-api (NestJS on AWS ECS)
```

---

## Contributing

1. Create a feature branch from `main`
2. Make changes and ensure `npm run lint` passes with no errors
3. Test locally across all affected apps
4. Submit a pull request — do not push directly to `main`

---

## License

Private — all rights reserved. Pashkovsky Group.
