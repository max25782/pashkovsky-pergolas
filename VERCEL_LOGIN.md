# 🔐 Vercel CLI Login Guide

## Проблема

```
Error: The specified token is not valid. Use `vercel login` to generate a new token.
```

## Решение

### Шаг 1: Логин в Vercel CLI

```bash
vercel login
```

Это откроет браузер для авторизации.

### Шаг 2: После успешного логина

Выполните деплой:

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site
vercel --prod
```

---

## Альтернатива: Использовать токен напрямую

Если браузер не открывается:

1. **Получите токен из Vercel Dashboard:**
   - Откройте https://vercel.com/account/tokens
   - Создайте новый токен (или используйте существующий)
   - Скопируйте токен

2. **Установите токен:**
   ```bash
   vercel login --token YOUR_TOKEN_HERE
   ```

3. **Задеплойте:**
   ```bash
   cd /Users/user/Downloads/pashkovsky-pergolas_starter/apps/site
   vercel --prod
   ```

---

## После успешного логина

Vercel CLI запомнит ваш токен и больше не будет просить логин (пока токен не истечёт).

---

## Проверка что логин успешен

```bash
vercel whoami
```

Должно показать ваш email/username.

