# 🚨 QUICK FIX - CRM 500 Error

## Проблема:
```
Error: ENOENT: no such file or directory
node_modules\@supabase\supabase-js\dist\module\index.js
```

Next.js закешировал старый путь к модулю.

---

## ✅ РЕШЕНИЕ (1 минута):

### **ШАГ 1: Остановите dev server**
В терминале нажмите **`Ctrl+C`** где запущен `npm run dev`

### **ШАГ 2: Запустите скрипт перезапуска**
```powershell
.\scripts\restart-crm.ps1
```

Или вручную:
```powershell
cd apps/crm
Remove-Item .next -Recurse -Force
npm run dev
```

### **ШАГ 3: Обновите браузер**
После того как увидите:
```
✓ Ready in 3.5s
○ Local: http://localhost:3001
```

Откройте браузер и нажмите **`Ctrl+Shift+R`** (hard refresh)

---

## 🎯 ПОТОМ: Выполните миграцию

После того как CRM запустится без ошибок:

1. **Откройте Supabase SQL Editor**
2. **Скопируйте и выполните:** `supabase/MIGRATION_STEPS.sql`
3. **Зарегистрируйтесь заново:** `http://localhost:3001/register`
4. **Войдите:** `http://localhost:3001/login`

---

## 📝 Что произошло:

| Проблема | Причина | Решение |
|----------|---------|---------|
| `dist/module/index.js` not found | Next.js cache outdated | Удалили `.next` |
| 500 Internal Server Error | Old cached build | Перезапустили dev server |

---

**Остановите текущий dev server (Ctrl+C) и запустите `.\scripts\restart-crm.ps1`** 🚀

