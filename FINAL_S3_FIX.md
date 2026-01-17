# 🔍 Финальная диагностика: Почему всё ещё 403

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

## ✅ Правильная последовательность действий

### Шаг 1: Полностью отключить Block Public Access

В AWS Console:
1. Откройте: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/permissions
2. **Block Public Access settings** → **Edit**
3. **Снимите ВСЕ 4 галочки:**
   - ❌ Block all public access
   - ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Restrict public access to buckets and objects granted through new and existing public bucket or access point policies
4. **Save changes** → Введите `confirm` → **Confirm**

### Шаг 2: Применить Bucket Policy

В том же разделе:
1. **Bucket Policy** → **Edit**
2. Вставьте:

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

3. **Save changes**

### Шаг 3: Подождать 1-2 минуты

AWS может потребоваться время для применения изменений.

### Шаг 4: Проверить

```bash
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

---

## Альтернатива: Полностью удалить Block Public Access через CLI

```bash
# Удалить Block Public Access полностью
aws s3api delete-public-access-block --bucket pashkovsky-gallery

# Применить Bucket Policy
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

# Проверить
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

---

## Если всё ещё не работает

Проверьте:
1. ✅ Block Public Access полностью удален (`aws s3api delete-public-access-block`)
2. ✅ Bucket Policy применена (`aws s3api get-bucket-policy`)
3. ✅ Файл существует (`aws s3 ls s3://pashkovsky-gallery/images/dgamim/santa-fe/`)

Пришлите вывод этих команд - помогу найти проблему!

