/**
 * lib/ — Migration Guide
 *
 * This file documents the Clean Architecture migration status of lib/.
 * All files in lib/ remain functional. New canonical import paths are
 * provided by platform/ and modules/ which re-export from lib/.
 *
 * ─────────────────────────────────────────────────────────────────────
 * STAYS IN lib/ (shared utilities — no domain-specific logic)
 * ─────────────────────────────────────────────────────────────────────
 *
 *   lib/supabase/          → stays (shared DB client)
 *   lib/translations/      → stays (shared i18n)
 *   lib/email/             → stays (shared email templates)
 *   lib/email.ts           → stays (shared email sender)
 *   lib/s3-upload.ts       → stays (shared S3 utility)
 *   lib/image-url.ts       → stays (shared image URL helpers)
 *   lib/image-url-client.ts → stays
 *   lib/image-props.ts     → stays
 *   lib/locales.ts         → stays
 *   lib/language-context.tsx → stays
 *   lib/admin-translations.ts → stays (used by useCRMTranslations)
 *   lib/whatsapp-send.ts   → stays (shared WhatsApp sender)
 *   lib/rate-limit.ts      → stays (shared rate limiter)
 *   lib/utils/             → stays (shared utilities)
 *   lib/media/             → stays
 *   lib/googleAds/         → stays
 *   lib/integrations/      → stays
 *   lib/pdf/create-browser.ts     → stays (shared PDF primitive)
 *   lib/pdf/font-loader.ts        → stays (shared PDF primitive)
 *   lib/pdf/font-utils.ts         → stays (shared PDF primitive)
 *   lib/pdf/render-html-to-pdf.ts → stays (shared PDF primitive)
 *   lib/profiles-api/      → stays (shared Profiles API client)
 *   lib/middleware/rate-limit.ts  → stays
 *
 * ─────────────────────────────────────────────────────────────────────
 * SUPERSEDED — new canonical path is in platform/ or modules/
 * (files remain for backward compat; new code uses new paths)
 * ─────────────────────────────────────────────────────────────────────
 *
 *   lib/auth/              → @/platform/auth
 *   lib/middleware/auth*.ts, superadmin-auth.ts → @/platform/auth
 *   lib/session/           → @/platform/auth
 *   lib/middleware/company-context.ts → @/platform/tenant
 *   lib/middleware/require-company-auth.ts → @/platform/tenant
 *   lib/middleware/integration-access.ts → @/platform/tenant
 *   lib/permissions/       → @/platform/permissions
 *   lib/middleware/permissions.ts → @/platform/permissions
 *   lib/billing/           → @/platform/billing
 *   lib/middleware/subscription.ts → @/platform/billing
 *   lib/services/subscription-service.ts → @/platform/billing
 *   lib/features/check.ts  → @/platform/billing
 *   lib/ai/                → @/platform/ai (+ @/modules/analytics for buildAnalyticsContext)
 *   lib/ai-chat/           → @/platform/ai
 *   lib/audit/             → @/platform/audit
 *   lib/leads/             → @/modules/leads
 *   lib/analytics/         → @/modules/analytics
 *   lib/calculations/      → @/modules/deals (pergola-area, suntuf-sheets)
 *   lib/workers/           → @/modules/workers
 *   lib/offers/            → @/modules/offers
 *   lib/api/               → @/modules/projects
 *   lib/types/gallery.ts   → @/modules/projects
 *   lib/offer-calculator.ts → @/modules/offers
 *   lib/offer-sharing.ts   → @/modules/offers
 *   lib/pdf/generate-offer-pdf.tsx → @/modules/offers
 *   lib/pdf/offer-html-template.ts → @/modules/offers
 *   lib/pdf/generate-order-pdf.tsx → (orders module, future)
 *   lib/pdf/order-html-template.ts → (orders module, future)
 *   lib/validation/public-lead.ts → @/modules/leads
 */

export {}
