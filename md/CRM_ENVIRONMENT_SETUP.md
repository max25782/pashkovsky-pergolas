# Настройка CRM для разных окружений

## Как использовать CRM только на поддомене, но не в production

### Вариант 1: Использовать переменную окружения (рекомендуется)

#### Для разработки (локально или staging):

Добавьте в `.env.local`:
```env
ENABLE_CRM_SUBDOMAIN=true
```

#### Для production:

**Не добавляйте** `ENABLE_CRM_SUBDOMAIN` в production `.env`, или установите:
```env
ENABLE_CRM_SUBDOMAIN=false
```

### Вариант 2: Использовать разные ветки

#### Структура веток:

```
master (production)
  └─ CRM отключен автоматически (NODE_ENV=production)
  
develop / staging
  └─ CRM включен (ENABLE_CRM_SUBDOMAIN=true)
```

#### Workflow:

1. **Production (master):**
   - CRM автоматически отключен (проверка `NODE_ENV !== 'production'`)
   - Поддомен `crm.*` не работает
   - `/admin/*` редиректит на главную

2. **Development/Staging:**
   - Добавьте `ENABLE_CRM_SUBDOMAIN=true` в `.env.local`
   - Поддомен `crm.*` работает
   - `/admin/*` редиректит на `crm.*`

### Вариант 3: Использовать Vercel Environment Variables

#### Для Production проекта в Vercel:

1. Зайдите в Vercel Dashboard
2. Выберите проект → **Settings** → **Environment Variables**
3. **НЕ добавляйте** `ENABLE_CRM_SUBDOMAIN` для Production
4. Или добавьте: `ENABLE_CRM_SUBDOMAIN=false`

#### Для Preview/Development:

1. В тех же Environment Variables
2. Добавьте для **Preview** и **Development**:
   ```
   ENABLE_CRM_SUBDOMAIN=true
   ```

### Как это работает:

Middleware проверяет:
1. `ENABLE_CRM_SUBDOMAIN === 'true'` → CRM включен
2. `NODE_ENV !== 'production'` → CRM включен (для разработки)
3. Если оба условия false → CRM отключен

### Проверка текущего состояния:

В development консоли браузера (только для отладки):
```javascript
// Это не будет работать в production (переменные окружения не доступны в браузере)
// Но можно проверить поведение:
// - Если CRM включен: crm.localhost:3000 работает
// - Если CRM выключен: crm.localhost:3000 редиректит на главную
```

### Примеры конфигурации:

#### `.env.local` (для разработки):
```env
ENABLE_CRM_SUBDOMAIN=true
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_TOKEN=...
```

#### Production `.env` (Vercel или другой хостинг):
```env
# НЕ добавляйте ENABLE_CRM_SUBDOMAIN
# Или явно установите:
ENABLE_CRM_SUBDOMAIN=false

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_TOKEN=...
```

### Важные замечания:

1. **Безопасность**: В production CRM полностью недоступен, даже если кто-то попытается зайти на `/admin/*`

2. **Локальная разработка**: По умолчанию CRM включен в development (`NODE_ENV !== 'production'`), поэтому локально все работает без дополнительных настроек

3. **Staging**: Если у вас есть staging окружение, добавьте `ENABLE_CRM_SUBDOMAIN=true` в его переменные окружения

4. **Git**: Не коммитьте `.env.local` - он уже в `.gitignore`

### Быстрая проверка:

```bash
# Проверить, включен ли CRM (в development)
npm run dev
# Откройте http://crm.localhost:3000
# Если работает → CRM включен ✅
# Если редирект → CRM выключен ❌
```

