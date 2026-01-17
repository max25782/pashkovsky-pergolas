# 🔒 Исправление: 403 Forbidden после применения Bucket Policy

## Проблема

После применения Bucket Policy всё ещё получаете `403 Forbidden`.

## Причина

Скорее всего **Block Public Access** блокирует публичный доступ, даже если Bucket Policy разрешает.

## Решение

### Шаг 1: Отключить Block Public Access (частично)

Выполните в терминале:

```bash
aws s3api put-public-access-block \
  --bucket pashkovsky-gallery \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

**Что это делает:**
- `BlockPublicAcls=true` - блокирует ACL (это нормально, мы используем Bucket Policy)
- `IgnorePublicAcls=true` - игнорирует ACL (это нормально)
- `BlockPublicPolicy=false` - **РАЗРЕШАЕТ** Bucket Policy (это важно!)
- `RestrictPublicBuckets=false` - **РАЗРЕШАЕТ** публичный доступ через Policy

### Шаг 2: Проверить что политика применена

```bash
aws s3api get-bucket-policy --bucket pashkovsky-gallery --query Policy --output text
```

Должна показать вашу Bucket Policy.

### Шаг 3: Проверить доступ

```bash
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Должен вернуть `HTTP/1.1 200 OK` вместо `403 Forbidden`.

---

## Альтернатива: Через AWS Console

Если CLI не работает:

1. **Откройте:** https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions

2. **Block Public Access settings:**
   - Нажмите "Edit"
   - Отключите:
     - ✅ "Block public access to buckets and objects granted through new public bucket or access point policies"
     - ✅ "Restrict public access to buckets and objects granted through new and existing public bucket or access point policies"
   - Оставьте включенными:
     - ✅ "Block public access to buckets and objects granted through new access control lists (ACLs)"
     - ✅ "Block public and cross-account access to buckets and objects through any access control lists (ACLs)"
   - Нажмите "Save changes"

3. **Проверьте Bucket Policy:**
   - Убедитесь что политика применена (см. выше)

---

## После исправления

Проверьте доступ:

```bash
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Или откройте в браузере:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Должно открыться изображение! ✅

---

## Если всё ещё 403

Проверьте:
1. ✅ Bucket Policy применена правильно
2. ✅ Block Public Access настроен правильно (см. выше)
3. ✅ Файл существует в S3 (проверьте через `aws s3 ls s3://pashkovsky-gallery/images/dgamim/santa-fe/`)

Если проблема сохраняется - пришлите вывод команды:
```bash
aws s3api get-public-access-block --bucket pashkovsky-gallery
```

