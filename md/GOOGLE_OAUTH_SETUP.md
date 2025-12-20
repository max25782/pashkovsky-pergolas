# 🔐 Google OAuth Setup Guide

## 📋 Настройка Google OAuth

### 1. Создание Google OAuth Credentials

1. Перейди в [Google Cloud Console](https://console.cloud.google.com/)
2. Создай новый проект или выбери существующий
3. Перейди в **APIs & Services** → **Credentials**
4. Нажми **Create Credentials** → **OAuth client ID**
5. Выбери **Web application**
6. Настрой OAuth consent screen (если ещё не настроен):
   - Выбери User Type (External или Internal)
   - Заполни App name, User support email, Developer contact
   - Добавь Scopes: `email`, `profile`
   - Добавь Test users (если External)
7. В **Authorized redirect URIs** добавь:
   ```
   http://localhost:3000/api/auth/oauth/google/callback
   https://yourdomain.com/api/auth/oauth/google/callback
   ```
8. Сохрани **Client ID** и **Client Secret**

---

### 2. Настройка Environment Variables

Добавь в `.env.local`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/oauth/google/callback

# Base URL (для production)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# или для production:
# NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

### 3. Проверка настройки

После добавления переменных окружения:

1. Перезапусти dev server:
   ```bash
   npm run dev
   ```

2. Перейди на страницу логина:
   ```
   http://localhost:3000/he/auth/login
   ```

3. Должна появиться кнопка **"Continue with Google"**

---

## 🎯 Как это работает

### Flow регистрации/логина через Google:

```
1. Пользователь нажимает "Sign in with Google"
2. Редирект на Google OAuth consent screen
3. Пользователь авторизуется в Google
4. Google редиректит на /api/auth/oauth/google/callback?code=...
5. Backend обменивает code на access token
6. Получает информацию о пользователе (email, name, picture)
7. Проверяет, существует ли пользователь:
   - Если НЕТ → создаёт user + company + membership
   - Если ДА → просто логинит
8. Генерирует JWT токены
9. Редиректит на Admin Panel с токенами в URL
10. Frontend сохраняет токены в localStorage
```

---

## 🔧 API Endpoints

### `GET /api/auth/oauth/google`
Инициирует OAuth flow, редиректит на Google.

**Query параметры:**
- `redirect` (optional) - куда редиректить после успешной авторизации
- `state` (optional) - состояние для передачи через OAuth flow

**Пример:**
```
/api/auth/oauth/google?redirect=/admin
```

### `GET /api/auth/oauth/google/callback`
Обрабатывает callback от Google.

**Query параметры:**
- `code` - authorization code от Google
- `state` - состояние (может содержать redirect URL)

**После успешной авторизации:**
- Редиректит на указанный URL с токенами:
  ```
  /admin?token=...&refreshToken=...&oauth=google
  ```

---

## 🎨 UI Components

### Кнопки OAuth добавлены на:

1. **Login Page** (`/auth/login`)
   - Кнопка "Continue with Google"
   - Разделитель "Or" между email/password и OAuth

2. **Register Page** (`/auth/register`)
   - Кнопка "Sign up with Google"
   - Разделитель "Or" между формой и OAuth

---

## 🔒 Безопасность

1. **Токены передаются через URL параметры** (только при OAuth callback)
   - Frontend сразу сохраняет их в localStorage
   - URL очищается после сохранения

2. **Refresh tokens хешируются** перед сохранением в БД

3. **Email автоматически верифицируется** при OAuth (Google emails уже verified)

4. **Rate limiting** применяется к OAuth endpoints

---

## 🐛 Troubleshooting

### Ошибка: "Google OAuth not configured"
- Проверь, что `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` установлены в `.env.local`
- Перезапусти dev server

### Ошибка: "redirect_uri_mismatch"
- Проверь, что redirect URI в Google Console совпадает с `GOOGLE_REDIRECT_URI`
- Убедись, что добавил правильный URI в Authorized redirect URIs

### Ошибка: "invalid_client"
- Проверь правильность `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`
- Убедись, что OAuth consent screen настроен

### Кнопка Google не появляется
- Проверь, что `isGoogleOAuthConfigured()` возвращает `true`
- Проверь консоль браузера на ошибки

---

## 📝 Дополнительные провайдеры

Можно легко добавить другие OAuth провайдеры:

1. **GitHub OAuth:**
   - Создай `lib/auth/oauth/github.ts`
   - Создай `app/api/auth/oauth/github/route.ts`
   - Создай `app/api/auth/oauth/github/callback/route.ts`
   - Добавь кнопку в UI

2. **Facebook OAuth:**
   - Аналогично GitHub

3. **Microsoft OAuth:**
   - Аналогично GitHub

---

## ✅ Checklist

- [ ] Создан проект в Google Cloud Console
- [ ] Настроен OAuth consent screen
- [ ] Создан OAuth client ID (Web application)
- [ ] Добавлены Authorized redirect URIs
- [ ] Добавлены environment variables в `.env.local`
- [ ] Перезапущен dev server
- [ ] Протестирована регистрация через Google
- [ ] Протестирован логин через Google

---

**Готово! Google OAuth настроен и готов к использованию!** 🎉



