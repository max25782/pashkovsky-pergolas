# ✅ Проверка: Block Public Access отредактирован

## Текущий статус

Вижу что Block Public Access был успешно отредактирован (зеленый баннер в Console).

## Что проверить дальше

### 1. Проверить Bucket Policy

В AWS Console:
1. Прокрутите вниз до раздела **"Bucket Policy"**
2. Убедитесь что политика применена:

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

Если политики нет - добавьте её (см. инструкции ниже).

### 2. Проверить доступ к файлу

Выполните в терминале:

```bash
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Должен вернуть `HTTP/1.1 200 OK` вместо `403 Forbidden`.

Или откройте в браузере:
```
https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

---

## Если Bucket Policy не применена

### Через AWS Console:

1. В разделе **"Bucket Policy"** нажмите **"Edit"**
2. Вставьте политику (см. выше)
3. Нажмите **"Save changes"**

### Через AWS CLI:

```bash
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
```

---

## После применения Bucket Policy

Проверьте доступ:

```bash
curl -I https://pashkovsky-gallery.s3.eu-north-1.amazonaws.com/images/dgamim/santa-fe/1.jpg
```

Должно вернуть `HTTP/1.1 200 OK` ✅

---

## Если всё ещё 403

Проверьте:
1. ✅ Block Public Access отключен (все галочки сняты)
2. ✅ Bucket Policy применена и видна в Console
3. ✅ Файл существует: `aws s3 ls s3://pashkovsky-gallery/images/dgamim/santa-fe/`

Пришлите скриншот раздела "Bucket Policy" из AWS Console - помогу найти проблему!

