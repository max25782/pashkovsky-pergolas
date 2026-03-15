# Zapier Leads Integration

Receive Facebook Lead Ads leads via Zapier into CRM.

## 1. Create Zap

1. Go to [zapier.com](https://zapier.com) → Create Zap
2. **Trigger:** Facebook Lead Ads → **New Lead**
3. Connect your Facebook account, select Page and Form
4. **Action:** Webhooks by Zapier → **POST**
5. Configure:
   - **URL:** `https://crm.pashkovsky-group.com/api/webhooks/zapier-leads`
   - **Payload Type:** JSON
   - **Data:** Map fields (see below)
   - **Headers:** Add header `x-zapier-secret` = your secret (from env)

## 2. Field Mapping

Map Facebook Lead Ads fields to the request body:

| Facebook field | Map to key | Required |
|----------------|------------|----------|
| full_name or first_name | `full_name` or `name` | Yes |
| phone_number or phone | `phone_number` or `phone` | Yes |
| email | `email` | No |
| city | `city` | No |

Example Data in Zapier:
```json
{
  "full_name": "{{trigger.full_name}}",
  "phone_number": "{{trigger.phone_number}}",
  "email": "{{trigger.email}}",
  "city": "{{trigger.city}}"
}
```

If your form uses different field names, map them. The endpoint accepts: `full_name`, `first_name`, `name`, `phone_number`, `phone`, `email`.

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
