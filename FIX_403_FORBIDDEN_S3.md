# Исправление 403 Forbidden для S3 изображений

## Проблема
Изображения возвращают `403 Forbidden`:
- `https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/2.webp`
- `https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/3.webp`

## Причина
Bucket Policy либо не применена, либо Block Public Access все еще блокирует публичный доступ.

---

## Решение: Пошаговая инструкция

### Шаг 1: Отключить Block Public Access (ОБЯЗАТЕЛЬНО!)

1. Откройте: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions
2. Прокрутите до секции **"Block public access (bucket settings)"**
3. Нажмите **"Edit"**
4. **СНИМИТЕ ВСЕ 4 ЧЕКБОКСА:**
   - ❌ Block all public access
   - ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Block public and cross-account access to buckets and objects through any public bucket or access point policies
5. Нажмите **"Save changes"**
6. Подтвердите, введя `confirm` в поле

**⚠️ ВАЖНО:** Если хотя бы один чекбокс включен, Bucket Policy не будет работать!

---

### Шаг 2: Применить Bucket Policy

1. На той же странице (`/permissions`) прокрутите до секции **"Bucket policy"**
2. Нажмите **"Edit"**
3. Вставьте следующую политику:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::pashkovsky-gallery/*"
    }
  ]
}
```

4. Нажмите **"Save changes"**

---

### Шаг 3: Проверка через AWS CLI (если установлен)

```bash
# Проверить Block Public Access (все должны быть false)
aws s3api get-public-access-block --bucket pashkovsky-gallery

# Проверить Bucket Policy
aws s3api get-bucket-policy --bucket pashkovsky-gallery

# Проверить доступ к файлу
curl -I "https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/2.webp"
```

Ожидаемый результат: `HTTP/1.1 200 OK`

---

### Шаг 4: Проверка в браузере

Откройте в браузере:
- https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/2.webp
- https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/3.webp

Должны открываться как изображения (не XML с ошибкой).

---

## Альтернатива: Через AWS CLI

Если у вас настроен AWS CLI, выполните:

```bash
# 1. Отключить Block Public Access
aws s3api delete-public-access-block --bucket pashkovsky-gallery

# 2. Применить Bucket Policy
aws s3api put-bucket-policy --bucket pashkovsky-gallery --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::pashkovsky-gallery/*"
    }
  ]
}'

# 3. Проверить
curl -I "https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa%20fe/2.webp"
```

---

## Частые ошибки

### ❌ "Bucket policy allows public access, but Block Public Access is enabled"
**Решение:** Отключите все 4 чекбокса Block Public Access (Шаг 1).

### ❌ "Access Denied" даже после применения Bucket Policy
**Решение:** Убедитесь, что:
1. Все 4 чекбокса Block Public Access отключены
2. Bucket Policy применена (проверьте JSON синтаксис)
3. Регион bucket правильный (`eu-north-1`)

### ❌ Bucket Policy не сохраняется
**Решение:** Проверьте JSON синтаксис. Убедитесь, что:
- Нет лишних запятых
- Все кавычки правильные
- `Resource` содержит `/*` в конце

---

## После исправления

После применения этих настроек:
1. Изображения будут доступны публично
2. 403 Forbidden исчезнет
3. Сайт сможет загружать изображения из S3

---

## Безопасность

⚠️ **Внимание:** После этих изменений все файлы в bucket `pashkovsky-gallery` будут доступны публично по прямой ссылке. Это нормально для галереи изображений, но убедитесь, что:
- В bucket нет приватных файлов
- Вы не храните там секреты или персональные данные

