# 🔒 Пошаговое решение: Access Denied для S3

## Текущая проблема

Всё ещё получаете `Access Denied` даже после применения Bucket Policy.

## ✅ Пошаговое решение через AWS Console

### Шаг 1: Откройте настройки bucket

1. Откройте: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions

### Шаг 2: Отключите Block Public Access (КРИТИЧНО!)

1. Найдите раздел **"Block Public Access settings for this bucket"**
2. Нажмите кнопку **"Edit"**
3. **Снимите ВСЕ 4 галочки:**
   - ❌ "Block all public access"
   - ❌ "Block public access to buckets and objects granted through new access control lists (ACLs)"
   - ❌ "Block public access to buckets and objects granted through any access control lists (ACLs)"
   - ❌ "Block public access to buckets and objects granted through new public bucket or access point policies"
   - ❌ "Restrict public access to buckets and objects granted through new and existing public bucket or access point policies"

4. Нажмите **"Save changes"**
5. В поле подтверждения введите: **`confirm`**
6. Нажмите **"Confirm"**

**⚠️ ВАЖНО:** Нужно снять ВСЕ галочки, иначе доступ будет заблокирован!

### Шаг 3: Примените Bucket Policy

1. В том же разделе найдите **"Bucket Policy"**
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

### Шаг 4: Проверьте Object Ownership

1. В разделе **"Object Ownership"**
2. Должно быть: **"Bucket owner enforced"** (это нормально)
3. Если нет - нажмите "Edit" и выберите "Bucket owner enforced"

### Шаг 5: Проверьте доступ

Откройте в браузере:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Должно открыться изображение! ✅

---

## Альтернатива: Через AWS CLI

Если хотите попробовать через CLI:

```bash
# 1. Полностью отключить Block Public Access
aws s3api delete-public-access-block --bucket pashkovsky-gallery

# 2. Применить Bucket Policy
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

aws s3api put-bucket-policy --bucket pashkovsky-gallery --policy file:///tmp/bucket-policy.json

# 3. Проверить
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

---

## Если всё ещё не работает

Проверьте:
1. ✅ Block Public Access полностью отключен (все 4 галочки сняты)
2. ✅ Bucket Policy применена и видна в Console
3. ✅ Файл существует: `aws s3 ls s3://pashkovsky-gallery/images/dgamim/santa-fe/`

Пришлите скриншот раздела "Block Public Access settings" из AWS Console - помогу найти что не так!

