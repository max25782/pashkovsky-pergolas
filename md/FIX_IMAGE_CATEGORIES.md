# Исправление категорий изображений в S3

## Проблема
Все изображения находятся в папке `images/pergulot/`, но нужно, чтобы они отображались в других категориях:
- `rails` (מעקות)
- `mestor` (מסתורי כביסה)
- `windows` (חלונות)
- `gates` (שערים)

## Решения

### Вариант 1: Импорт существующих изображений из S3 в базу данных

Если изображения уже распределены по правильным папкам в S3, но отсутствуют в базе данных:

```powershell
# Импорт изображений из категории rails
npm run import:s3-to-db images/rails/

# Импорт изображений из категории mestor
npm run import:s3-to-db images/mestor/

# Импорт всех изображений из всех категорий
npm run import:s3-to-db images/
```

---

### Вариант 2: Пакетное перемещение изображений между категориями

Если все изображения в одной категории (`pergulot`), и нужно переместить их в другие категории:

```powershell
# Переместить ВСЕ изображения из pergulot в rails
npm run move:s3 pergulot rails

# Переместить изображения, содержащие "mestor" в имени файла
npm run move:s3 pergulot mestor "mestor"

# Переместить изображения, содержащие "rail" в имени файла
npm run move:s3 pergulot rails "rail"
```

**Что делает скрипт:**
1. Находит изображения в исходной категории
2. Перемещает их в S3 (из `images/pergulot/` в `images/rails/`)
3. Обновляет записи в базе данных (`category_key`, `url`, `storage_path`)

---

### Вариант 3: Интерактивная реорганизация (по одному изображению)

Если нужно вручную выбрать категорию для каждого изображения:

```powershell
npm run reorganize:s3
```

Скрипт покажет каждое изображение и спросит, в какую категорию его переместить.

**Пример:**
```
[1/150] images/pergulot/railing-1.jpg
  Target category (current: pergulot): rails
  ✅ Moved: pergulot → rails

[2/150] images/pergulot/mestor-blue.webp
  Target category (current: pergulot): mestor
  ✅ Moved: pergulot → mestor

[3/150] images/pergulot/gate-white.jpg
  Target category (current: pergulot): gates
  ✅ Moved: pergulot → gates
```

**Команды:**
- Введите название категории (например, `rails`)
- `Enter` - пропустить изображение
- `s` - пропустить все оставшиеся
- `l` - показать список доступных категорий
- `q` - выйти

---

## Проверка доступных категорий

Чтобы увидеть, какие категории есть в базе данных:

```powershell
npm run reorganize:s3
```

Скрипт покажет список:
```
Available categories:
  - pergulot (פרגולות)
  - rails (מעקות)
  - mestor (מסתורי כביסה)
  - windows (חלונות)
  - gates (שערים)
```

---

## Рекомендуемый подход

### Шаг 1: Проверьте структуру в S3

Зайдите в AWS S3 консоль и посмотрите:
- Есть ли папки `images/rails/`, `images/mestor/`, и т.д.?
- Или все изображения в `images/pergulot/`?

### Шаг 2a: Если изображения УЖЕ распределены по папкам

Просто импортируйте их в базу данных:

```powershell
npm run import:s3-to-db images/
```

### Шаг 2b: Если все изображения в `pergulot`

Используйте пакетное перемещение с паттернами имен файлов:

```powershell
# Переместить все изображения с "rail" или "railing" в имени
npm run move:s3 pergulot rails "rail"

# Переместить все изображения с "mestor" в имени
npm run move:s3 pergulot mestor "mestor"

# Переместить все изображения с "gate" в имени
npm run move:s3 pergulot gates "gate"

# Переместить все изображения с "window" в имени
npm run move:s3 pergulot windows "window"
```

### Шаг 3: Проверьте результат

Откройте страницы:
- `http://localhost:3000/he/railings` - должны появиться изображения мעקות
- `http://localhost:3000/he/mistora` - должны появиться изображения מסתורי כביסה

---

## Важно

- ⚠️ **Резервная копия:** Скрипты изменяют S3 и базу данных. Убедитесь, что у вас есть backup.
- ⚠️ **Движение, не копирование:** Скрипты ПЕРЕМЕЩАЮТ изображения (удаляют из исходной папки).
- ✅ **Безопасность:** Скрипты проверяют существование категорий перед перемещением.
- ✅ **База данных:** Автоматически обновляются URL и `category_key` в `gallery_images`.

---

## Устранение проблем

### Изображения не появляются на странице

1. Проверьте, что изображения есть в базе данных:
   ```sql
   SELECT category_key, COUNT(*) FROM gallery_images GROUP BY category_key;
   ```

2. Проверьте URL изображений:
   ```sql
   SELECT url FROM gallery_images WHERE category_key = 'rails' LIMIT 5;
   ```

3. URL должны выглядеть так:
   ```
   https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/rails/filename.webp
   ```

### Категория не найдена

Проверьте, что категория существует:
```sql
SELECT * FROM gallery_categories WHERE key = 'rails';
```

Если категории нет, создайте её через миграцию или админку.


