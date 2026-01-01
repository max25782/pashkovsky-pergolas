# 📧 Настройка Zoho Mail для отправки предложений

## ✅ Почему Zoho Mail идеален для твоей CRM

- ✅ Стабильный и надежный SMTP
- ✅ Бесплатный для малого бизнеса
- ✅ Работает с Nodemailer
- ✅ Профессиональный email (office@pashkovsky-group.com)
- ✅ Можно отправлять PDF, ссылки, счета

---

## 🚀 Быстрая настройка (5 минут)

### Шаг 1: Получите App Password в Zoho

1. **Откройте [Zoho Mail](https://mail.zoho.com)**
2. **Вправо сверху → Profile → My Account**
3. **Security → App Passwords**
4. **Generate New Password:**
   - Имя: `CRM Email`
   - Нажмите **Generate**
5. **Скопируйте 16-значный пароль** (он показывается один раз!)

⚠️ **ВАЖНО:** Это НЕ обычный пароль от email! Это специальный App Password для сторонних приложений.

---

### Шаг 2: Добавьте переменные в `.env`

Откройте файл `.env` (или `.env.local`) и добавьте:

```env
# Zoho Mail SMTP Configuration
EMAIL_HOST=smtp.zoho.com
EMAIL_PORT=465
EMAIL_USER=office@pashkovsky-group.com
EMAIL_PASS=your_16_digit_app_password_here
EMAIL_FROM="Pashkovsky Group <office@pashkovsky-group.com>"
```

**Замените:**
- `office@pashkovsky-group.com` → ваш реальный Zoho email
- `your_16_digit_app_password_here` → App Password из Шага 1

---

### Шаг 3: Перезапустите сервер

```bash
npm run dev
```

При запуске вы должны увидеть в консоли:
```
✅ Email transporter is ready to send messages
```

Если видите ошибку - проверьте email/пароль в `.env`.

---

## 📨 Как использовать

### 1. Отправка предложения клиенту

В CRM:
1. Откройте список предложений сделки
2. Нажмите кнопку **"Email"**
3. Введите email клиента
4. Готово! Клиент получит красивое письмо со ссылкой

### 2. Что получает клиент

Красивое HTML письмо с:
- 📧 Заголовок "Pashkovsky Group"
- 💬 Персональное приветствие
- 🔗 Кнопка "צפה בהצעת המחיר"
- 📱 Адаптивный дизайн (хорошо смотрится на телефоне)

### 3. После клика

Клиент попадает на:
```
https://your-domain.com/offers/[id]/approve
```

Где может:
- Посмотреть все детали предложения
- Ввести имя и телефон
- Расписаться
- Подтвердить

---

## 🔧 Дополнительные настройки (опционально)

### Изменить отправителя

В `.env`:
```env
EMAIL_FROM="Имя Фамилия <office@pashkovsky-group.com>"
```

### Изменить порт (если нужно)

```env
EMAIL_PORT=587  # TLS вместо SSL
```

Но для Zoho лучше оставить **465 (SSL)**.

---

## 🎨 Кастомизация шаблона email

Отредактируйте функцию `generateOfferEmailHTML` в `lib/email.ts`:

```typescript
export function generateOfferEmailHTML(offerUrl: string, customerName: string) {
  return `
    <!-- Ваш HTML шаблон -->
    <h1>Привет ${customerName}!</h1>
    <a href="${offerUrl}">Открыть предложение</a>
  `
}
```

Можете добавить:
- Логотип компании
- Контакты
- Ссылки на соцсети
- Промо-акции

---

## ✅ Тестирование

### 1. Отправьте тестовое письмо себе

1. Создайте предложение в CRM
2. Нажмите **"Email"**
3. Введите **свой** email
4. Проверьте:
   - Письмо пришло?
   - Ссылка работает?
   - Дизайн корректный?

### 2. Проверьте лог в консоли

В терминале сервера должно быть:
```
✅ Email sent: <message-id>
```

Если ошибка - проверьте:
- App Password правильный
- Email в `.env` совпадает с Zoho
- Нет лишних пробелов в `.env`

---

## 🐛 Возможные проблемы

### Ошибка: "Invalid login"

**Причина:** Неправильный App Password или email

**Решение:**
1. Проверьте `EMAIL_USER` в `.env`
2. Создайте новый App Password в Zoho
3. Убедитесь, что нет пробелов в `.env`

### Ошибка: "Email configuration is missing"

**Причина:** `.env` не загружен

**Решение:**
1. Проверьте, что `.env` существует
2. Перезапустите сервер
3. Проверьте `console.log(process.env.EMAIL_USER)` в API

### Письма не приходят

**Причина:** Могут попасть в спам

**Решение:**
1. Проверьте папку "Спам"
2. Добавьте отправителя в белый список
3. Настройте SPF/DKIM в Zoho (для production)

---

## 🚀 Production настройки (для будущего)

Когда будете деплоить на Vercel:

### 1. Добавьте переменные в Vercel Dashboard

**Settings → Environment Variables:**

```
EMAIL_HOST=smtp.zoho.com
EMAIL_PORT=465
EMAIL_USER=office@pashkovsky-group.com
EMAIL_PASS=your_app_password
EMAIL_FROM="Pashkovsky Group <office@pashkovsky-group.com>"
```

### 2. Настройте SPF и DKIM в Zoho

Для надежной доставки:
- **SPF запись** - добавьте в DNS
- **DKIM подпись** - настройте в Zoho
- **DMARC** - опционально, но рекомендуется

Инструкции: [Zoho Mail → Domain Settings → Email Authentication](https://www.zoho.com/mail/help/adminconsole/email-authentication.html)

---

## 📊 Что уже реализовано

### ✅ Модуль отправки email

- `lib/email.ts` - транспорт и шаблоны
- `app/api/offers/[id]/send-email/route.ts` - API endpoint
- `components/offers/OffersList.tsx` - кнопка Email

### ✅ Функции

- Отправка предложения по email
- Красивый HTML шаблон
- Валидация email
- Обработка ошибок
- Логирование

### ✅ Безопасность

- App Password (не обычный пароль)
- SSL соединение (port 465)
- Переменные в `.env` (не в коде!)

---

## 🎉 Готово!

После настройки:
1. ✅ Выполните миграцию БД (`update_offers_v3_final.sql`)
2. ✅ Добавьте Zoho credentials в `.env`
3. ✅ Перезапустите сервер
4. ✅ Отправьте тестовое письмо себе
5. ✅ Наслаждайтесь! 🚀

---

## 💡 Дополнительные возможности (идеи)

- 📄 Прикреплять PDF предложения
- 📊 Отправлять счета
- 📅 Напоминания о встречах
- ✅ Уведомления о подписанных предложениях
- 📈 Отчеты менеджерам
- 🎉 Поздравления с завершением проекта

Все это можно сделать через тот же `lib/email.ts`!

