# 🔒 Исправление: Bucket не поддерживает ACL

## Проблема

```
AccessControlListNotSupported: The bucket does not allow ACLs
```

Bucket настроен с "Block Public ACLs" или "Object Ownership" = "Bucket owner enforced", поэтому ACL не работает.

## Решение: Использовать Bucket Policy

### Шаг 1: Откройте AWS S3 Console

1. Откройте: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions

### Шаг 2: Настройте Bucket Policy

1. **Перейдите в раздел:** "Bucket Policy"
2. **Нажмите:** "Edit"
3. **Вставьте следующую политику:**

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

### Шаг 3: Проверьте Block Public Access

1. **Перейдите в:** "Block Public Access settings"
2. **Нажмите:** "Edit"
3. **Отключите:** "Block public access to buckets and objects granted through new access control lists (ACLs)"
4. **Оставьте включенным:** "Block public access to buckets and objects granted through any access control lists (ACLs)" - это нормально, мы используем Bucket Policy, не ACL
5. **Нажмите:** "Save changes"

---

## Альтернатива: Через AWS CLI

Если хотите настроить через CLI:

```bash
# Создайте файл bucket-policy.json
cat > /tmp/bucket-policy.json << 'EOF'
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
EOF

# Примените политику
aws s3api put-bucket-policy \
  --bucket pashkovsky-gallery \
  --policy file:///tmp/bucket-policy.json
```

---

## После настройки

Проверьте что файл доступен:

```bash
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Должен вернуть `HTTP/1.1 200 OK` вместо `403 Forbidden`.

Или откройте в браузере:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Должно открыться изображение без ошибки "Access Denied".

---

## Почему это лучше чем ACL?

- ✅ Bucket Policy - современный способ управления доступом
- ✅ Работает даже когда ACL заблокированы
- ✅ Легче управлять (одна политика для всего bucket)
- ✅ Более безопасно (можно настроить детальные правила)

---

## Если всё ещё не работает

Проверьте:
1. **Object Ownership:** Должно быть "Bucket owner enforced" (это нормально)
2. **Block Public Access:** Должен быть отключен для "new ACLs" (но это не важно если используете Bucket Policy)
3. **Bucket Policy:** Должна быть применена правильно

Если проблема сохраняется - пришлите скриншот настроек Bucket Policy из AWS Console.

