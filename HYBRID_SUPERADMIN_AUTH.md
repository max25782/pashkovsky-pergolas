# Hybrid SuperAdmin Authentication

## Архитектура

SuperAdmin поддерживает **два метода аутентификации**:

### 1️⃣ Redis Session (ОСНОВНОЙ) - Phone Auth
```
Вход по телефону → /api/auth/superadmin-login
                 ↓
          Создаётся Redis session
                 ↓
   Устанавливается superadmin_session cookie (httpOnly)
                 ↓
      requireSuperAdmin() проверяет Redis
```

**Когда использовать:**
- Продакшн
- Основной способ входа для SuperAdmin
- Phone/SMS аутентификация

**Плюсы:**
- ✅ Полный контроль над сессиями
- ✅ Мгновенная ревокация (удалить из Redis)
- ✅ TTL для автоматического истечения
- ✅ Хранение дополнительных данных в session

---

### 2️⃣ Supabase Auth (FALLBACK) - Magic Link
```
Magic link → /auth/callback
          ↓
   Supabase exchangeCodeForSession
          ↓
   Устанавливаются sb-* cookies
          ↓
   requireSuperAdmin() проверяет Supabase
          ↓
   Проверка platform_admins table
```

**Когда использовать:**
- Тестирование
- Разработка
- Быстрый вход без SMS

**Плюсы:**
- ✅ Не нужен Redis для локальной разработки
- ✅ Можно быстро протестировать SuperAdmin функционал
- ✅ Работает в Safari Incognito

---

## Порядок проверки в requireSuperAdmin()

```typescript
export async function checkSuperAdminAuth(request: NextRequest) {
  // 1️⃣ Сначала проверяем Redis (основной метод)
  const sessionId = request.cookies.get('superadmin_session')?.value
  if (sessionId) {
    const session = await getSession(sessionId)
    if (session?.role === 'superadmin') {
      return { ...session, auth_method: 'redis' }  // ✅ Redis auth
    }
  }

  // 2️⃣ Fallback на Supabase (для magic link)
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    const isAdmin = await isSuperAdmin(user.id)  // Проверка platform_admins
    if (isAdmin) {
      return { user_id: user.id, auth_method: 'supabase' }  // ✅ Supabase auth
    }
  }

  return null  // ❌ Нет авторизации
}
```

---

## Cookies

| Auth Method | Cookie Name | Где хранится | TTL |
|-------------|-------------|--------------|-----|
| Redis | `superadmin_session` | Redis | Настраиваемый (по умолчанию 24h) |
| Supabase | `sb-*-auth-token` | Supabase | Управляется Supabase |

---

## Логирование

В логах можно увидеть какой метод используется:

```
[SuperAdmin Auth] ✓ Redis session valid: office@pashkovsky-group.com
```

или

```
[SuperAdmin Auth] ✓ Supabase auth valid: office@pashkovsky-group.com
```

---

## Setup для разработки

### Вариант 1: Только Magic Link (без Redis)
1. Создайте пользователя в `auth.users`
2. Добавьте в `platform_admins`:
```sql
INSERT INTO platform_admins (user_id, email, is_active)
SELECT id, email, true FROM auth.users 
WHERE email = 'your@email.com';
```
3. Сгенерируйте magic link через `/superadmin/companies`
4. Войдите по magic link → Supabase auth

### Вариант 2: Phone Auth (с Redis)
1. Установите Redis (см. `REDIS_SETUP.md`)
2. Настройте env variables:
```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```
3. Войдите через `/login` с номером телефона
4. → Redis session

---

## Vercel Production

На продакшене рекомендуется использовать **Redis** (основной метод):

1. Настройте Upstash Redis (free tier)
2. Добавьте env variables в Vercel:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Используйте phone auth для входа

Magic link (Supabase fallback) будет работать, но Redis — основной и правильный метод.

---

## Почему Hybrid?

### До (только Supabase):
```
❌ Magic link работает, но не использует оригинальную архитектуру
❌ Игнорирует Redis sessions
❌ Не поддерживает phone auth
```

### После (Hybrid):
```
✅ Redis (primary) для phone auth
✅ Supabase (fallback) для magic link testing
✅ Работают оба метода
✅ Сохранена оригинальная архитектура
```

---

## Диагностика

### Проблема: "Unauthorized: Authentication required"

**Проверьте cookies в DevTools:**

1. Если есть `superadmin_session` → проверьте Redis:
```bash
# In Upstash Console → Data Browser
GET superadmin:session:<session_id>
```

2. Если есть `sb-*-auth-token` → проверьте `platform_admins`:
```sql
SELECT * FROM platform_admins 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your@email.com'
);
```

3. Если нет ни одной cookie → заново войдите

---

## API Endpoints

Все SuperAdmin API теперь работают с обоими методами:

- `DELETE /api/superadmin/companies/[id]` ✅
- `POST /api/superadmin/companies/onboard` ✅
- `POST /api/superadmin/users/send-magic-link` ✅
- `GET /api/platform/integrations/list` ✅
- `POST /api/platform/integrations/activate` ✅

---

## Резюме

| | Redis (Phone Auth) | Supabase (Magic Link) |
|---|---|---|
| **Назначение** | Production | Testing/Development |
| **Cookie** | `superadmin_session` | `sb-*-auth-token` |
| **Приоритет** | 🥇 Проверяется первым | 🥈 Fallback |
| **Ревокация** | ✅ Instant (delete from Redis) | ⚠️ Только через Supabase |
| **Рекомендуется** | ✅ Да | ⚠️ Только для тестов |

