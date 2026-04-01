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
   - **Payload Type:** **JSON** — not “Form”. Form sends `x-www-form-urlencoded`; this endpoint only parses **JSON** (`req.json()`). If you only see **Form** vs **Raw**, choose **Raw** and send a JSON object with `Content-Type: application/json`, or switch to the Webhooks action that exposes **JSON** explicitly.
   - **Data:** Map fields (see below)
   - **Headers (required if `ZAPIER_LEADS_SECRET` is set on the server):** add a custom header:
     - **Key:** `x-zapier-secret`
     - **Value:** exactly the same string as `ZAPIER_LEADS_SECRET` in CRM production env (no quotes, no trailing spaces).
     - Alternative: **Authorization** = `Bearer <same secret>` (some Zapier UIs only expose this).

### If Zapier shows `Unauthorized` (401)

That response means the CRM rejected the request because the secret did not match (or was missing).

1. Confirm **Vercel/hosting env** has `ZAPIER_LEADS_SECRET` set and redeployed after adding it.
2. In the **Webhooks by Zapier** step, open **Headers** and ensure `x-zapier-secret` is present on **every** test and live run (TikTok’s embedded Zap flow sometimes omits headers until you expand “Show advanced options”).
3. Copy/paste the secret from the host env into Zapier again — avoid smart quotes or invisible characters.
4. Quick check (replace **`<PASTE_REAL_SECRET>`** with the same value as `ZAPIER_LEADS_SECRET` in production — **not** the literal text `YOUR_SECRET`):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://crm.pashkovsky-group.com/api/webhooks/zapier-leads \
     -H "Content-Type: application/json" \
     -H "x-zapier-secret: <PASTE_REAL_SECRET>" \
     -d '{"full_name":"Test","phone_number":"0501234567"}'
   ```
   Expect **201** (new lead) or **200** (duplicate phone). **401** means the header value ≠ server env (or env secret not set and you’re hitting a different issue — if secret is unset, 401 should not occur from auth).
5. **Not recommended for production:** remove `ZAPIER_LEADS_SECRET` from env to disable the check (anyone could POST leads).

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

## 6. Zapier “Test step” errors (not your CRM)

If the browser console shows **`TestZapStep:Gate` / `EARLY RETURN path (inactive)`** or **`422`** on a URL like `zapier.com/api/gulliver/steptesting/...`, that is **Zapier’s own test runner**, not `crm.pashkovsky-group.com`.

Typical causes:

1. **Trigger step never successfully “Test”** — run **Test** on step 1 (TikTok Lead Generation) first until you get real sample fields. Step 2 cannot map `{{...}}` without that data.
2. **Zap is Off** — turn the Zap **On**, or finish setup in the main Zap editor (embedded TikTok “Connect CRM” flow is stricter).
3. **Missing TikTok selections** — advertiser / lead form / `library_id` must be chosen on the trigger so Zapier can validate the step.
4. **422** — Zapier rejected the internal test request (validation). Retry after fixing the trigger; try **full Zap editor** at [zapier.com](https://zapier.com) instead of only the TikTok modal; hard-refresh or another browser.

To confirm the CRM works independently of Zapier’s UI, use **curl** (see § “Unauthorized”) or Postman against `/api/webhooks/zapier-leads` with JSON + `x-zapier-secret`.
