# Public Lead API - Quick Start

## 🚀 Setup (5 minutes)

### **Step 1: Generate Site Token**

```bash
openssl rand -base64 32
```

Copy the output (e.g., `Xk7pQ2...`)

---

### **Step 2: Add to CRM (Vercel)**

Vercel Dashboard → pashkovsky-crm → Settings → Environment Variables:

```env
CRM_SITE_TOKEN=Xk7pQ2...
DEFAULT_COMPANY_ID=<your-company-uuid>
```

**Get DEFAULT_COMPANY_ID:**
```sql
-- Run in Supabase SQL Editor
SELECT id, name FROM companies LIMIT 5;
```

---

### **Step 3: Add to Site (Vercel)**

Vercel Dashboard → pashkovsky-site → Settings → Environment Variables:

```env
NEXT_PUBLIC_CRM_URL=https://crm.pashkovsky-group.com
NEXT_PUBLIC_SITE_TOKEN=Xk7pQ2...
```

**Important:** Use the SAME token as `CRM_SITE_TOKEN`

---

### **Step 4: Deploy**

Both projects will redeploy automatically.

---

## 📝 Usage in Site Code

### **Simple Form:**

```tsx
'use client'

import { useState } from 'react'
import { submitLead } from '@/lib/api/submit-lead'

export default function ContactForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    
    const result = await submitLead({
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      message: formData.get('message') as string,
      source: 'contact-form',
    })
    
    setLoading(false)
    
    if (result.success) {
      setMessage('תודה! ניצור איתך קשר בקרוב')
      e.currentTarget.reset()
    } else {
      setMessage(result.error || 'שגיאה, נסה שוב')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input 
        name="name" 
        required 
        placeholder="שם מלא" 
        className="w-full px-4 py-2 border rounded"
      />
      <input 
        name="phone" 
        required 
        placeholder="טלפון" 
        className="w-full px-4 py-2 border rounded"
      />
      <input 
        name="email" 
        type="email" 
        placeholder="אימייל (אופציונלי)" 
        className="w-full px-4 py-2 border rounded"
      />
      <textarea 
        name="message" 
        placeholder="הודעה" 
        className="w-full px-4 py-2 border rounded"
      />
      
      <button 
        type="submit" 
        disabled={loading}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded"
      >
        {loading ? 'שולח...' : 'שלח'}
      </button>
      
      {message && <p className="text-center">{message}</p>}
    </form>
  )
}
```

---

### **With React Hook:**

```tsx
'use client'

import { useLeadSubmission } from '@/lib/api/submit-lead'

export default function ContactForm() {
  const { submit, loading, error, success, reset } = useLeadSubmission()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    const formData = new FormData(e.currentTarget)
    
    const ok = await submit({
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      source: 'contact-form',
    })
    
    if (ok) {
      e.currentTarget.reset()
      setTimeout(reset, 5000) // Clear success message after 5s
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... form fields ... */}
      
      <button type="submit" disabled={loading}>
        {loading ? 'שולח...' : 'שלח'}
      </button>
      
      {success && <p className="text-green-600">תודה! ניצור קשר בקרוב</p>}
      {error && <p className="text-red-600">{error}</p>}
    </form>
  )
}
```

---

## ✅ Testing

### **Test Endpoint:**

```bash
curl https://crm.pashkovsky-group.com/api/public/leads
```

Should return:
```json
{
  "service": "public-leads",
  "status": "ok",
  "rateLimit": {...}
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
    "source": "api-test",
    "website": ""
  }'
```

Should return:
```json
{
  "success": true,
  "id": "lead-uuid"
}
```

---

## 🔍 Verify in CRM

1. Go to: `https://crm.pashkovsky-group.com/app/admin/leads`
2. Look for test lead
3. Should show: name, phone, email, source = "api-test"

---

## 🛡️ Security Features

✅ Site token validation  
✅ Rate limiting (5 req/15min per IP)  
✅ Honeypot field (blocks bots)  
✅ Input validation (Zod)  
✅ No personal data in logs  

---

## 📚 Full Documentation

See `docs/PUBLIC_LEAD_API.md` for complete API reference.

---

**🎉 Ready to collect leads!**

