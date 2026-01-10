## Magic Link test plan (server-only callback) / План тестирования Magic Link (только server callback)

### 0) Supabase Dashboard checklist / Чеклист Supabase Dashboard

- **Site URL**: `https://crm.pashkovsky-group.com`
- **Redirect URLs** include:
  - `https://crm.pashkovsky-group.com/auth/callback`
  - `https://crm.pashkovsky-group.com/app/*`

> Важно: мы больше **не** отправляем пользователю ссылку Supabase `/auth/v1/verify` напрямую.  
> Мы отправляем ссылку на наш домен: `/auth/callback?token=...&type=magiclink&next=/app`, а сервер делает `verifyOtp()` и ставит cookies.

---

### 1) Generate link / Сгенерировать ссылку

From SuperAdmin UI or API:

```bash
curl -X POST https://crm.pashkovsky-group.com/api/superadmin/users/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "redirectTo": "/app" }'
```

Expected response:
- `magicLink` starts with `https://crm.pashkovsky-group.com/auth/callback?token=...&type=magiclink&next=%2Fapp`

---

### 2) Open in Incognito / Открыть в инкогнито

- Chrome/Edge: `Ctrl+Shift+N` / `Cmd+Shift+N`
- Safari: `Cmd+Shift+N`

Open `magicLink` from the response (or from email).

Expected:
- Redirects to `/app`
- No infinite loading

---

### 3) Verify cookies / Проверить cookies

Open DevTools → Application → Cookies:
- Should have `sb-*` cookies (session stored in cookies, not localStorage)

Also check:
- `/api/debug/auth` returns `authenticated: true` and your email

---

### 4) Admin guard / Проверка server guard для /app/admin

Try to open `/app/admin` as a normal (non-platform-admin) user:
- Expected redirect to `/app`

Try to open `/app/admin` as a platform admin:
- Expected access allowed

---

### 5) SuperAdmin routes guard / Проверка server guard для /superadmin

Open `/superadmin`:
- With valid SuperAdmin (Redis session or platform_admins) → OK
- Without → redirect to `/login`


