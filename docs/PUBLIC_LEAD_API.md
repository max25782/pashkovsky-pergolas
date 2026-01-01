# 🔒 Public Lead API

## 📋 Overview

Secure public endpoint for receiving lead submissions from the marketing site into CRM.

**Endpoint:** `POST https://crm.pashkovsky-group.com/api/public/leads`

---

## 🔐 Security Features

### 1. **Site Token Authentication**
- Header: `x-site-token: <CRM_SITE_TOKEN>`
- Validates that request comes from authorized site

### 2. **Rate Limiting**
- **Limit:** 5 requests per 15 minutes per IP
- Returns `429 Too Many Requests` when exceeded
- Headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

### 3. **Honeypot Field**
- Field: `website` (should be empty)
- If filled → silently blocked (returns success to bot)
- Real users never see/fill this field

### 4. **Input Validation**
- Zod schema validation
- Name: 2-100 chars
- Phone: 9-20 chars
- Email: valid email (optional)
- Message: max 1000 chars

### 5. **No Personal Data in Logs**
- Only logs: source, IP, timing, errors
- Never logs: phone, email, name, message

---

## 📝 Request Format

### **Headers:**
```http
Content-Type: application/json
x-site-token: <your-site-token>
```

### **Body:**
```json
{
  "name": "John Doe",
  "phone": "+972501234567",
  "email": "john@example.com",
  "message": "Interested in pergola for garden",
  "source": "contact-form",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "summer-2024",
  "metadata": {
    "pergolaType": "electric",
    "area": 20
  },
  "website": ""
}
```

### **Fields:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | ✅ | string | Customer name (2-100 chars) |
| `phone` | ✅ | string | Phone number (9-20 chars) |
| `email` | ❌ | string | Email address |
| `message` | ❌ | string | Customer message (max 1000) |
| `source` | ❌ | string | Form source (e.g., 'contact-form', 'calculator') |
| `utm_source` | ❌ | string | UTM source |
| `utm_medium` | ❌ | string | UTM medium |
| `utm_campaign` | ❌ | string | UTM campaign |
| `metadata` | ❌ | object | Additional data (e.g., calculator results) |
| `website` | ⚠️ | string | **Honeypot** - must be empty |

---

## ✅ Response Format

### **Success (201):**
```json
{
  "success": true,
  "id": "lead-uuid"
}
```

**Headers:**
```http
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1234567890000
```

### **Error (400):**
```json
{
  "error": "Invalid data",
  "details": [
    {
      "field": "phone",
      "message": "Phone is too short"
    }
  ]
}
```

### **Rate Limited (429):**
```json
{
  "error": "Too many requests",
  "retryAfter": 600
}
```

**Headers:**
```http
Retry-After: 600
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1234567890000
```

### **Unauthorized (401):**
```json
{
  "error": "Unauthorized"
}
```

---

## 🌐 Client Usage (Site)

### **Installation:**

Add to site's `.env.local`:
```env
NEXT_PUBLIC_CRM_URL=https://crm.pashkovsky-group.com
NEXT_PUBLIC_SITE_TOKEN=your-site-token-here
```

### **Basic Usage:**

```typescript
import { submitLead } from '@/lib/api/submit-lead'

const result = await submitLead({
  name: formData.name,
  phone: formData.phone,
  email: formData.email,
  message: formData.message,
  source: 'contact-form'
})

if (result.success) {
  console.log('Lead submitted!', result.id)
} else {
  console.error('Error:', result.error)
}
```

### **React Hook:**

```typescript
import { useLeadSubmission } from '@/lib/api/submit-lead'

function ContactForm() {
  const { submit, loading, error, success } = useLeadSubmission()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await submit({
      name: formData.name,
      phone: formData.phone,
      source: 'contact-form'
    })
    
    if (ok) {
      // Show success message
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... form fields ... */}
      {loading && <p>Sending...</p>}
      {error && <p>Error: {error}</p>}
      {success && <p>Thank you! We'll contact you soon.</p>}
    </form>
  )
}
```

---

## 🛠️ CRM Configuration

### **Environment Variables (CRM only):**

Add to Vercel CRM project:
```env
# Site Token (shared with site)
CRM_SITE_TOKEN=generate-random-32-char-token

# Default Company ID for website leads
DEFAULT_COMPANY_ID=your-company-uuid

# Supabase (already exists)
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### **Generate Site Token:**
```bash
openssl rand -base64 32
```

**Important:** Use the same token in both:
- CRM: `CRM_SITE_TOKEN`
- Site: `NEXT_PUBLIC_SITE_TOKEN`

---

## 📊 Rate Limit Details

- **Window:** 15 minutes
- **Max Requests:** 5 per IP
- **Identifier:** Client IP address
- **Storage:** In-memory (resets on server restart)

For production with multiple instances, consider:
- Redis (Upstash)
- Vercel KV
- Database-based rate limiting

---

## 🐛 Testing

### **Health Check:**
```bash
curl https://crm.pashkovsky-group.com/api/public/leads
```

Response:
```json
{
  "service": "public-leads",
  "status": "ok",
  "rateLimit": {
    "maxRequests": 5,
    "windowMs": 900000
  }
}
```

### **Submit Test Lead:**
```bash
curl -X POST https://crm.pashkovsky-group.com/api/public/leads \
  -H "Content-Type: application/json" \
  -H "x-site-token: YOUR_TOKEN" \
  -d '{
    "name": "Test User",
    "phone": "+972501234567",
    "email": "test@example.com",
    "message": "Test message",
    "source": "api-test",
    "website": ""
  }'
```

### **Test Honeypot:**
```bash
# This should return success but not save lead
curl -X POST https://crm.pashkovsky-group.com/api/public/leads \
  -H "Content-Type: application/json" \
  -H "x-site-token: YOUR_TOKEN" \
  -d '{
    "name": "Bot",
    "phone": "+972501234567",
    "website": "http://spam.com"
  }'
```

### **Test Rate Limit:**
```bash
# Run 6 times quickly
for i in {1..6}; do
  curl -X POST https://crm.pashkovsky-group.com/api/public/leads \
    -H "Content-Type: application/json" \
    -H "x-site-token: YOUR_TOKEN" \
    -d '{"name":"User '$i'","phone":"+972501234567","website":""}'
  echo ""
done
```

---

## 📈 Monitoring

### **Logs to Watch:**

```
[Public Leads] Success
[Public Leads] Validation failed
[Public Leads] Honeypot triggered
[Public Leads] Rate limit exceeded
[Public Leads] Invalid site token
```

### **Metrics to Track:**
- Success rate
- Rate limit hits
- Honeypot triggers
- Average response time
- Validation errors by field

---

## 🔒 Security Best Practices

### ✅ **Do:**
- Rotate `CRM_SITE_TOKEN` periodically
- Monitor for unusual traffic patterns
- Keep rate limits reasonable
- Log only technical data

### ❌ **Don't:**
- Expose `CRM_SITE_TOKEN` in client code
- Log personal data (phone, email, name)
- Accept leads without validation
- Ignore honeypot triggers

---

## 🚀 Deployment

1. **Add env vars** to CRM Vercel project
2. **Deploy CRM** (auto-deploy on push)
3. **Add client code** to site
4. **Add env vars** to site project
5. **Test** with curl or Postman
6. **Monitor logs** in production

---

## 📚 Related Files

- `app/api/public/leads/route.ts` - API endpoint
- `lib/validation/public-lead.ts` - Zod schema
- `lib/rate-limit.ts` - Rate limiting utility
- `lib/api/submit-lead.ts` - Client utility (for site)

---

**🎉 Secure lead collection ready!**

