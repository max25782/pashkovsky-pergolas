# 3D configurator in CRM

## Staff workflow

- Managers edit the pergola in **CRM** (embedded WebGL), not via an iframe to the marketing site.
- Saving from the 3D UI calls `POST /api/offers/[id]/configurator-save` with the CRM session (no customer token required for staff).
- The same merge and pricing logic as the site sync path runs server-side (`applyConfiguratorSyncToOffer`).

## Customer links

- `configurator_link_tokens` and minted URLs are still used for **read-only / optional edit links** you send to the customer (`view=1` for view-only).
- When an offer already has `configurator_meta.editUrl` and `viewUrl`, CRM save **reuses** them and updates prefill on the latest token row instead of minting every time.

## Environment

- **Profiles:** Keep `apps/crm/public/data/profiles.json` in sync with `apps/site/public/data/profiles.json` (copy when marketing updates catalog). The embed loads **`GET /api/configurator/profiles`**, which reads that file first so the **browser never requests `:3000`** (no CORS). If the file is missing, the handler falls back to `NEXT_PUBLIC_SITE_URL`.
- **Prefill:** **`GET /api/configurator/prefill?ct=…`** queries Supabase directly (same as the site route), so the marketing app does not need to run for token prefill.
- **`NEXT_PUBLIC_SITE_URL`** is still used for customer-facing pergola links (`configurator-link`, minted URLs), not for profiles in the normal case.

- **Site (optional CORS):** If something else loads the site from another origin, set `CONFIGURATOR_CORS_ORIGINS` on the marketing app (comma-separated). Defaults to `http://localhost:3001` when unset.
