# 🔐 Auth Pages Guide

## Страницы аутентификации

### 📍 Где находятся страницы:

1. **Регистрация:** `http://localhost:3000/[locale]/auth/register`
   - Например: `http://localhost:3000/he/auth/register`
   - Или: `http://localhost:3000/en/auth/register`

2. **Логин:** `http://localhost:3000/[locale]/auth/login`
   - Например: `http://localhost:3000/he/auth/login`

3. **Сброс пароля:** `http://localhost:3000/[locale]/auth/reset-password`
   - Запрос: `http://localhost:3000/he/auth/reset-password`
   - Подтверждение: `http://localhost:3000/he/auth/reset-password?token=...&email=...`

4. **Подтверждение email:** `http://localhost:3000/[locale]/auth/verify-email`
   - С токеном: `http://localhost:3000/he/auth/verify-email?token=...&email=...`

5. **Admin Panel:** `http://localhost:3000/[locale]/admin`
   - Поддерживает:
     - JWT токены (из логина/регистрации)
     - Admin token (legacy)

---

## 🚀 Как использовать:

### 1. Регистрация нового пользователя:

1. Перейди на: `http://localhost:3000/he/auth/register`
2. Заполни форму:
   - Email
   - Full Name
   - Company Name
   - Industry
   - Password (минимум 8 символов, с заглавными, строчными и цифрами)
   - Confirm Password
3. Нажми "Create Account"
4. Проверь email для подтверждения
5. После регистрации автоматически перенаправит в Admin Panel

### 2. Логин:

1. Перейди на: `http://localhost:3000/he/auth/login`
2. Введи email и password
3. Нажми "Sign In"
4. Автоматически перенаправит в Admin Panel

### 3. Сброс пароля:

1. Перейди на: `http://localhost:3000/he/auth/reset-password`
2. Введи email
3. Проверь email для получения ссылки
4. Перейди по ссылке из email
5. Установи новый пароль

### 4. Подтверждение email:

1. После регистрации проверь email
2. Перейди по ссылке из email
3. Или перейди на: `http://localhost:3000/he/auth/verify-email?token=...&email=...`

---

## 📁 Структура файлов:

```
app/[locale]/auth/
├── register/
│   └── page.tsx          ✅ Страница регистрации
├── login/
│   └── page.tsx           ✅ Страница логина
├── reset-password/
│   └── page.tsx           ✅ Страница сброса пароля
└── verify-email/
    └── page.tsx           ✅ Страница подтверждения email

app/[locale]/admin/
└── page.tsx               ✅ Обновлена - поддерживает JWT и admin token
```

---

## 🔄 Flow регистрации:

```
1. Пользователь → /auth/register
2. Заполняет форму → POST /api/auth/register
3. Создаётся user + company + JWT token
4. Отправляется verification email
5. Пользователь → Admin Panel (с JWT токеном)
6. Пользователь подтверждает email из письма
7. Email verified ✅
```

---

## 🔄 Flow логина:

```
1. Пользователь → /auth/login
2. Вводит email/password → POST /api/auth/login
3. Проверка пароля
4. Генерация JWT access token + refresh token
5. Сохранение токенов в localStorage
6. Пользователь → Admin Panel
```

---

## 🔄 Flow сброса пароля:

```
1. Пользователь → /auth/reset-password
2. Вводит email → POST /api/auth/password-reset/request
3. Отправляется email с reset токеном
4. Пользователь переходит по ссылке → /auth/reset-password?token=...&email=...
5. Вводит новый пароль → POST /api/auth/password-reset/confirm
6. Пароль обновлён ✅
7. Перенаправление на логин
```

---

## 🎨 Дизайн:

Все страницы используют единый стиль:
- Темный фон (gray-900 → gray-950)
- Белый текст
- Синие акцентные кнопки
- Скругленные формы
- Адаптивный дизайн

---

## 🔗 Ссылки на страницы:

### Hebrew (עברית):
- Регистрация: `http://localhost:3000/he/auth/register`
- Логин: `http://localhost:3000/he/auth/login`
- Сброс пароля: `http://localhost:3000/he/auth/reset-password`
- Подтверждение email: `http://localhost:3000/he/auth/verify-email`

### English:
- Регистрация: `http://localhost:3000/en/auth/register`
- Логин: `http://localhost:3000/en/auth/login`

### Russian:
- Регистрация: `http://localhost:3000/ru/auth/register`
- Логин: `http://localhost:3000/ru/auth/login`

---

**Готово! Теперь у тебя есть полная система аутентификации с UI!** 🎉



