# 🔐 Удаление ADMIN_TOKEN - Безопасность и Архитектура

## Что изменилось

Мы полностью удалили использование `ADMIN_TOKEN` из системы аутентификации. Теперь **вся авторизация работает только через Supabase Auth JWT токены**.

## Почему это было нужно?

### ❌ Проблемы старого подхода с ADMIN_TOKEN:

1. **Hardcoded токен в клиентском коде** - `'Hr11062015ks'` был захардкожен в браузерном коде
2. **Единый токен для всех** - все администраторы использовали один и тот же токен
3. **Невозможно отозвать** - если токен скомпрометирован, нужно менять везде
4. **Нет аудита** - невозможно отследить, кто именно выполнил действие
5. **Не масштабируется** - в multi-tenant системе каждая компания должна иметь свою аутентификацию

### ✅ Преимущества нового подхода (только Supabase Auth):

1. **Индивидуальные токены** - каждый пользователь имеет свой JWT токен
2. **Автоматическая ротация** - токены обновляются автоматически
3. **Можно отозвать** - можно заблокировать пользователя в Supabase
4. **Полный аудит** - каждое действие привязано к конкретному пользователю
5. **Multi-tenant ready** - каждая компания изолирована через `company_members`

## Что было изменено

### 1. Middleware (`apps/crm/lib/middleware/auth.ts`)

**До:**
```typescript
const adminToken = req.headers.get('x-admin-token')
const expectedAdminToken = process.env.ADMIN_TOKEN

if (adminToken && expectedAdminToken && adminToken === expectedAdminToken) {
  return { authorized: true, isAdmin: true }
}
```

**После:**
```typescript
export function requireAuth(req: NextRequest): { authorized: boolean; error?: NextResponse } {
  const userContext = getUserContext(req)
  if (userContext) {
    return { authorized: true }
  }
  
  return {
    authorized: false,
    error: NextResponse.json({ error: 'Unauthorized: No valid token' }, { status: 401 })
  }
}
```

### 2. Company Context (`apps/crm/lib/middleware/company-context.ts`)

Удалены все проверки `ADMIN_TOKEN`. Теперь контекст извлекается только из Supabase Auth JWT.

**До:**
```typescript
if (adminToken && expectedAdminToken && adminToken === expectedAdminToken) {
  return {
    userId: 'admin',
    email: 'admin@system',
    companyId: PASHKOVSKY_COMPANY_ID,
    role: 'owner',
  }
}
```

**После:**
```typescript
export function getUserContext(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const payload = verifyToken(token)
  // ... validate and return user context from JWT
}
```

### 3. Клиентский код (`apps/crm/app/app/admin/users/page.tsx`)

Удалён hardcoded fallback на `ADMIN_TOKEN`.

**До:**
```typescript
let token = localStorage.getItem('token')

// Fallback to admin token for development
if (!token) {
  token = 'Hr11062015ks' // ADMIN_TOKEN from .env.local
}
```

**После:**
```typescript
const token = localStorage.getItem('token')

if (!token) {
  throw new Error('Not authenticated')
}
```

## Как это работает теперь

### 1. Логин пользователя

```typescript
// 1. Пользователь логинится через Supabase Auth
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@company.com',
  password: 'password123'
})

// 2. Получает JWT токен
const jwtToken = data.session.access_token

// 3. Сохраняет токен в localStorage
localStorage.setItem('token', jwtToken)
```

### 2. API запросы

```typescript
// Клиент отправляет JWT токен в заголовке
const response = await fetch('/admin-api/users', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
})
```

### 3. Проверка на сервере

```typescript
// API route
export async function GET(req: NextRequest) {
  // 1. Middleware проверяет JWT
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  
  // 2. Извлекает контекст пользователя
  const userContext = getUserContext(req)
  
  // 3. Проверяет права
  const permissionCheck = requirePermission(req, 'users:view')
  if (!permissionCheck.authorized) return permissionCheck.error
  
  // 4. Выполняет запрос
  // ...
}
```

## Migration Checklist

- [x] Удалён ADMIN_TOKEN из `lib/middleware/auth.ts`
- [x] Удалён ADMIN_TOKEN из `lib/middleware/company-context.ts`
- [x] Удалён hardcoded токен из `app/app/admin/users/page.tsx`
- [x] Обновлена документация

## Что нужно сделать

### 1. Удалите ADMIN_TOKEN из .env.local (опционально)

```bash
# Можно оставить для других целей, но он больше не используется для аутентификации
# ADMIN_TOKEN=Hr11062015ks
```

### 2. Убедитесь, что пользователи залогинены

Все пользователи CRM должны войти через `/login` и получить JWT токены от Supabase Auth.

### 3. Примените миграцию базы данных

Убедитесь, что применена миграция `025_sync_auth_users.sql` для синхронизации `auth.users` с `public.users`.

## FAQ

### Q: Что если у меня нет JWT токена?

**A:** Залогиньтесь через `/login`. Суп abase Auth создаст для вас JWT токен автоматически.

### Q: Как тестировать API в Postman/Insomnia?

**A:** 
1. Залогиньтесь в CRM
2. Откройте DevTools → Application → Local Storage
3. Скопируйте значение `token`
4. Используйте в Postman: `Authorization: Bearer <токен>`

### Q: ADMIN_TOKEN всё ещё где-то используется?

**A:** Да, может использоваться в:
- `apps/crm/app/api/reports/weekly-digest/route.ts` - для внутренних cron-задач
- `apps/crm/app/api/smm/leads/route.ts` - для интеграций

Эти эндпоинты можно обновить позже для использования Service Role Key или API Keys.

### Q: Что с SuperAdmin?

**A:** SuperAdmin использует `SUPERADMIN_TOKEN` - это отдельный механизм для платформенного администрирования. Он не связан с `ADMIN_TOKEN` и работает через отдельную систему (`platform_admins` таблица).

## Безопасность

### ✅ Что теперь безопаснее:

- JWT токены имеют срок действия (expiry)
- Токены можно отозвать через Supabase Dashboard
- Каждое действие привязано к конкретному пользователю
- Нет захардкоженных секретов в клиентском коде
- Multi-tenant изоляция через `company_members`

### ⚠️ Важно помнить:

- JWT токены хранятся в `localStorage` - не XSS-безопасно
- Для production рассмотрите использование `httpOnly` cookies
- Регулярно ротируйте токены (автоматически делается Supabase)
- Используйте HTTPS в production

## Дальнейшие улучшения

1. **Переместить токены в httpOnly cookies** для защиты от XSS
2. **Добавить refresh token logic** для автоматического обновления
3. **Реализовать rate limiting** на уровне API
4. **Добавить audit logging** для всех критичных операций
5. **Внедрить RBAC** с детальными разрешениями

---

**Статус:** ✅ Полностью внедрено

**Дата:** 2025-01-01

**Версия:** 2.0.0






