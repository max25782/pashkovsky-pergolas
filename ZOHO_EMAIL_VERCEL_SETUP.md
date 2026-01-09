# 📧 Настройка Zoho Mail в Vercel для отправки Magic Links

## ✅ Что добавлено

Теперь magic links **автоматически отправляются на email** через Zoho Mail:
- При создании компании (если отмечен чекбокс "Send magic login link")
- При нажатии "Send Magic Login Link" на странице компании

---

## 🚀 Настройка в Vercel (5 минут)

### Шаг 1: Получите App Password в Zoho

1. **Откройте [Zoho Mail](https://mail.zoho.com)**
2. **Вправо сверху → Profile → My Account**
3. **Security → App Passwords**
4. **Generate New Password:**
   - Имя: `CRM Email Vercel`
   - Нажмите **Generate**
5. **Скопируйте 16-значный пароль** (он показывается один раз!)

⚠️ **ВАЖНО:** Это НЕ обычный пароль от email! Это специальный App Password для сторонних приложений.

---

### Шаг 2: Добавьте переменные в Vercel

1. **Откройте Vercel Dashboard:**
   - https://vercel.com/max25782s-projects
   - Выберите проект **`crm`**

2. **Settings → Environment Variables**

3. **Добавьте следующие переменные:**

| Name | Value | Environments |
|------|-------|--------------|
| `EMAIL_HOST` | `smtp.zoho.com` | Production, Preview, Development |
| `EMAIL_PORT` | `465` | Production, Preview, Development |
| `EMAIL_USER` | `your-email@zoho.com` | Production, Preview, Development |
| `EMAIL_PASS` | `your_16_digit_app_password` | Production, Preview, Development |
| `EMAIL_FROM` | `"Your Company Name <your-email@zoho.com>"` | Production, Preview, Development |

**Пример:**
```
EMAIL_HOST=smtp.zoho.com
EMAIL_PORT=465
EMAIL_USER=office@pashkovsky-group.com
EMAIL_PASS=AbCdEfGhIjKlMnOp
EMAIL_FROM="Pashkovsky Group <office@pashkovsky-group.com>"
```

---

### Шаг 3: Redeploy

После добавления env variables:

1. **Deployments** → последний деплой
2. **"Redeploy"** (три точки справа)
3. Или сделайте новый commit:

```bash
git commit --allow-empty -m "Trigger redeploy for Zoho email"
git push origin master
```

---

## 🧪 Тестирование

### Тест 1: Send Magic Link

1. Зайдите на: `/superadmin/companies/[id]`
2. Найдите пользователя
3. Нажмите **"Send Magic Login Link"**
4. Проверьте email пользователя
5. Должно прийти письмо с темой: **"Your CRM Login Link - AluminCRM"**

### Тест 2: Create Company with Magic Link

1. Зайдите на: `/superadmin/companies`
2. Введите email: `test@example.com`
3. **Отметьте чекбокс:** "Send magic login link to email"
4. Нажмите "Create Company + Give Full Access"
5. Проверьте email `test@example.com`
6. Должно прийти письмо с magic link

---

## 📧 Формат Email

Email содержит:
- Красивый HTML шаблон
- Кнопка "Log In to CRM"
- Текстовая ссылка (на случай если кнопка не работает)
- Информация о сроке действия (1 час)

---

## 🔍 Диагностика

### Проблема: Email не отправляется

**Проверьте Vercel Logs:**
1. Vercel → Deployments → Functions → Logs
2. Ищите:
   ```
   [SendMagicLink] ✓ Email sent via Zoho
   ```
   или
   ```
   [SendMagicLink] ✗ Email send failed: ...
   ```

**Возможные причины:**

1. **EMAIL_USER/EMAIL_PASS не настроены**
   - Решение: Добавьте в Vercel Environment Variables

2. **Неправильный App Password**
   - Решение: Создайте новый App Password в Zoho

3. **Zoho блокирует SMTP**
   - Решение: Проверьте настройки безопасности в Zoho Mail

4. **Неправильный EMAIL_HOST**
   - Должен быть: `smtp.zoho.com` (не `smtp.zoho.eu` или другой)

---

### Проверка конфигурации

**В Vercel Logs должно быть при старте:**
```
✅ Email transporter is ready to send messages
```

Если видите:
```
❌ Email transporter verification failed: ...
```
→ Проверьте EMAIL_USER и EMAIL_PASS

---

## 📊 Что происходит сейчас

### При нажатии "Send Magic Login Link":

1. ✅ Генерируется magic link (Supabase)
2. ✅ Отправляется email через Zoho (если настроено)
3. ✅ Magic link показывается в UI (можно скопировать)
4. ✅ Пользователь получает email с ссылкой

### Если email не настроен:

- Magic link всё равно генерируется ✅
- Показывается в UI для копирования ✅
- Email НЕ отправляется ⚠️
- В ответе API: `email_sent: false, email_error: "Email not configured"`

---

## 🎯 Резюме

| Действие | Email отправляется? |
|----------|---------------------|
| **Send Magic Login Link** | ✅ Да (если Zoho настроен) |
| **Create Company + Send Magic Link** | ✅ Да (если чекбокс отмечен) |
| **Magic link в UI** | ✅ Всегда показывается |

---

## 📝 Environment Variables Checklist

- [ ] `EMAIL_HOST=smtp.zoho.com`
- [ ] `EMAIL_PORT=465`
- [ ] `EMAIL_USER=your-email@zoho.com`
- [ ] `EMAIL_PASS=your_app_password` (16 символов)
- [ ] `EMAIL_FROM="Company Name <email@zoho.com>"`
- [ ] Все переменные добавлены в Vercel
- [ ] Redeploy выполнен

---

**После настройки Zoho → magic links будут автоматически отправляться на email!** 🚀

