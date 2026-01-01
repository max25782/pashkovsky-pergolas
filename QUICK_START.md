# 🚀 Быстрый старт: Применить изменения AluminCRM

## ШАГ 1: Применить SQL миграции в Supabase (5 минут)

### 1. Откройте Supabase Dashboard
Перейдите: https://app.supabase.com/project/_/sql

### 2. Выполните 3 миграции ПО ПОРЯДКУ:

#### Миграция 1 (Company Profile):
```sql
Откройте файл: APPLY_MIGRATIONS_STEP1.sql
Скопируйте весь код → Вставьте в SQL Editor → Нажмите RUN
```

#### Миграция 2 (Platform Settings):
```sql
Откройте файл: APPLY_MIGRATIONS_STEP2.sql
Скопируйте весь код → Вставьте в SQL Editor → Нажмите RUN
```

#### Миграция 3 (Audit Logs):
```sql
Откройте файл: APPLY_MIGRATIONS_STEP3.sql
Скопируйте весь код → Вставьте в SQL Editor → Нажмите RUN
```

## ШАГ 2: Перезапустить dev сервер

```powershell
# В терминале нажмите Ctrl+C (остановить сервер)
# Затем запустите снова:
cd apps/crm
npm run dev
```

## ШАГ 3: Очистить кэш браузера

1. Откройте http://localhost:3001
2. Нажмите **Ctrl + Shift + R** (или Ctrl + F5)

## ✅ Проверка

После этих шагов вы увидите:

### 1. Новый логотип AluminCRM
- На странице входа: http://localhost:3001/login

### 2. Рабочие новые страницы:
- Company Settings: http://localhost:3001/app/settings/company
- Platform Settings: http://localhost:3001/superadmin/settings

### 3. Переключатель языков 🇮🇱 🇷🇺 🇬🇧
- В правом верхнем углу на странице Company Settings

### 4. Реальные данные вместо mock:
- MRR на Dashboard
- Activity Logs

## ❓ Если что-то не работает

1. **Проверьте консоль браузера** (F12) на ошибки
2. **Проверьте терминал** где запущен dev сервер
3. **Убедитесь что все 3 миграции выполнились** в Supabase

## 📸 Результат

До: "Coming soon..." на Platform Settings  
После: Полноценная страница настроек с секциями

До: Захардкоженные данные  
После: Реальный MRR и Activity Logs

