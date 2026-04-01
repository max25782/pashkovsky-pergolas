# 📄 Pashkovsky Group - Public Site

Публичный сайт компании Pashkovsky Group.

## 🚀 Запуск

```bash
# Из root директории монорепо
npm run dev:site

# Или из apps/site
npm run dev
```

Откроется на `http://localhost:3000`

## 📦 Что включает

- Главная страница
- Портфолио проектов (перголы, заборы, окна)
- Блог и статьи
- Страница контактов
- 3D конфигуратор пергол

## 🔗 API

Отправляет лиды в CRM через:
```
POST https://crm.pashkovsky-group.com/api/public/leads
```

## 🛠️ Технологии

- Next.js 14
- React 18
- TailwindCSS
- Framer Motion
- AWS S3 (изображения)

## Environment variables

Shared AWS/S3 keys are used for galleries and for the **catalog** presigned URLs.

**Catalog + `/api/catalog` + `/api/catalog/pdf`:**

| Variable | Purpose |
|----------|---------|
| `AWS_S3_BUCKET_NAME` or `NEXT_PUBLIC_AWS_S3_BUCKET_NAME` | S3 bucket (list + presigned GET) |
| `AWS_S3_REGION` or `NEXT_PUBLIC_AWS_S3_REGION` | Bucket region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | List objects + sign GET URLs |
| `CATALOG_S3_PREFIX` | Root prefix for listing (default `images` → `images/`) |
| `CATALOG_S3_MAX_KEYS` | Max objects scanned (default `15000`, cap `50000`) |
| `CATALOG_S3_EXCLUDE_FOLDERS` | Comma-separated first-level folder names to skip (default `logos`) |
| `NEXT_PUBLIC_SITE_URL` | **Required for PDF in dev** (e.g. `http://localhost:3000`); also used when `VERCEL_URL` is unset |

**Path → catalog section** (under `CATALOG_S3_PREFIX`, default `images/`):

- **Pergolas** (roots `pergulet`, `pergulot`, `pergulas`): second folder selects type — **glass** → פרגולה זכוכית; **hi-tech** → פרגולה היי טק; **wood-look** (`dmuy-etz`, `wood-look`, `דמוי עץ`, …) → פרגולות דמוי עץ; otherwise → פרגולה קלסית. Aliases: [`lib/catalog/catalog-config.ts`](lib/catalog/catalog-config.ts).
- **חיפוי קיר**: first folder one of `cladding`, `chipuy`, `wall-cladding`, `חיפוי`, …
- **חיפוי קיר דמוי עץ**: same cladding roots with second folder in the wood-look set (e.g. `images/cladding/dmuy-etz/…`).
- **גדרות**: `fancy`, `social-fences`
- **מעקות**: `rails`, `railing`
- **מסתורי כביסה**: `mester`, `mestor`

Excluded first-level folders: default `logos` (`CATALOG_S3_EXCLUDE_FOLDERS`). Section ids for `?sections=`: `pergola_classic`, `pergola_glass`, `pergola_hitech`, `pergola_wood_look`, `fences`, `railings`, `laundry_covers`, `wall_cladding`, `wall_cladding_wood`.

PDF generation uses Puppeteer (local Chromium in dev, `@sparticuz/chromium` on Vercel). Optional: `CHROMIUM_PACK_URL` (see CRM `lib/pdf/create-browser.ts`).

