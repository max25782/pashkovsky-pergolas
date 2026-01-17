# 🔍 Диагностика: Почему всё ещё 403 Forbidden

## Проверка текущих настроек

Выполните команды для диагностики:

```bash
# 1. Проверить Block Public Access
aws s3api get-public-access-block --bucket pashkovsky-gallery

# 2. Проверить Bucket Policy
aws s3api get-bucket-policy --bucket pashkovsky-gallery

# 3. Проверить что файл существует
aws s3 ls s3://pashkovsky-gallery/images/dgamim/santa-fe/
```

---

## Решение через AWS Console (Рекомендуется)

Если CLI не работает, используйте AWS Console:

### Шаг 1: Отключить Block Public Access

1. **Откройте:** https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions
2. **Найдите:** "Block Public Access settings"
3. **Нажмите:** "Edit"
4. **Снимите галочки:**
   - ✅ "Block public access to buckets and objects granted through new public bucket or access point policies"
   - ✅ "Restrict public access to buckets and objects granted through new and existing public bucket or access point policies"
5. **Оставьте включенными:**
   - ✅ "Block public access to buckets and objects granted through new access control lists (ACLs)"
   - ✅ "Block public and cross-account access to buckets and objects through any access control lists (ACLs)"
6. **Нажмите:** "Save changes"
7. **Подтвердите:** Введите `confirm` в поле

### Шаг 2: Применить Bucket Policy

1. **В том же разделе:** "Bucket Policy"
2. **Нажмите:** "Edit"
3. **Вставьте:**

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

4. **Нажмите:** "Save changes"

### Шаг 3: Проверить

Откройте в браузере:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Должно открыться изображение! ✅

---

## Если всё ещё не работает

Проверьте:
1. ✅ Bucket Policy применена (должна быть видна в Console)
2. ✅ Block Public Access отключен для Policy (но включен для ACL)
3. ✅ Файл существует (проверьте через `aws s3 ls`)

Пришлите скриншот настроек из AWS Console - помогу найти проблему!

