# Настройка поддомена для CRM

## Что было сделано

Middleware настроен так, что:
- **На поддомене `crm.pashkovsky-group.com`**: админка доступна по чистым URL (`/admin/deals`, `/admin/leads`)
- **На основном домене `pashkovsky-group.com`**: попытка зайти на `/admin/*` автоматически редиректит на `crm.pashkovsky-group.com`

## Настройка DNS

### Вариант 1: Если используете Vercel (рекомендуется)

1. Зайдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Domains**
4. Добавьте домен: `crm.pashkovsky-group.com`
5. Vercel автоматически настроит DNS записи

**Или вручную:**
- Добавьте CNAME запись в DNS вашего домена:
  ```
  Type: CNAME
  Name: crm
  Value: cname.vercel-dns.com
  ```
  (Точное значение `cname.vercel-dns.com` будет показано в Vercel Dashboard)

### Вариант 2: Если используете другой хостинг

#### Для Cloudflare:
1. Зайдите в Cloudflare Dashboard
2. Выберите домен `pashkovsky-group.com`
3. Перейдите в **DNS** → **Records**
4. Добавьте запись:
   ```
   Type: CNAME
   Name: crm
   Target: ваш-хостинг.com (или IP адрес)
   Proxy: Off (или On, если нужен CDN)
   ```

#### Для обычного DNS провайдера:
1. Зайдите в панель управления DNS вашего домена
2. Добавьте CNAME запись:
   ```
   Type: CNAME
   Host: crm
   Points to: ваш-хостинг.com
   TTL: 3600 (или Auto)
   ```

#### Если хостинг требует A-запись (IP адрес):
1. Узнайте IP адрес вашего сервера
2. Добавьте A-запись:
   ```
   Type: A
   Host: crm
   Points to: XXX.XXX.XXX.XXX (IP адрес)
   TTL: 3600
   ```

## Проверка настройки

После настройки DNS (может занять до 24 часов, обычно 5-15 минут):

1. **Проверьте DNS:**
   ```bash
   # Windows PowerShell
   nslookup crm.pashkovsky-group.com
   
   # Linux/Mac
   dig crm.pashkovsky-group.com
   ```

2. **Проверьте в браузере:**
   - Откройте `crm.pashkovsky-group.com` → должно открыться `/admin/deals`
   - Откройте `pashkovsky-group.com/admin/deals` → должно редиректить на `crm.pashkovsky-group.com/admin/deals`

## Локальная разработка

Для тестирования на локальной машине добавьте в `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 crm.localhost
```

Затем запустите:
```bash
npm run dev
```

И откройте `http://crm.localhost:3000` - должно работать как поддомен.

## Важные замечания

1. **SSL сертификат**: Vercel автоматически выдаст SSL для поддомена. Для других хостингов может потребоваться настройка SSL сертификата (Let's Encrypt).

2. **Переменные окружения**: Убедитесь, что все переменные окружения (`.env`) доступны на поддомене.

3. **Кэширование**: После настройки DNS может потребоваться очистить кэш браузера.

4. **Безопасность**: Админка теперь доступна только через поддомен `crm.*`, что добавляет дополнительный уровень безопасности.

## Структура URL после настройки

- ✅ `crm.pashkovsky-group.com/admin/deals` - работает
- ✅ `crm.pashkovsky-group.com/admin/leads` - работает
- ✅ `crm.pashkovsky-group.com/admin/ai-chats` - работает
- ❌ `pashkovsky-group.com/admin/deals` - редирект на `crm.pashkovsky-group.com/admin/deals`
- ✅ `pashkovsky-group.com/he` - основной сайт работает как обычно

