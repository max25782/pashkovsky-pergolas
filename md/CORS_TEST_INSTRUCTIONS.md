# 🧪 CORS Тестирование

## Статус: S3 настроен правильно ✅

CORS проверен через curl/PowerShell - работает:
```
✅ Access-Control-Allow-Origin: *
✅ Access-Control-Allow-Methods: GET, HEAD
✅ Preflight (OPTIONS) работает
✅ Bucket Policy: публичный доступ
✅ Public Access Block: отключен
```

---

## 🔴 Проблема: Браузер все еще показывает CORS ошибки

Возможные причины:
1. **Vercel deploy еще не завершен** (подожди 5-10 минут)
2. **Vercel CDN закешировал старые ответы**
3. **Next.js ISR не обновил страницу**
4. **Страница была pre-rendered до обновления CORS**

---

## ✅ Тесты для выполнения

### Тест 1: Прямой доступ к файлу
1. Открой в **новой вкладке инкогнито**:
   ```
   https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/IMG_20250109_130237.jpg
   ```

2. Файл должен **открыться**

3. Нажми `F12` → вкладка **Network** → обнови `F5`

4. Кликни на запрос `IMG_20250109_130237.jpg`

5. **Response Headers** должны содержать:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, HEAD
   Content-Type: image/jpeg
   ```

**Если видишь эти заголовки** - S3 работает правильно ✅

---

### Тест 2: Обход кеша с query параметром
Открой в инкогнито:
```
https://www.pashkovsky-group.com/he/railings?nocache=1
```

Query параметр `?nocache=1` заставит Next.js пропустить кеш.

---

### Тест 3: Подожди деплой Vercel
1. Открой: https://vercel.com/dashboard
2. Найди последний deployment
3. Дождись статуса: **"Ready"** или **"Success"**
4. Обычно занимает **3-5 минут**

После завершения деплоя:
- Открой: `https://www.pashkovsky-group.com/he/railings`
- Нажми: `Ctrl + Shift + R`

---

## 🕐 Временная шкала

| Время | Действие |
|---|---|
| 20:51 | Обновлены CORS metadata для 830+ файлов ✅ |
| 20:51 | Обновлена CORS policy на bucket ✅ |
| 20:52 | Обновлен Content-Type для 813 файлов ✅ |
| 20:53 | Push на GitHub ✅ |
| 20:53-20:58 | Vercel deploy (⏳ ~5 минут) |
| 20:58+ | Проверка в браузере |

**Сейчас:** Подожди еще 2-3 минуты для деплоя

---

## 🎯 Ожидаемый результат после деплоя

### ✅ Должно работать:
```
https://www.pashkovsky-group.com/he/railings
https://www.pashkovsky-group.com/he/fences
https://www.pashkovsky-group.com/he/mistora
https://www.pashkovsky-group.com/he/windows
```

### ✅ В консоли (F12):
- Нет CORS ошибок
- Все картинки загружаются
- `Access-Control-Allow-Origin: *` в Response Headers

---

## 🔧 Если через 5 минут не работает

### План Б: Принудительный revalidate

Создать API endpoint для очистки кеша:
```
GET /api/revalidate?secret=XXX&path=/he/railings
```

Это заставит Next.js пересобрать страницу.

---

## 📊 Текущий статус

```
✅ S3 CORS configuration: DONE
✅ S3 Bucket Policy: DONE  
✅ S3 Public Access: DONE
✅ Metadata update (830+ files): DONE
✅ Content-Type fix (813 files): DONE
✅ Git push: DONE
⏳ Vercel deploy: IN PROGRESS
❓ Browser test: PENDING
```

**Подожди завершения деплоя!** ⏰



