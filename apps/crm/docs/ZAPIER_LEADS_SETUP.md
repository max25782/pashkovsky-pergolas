# Zapier Leads Integration

Receive leads from Facebook Lead Ads, TikTok Lead Generation, or other sources via Zapier into CRM.

## 1. Create Zap

1. Go to [zapier.com](https://zapier.com) → Create Zap
2. **Trigger:** Choose one:
   - **Facebook Lead Ads** → **New Lead** (for Facebook)
   - **TikTok Lead Generation** → **New Lead** (for TikTok)
3. Connect your account, select Advertiser/Lead Source
4. **Action:** Webhooks by Zapier → **POST**
5. Configure:
   - **URL:** `https://crm.pashkovsky-group.com/api/webhooks/zapier-leads`
   - **Payload Type:** JSON
   - **Data:** Map fields (see below)
   - **Headers:** Add header `x-zapier-secret` = your secret (from env)

## 2. Field Mapping

Map trigger fields to the request body:

| Trigger field | Map to key | Required |
|---------------|------------|----------|
| full_name / first_name / name | `full_name` or `name` | Yes |
| phone_number / phone | `phone_number` or `phone` | Yes |
| email | `email` | No |
| city | `city` | No |
| — | `source` | No (see below) |

**Source:** Add `source` so leads appear in the correct Kanban column:
- Facebook: `source` = `facebook` (or omit, default)
- TikTok: `source` = `tiktok`
- Website: `source` = `website`

**Example for TikTok:**
```json
{
  "full_name": "{{1.Full Name}}",
  "phone_number": "{{1.Phone Number}}",
  "email": "{{1.Email}}",
  "city": "{{1.City}}",
  "source": "tiktok"
}
```

**Example for Facebook:**
```json
{
  "full_name": "{{1.Full Name}}",
  "phone_number": "{{1.Phone Number}}",
  "email": "{{1.Email}}",
  "city": "{{1.City}}",
  "source": "facebook"
}
```

If your form uses different field names, map them. The endpoint accepts: `full_name`, `first_name`, `name`, `phone_number`, `phone`, `email`, `city`, `source`.

## 3. Environment Variables (CRM)

Add to `apps/crm/.env.local` or production:

```
ZAPIER_LEADS_SECRET=your-random-secret-string
FB_LEADS_COMPANY_ID=<uuid-of-your-company>
```

Generate a secret: `openssl rand -hex 32`

- `ZAPIER_LEADS_SECRET` — add as header `x-zapier-secret` in Zapier. If not set, endpoint accepts any request (less secure).
- `FB_LEADS_COMPANY_ID` — company UUID for new leads. Falls back to `DEFAULT_COMPANY_ID`.

## 4. Deploy and Test

1. Deploy CRM with the new endpoint
2. In Zapier, add the header and field mapping
3. Turn on the Zap
4. Submit a test lead from Facebook

## 5. Duplicate Handling

Leads with the same phone (in the same company) are skipped. Response: `{ "success": true, "duplicate": true }`.
