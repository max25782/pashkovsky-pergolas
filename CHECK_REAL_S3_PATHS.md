# Проверка реальных путей в S3

## Вопрос
Какой реальный путь к файлам "santa fe" в S3 bucket `pashkovsky-gallery`?

## Варианты:
1. `images/dgamim/santa-fe/1.webp` (с дефисом, расширение .webp)
2. `images/dgamim/santa-fe/1.jpg` (с дефисом, расширение .jpg)
3. `images/dgamim/santa fe/1.webp` (с пробелом, расширение .webp)
4. `images/dgamim/santa fe/1.jpg` (с пробелом, расширение .jpg)
5. Другое?

## Как проверить:

### Вариант 1: Через AWS Console
1. Откройте: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery/images/dgamim/
2. Посмотрите, какая папка там есть: `santa-fe` или `santa fe`?
3. Откройте папку и посмотрите расширение файлов: `.webp` или `.jpg`?

### Вариант 2: Через AWS CLI
```bash
aws s3 ls s3://pashkovsky-gallery/images/dgamim/ --recursive | grep -i santa
```

### Вариант 3: Через API (если работает)
Откройте в браузере: `https://www.pashkovsky-group.com/api/gallery/models`
Или локально: `http://localhost:3000/api/gallery/models`

API вернет реальные пути из S3.

---

## После проверки
Сообщите правильный путь, и я исправлю `apps/site/data/gallery/dgamim.json`.

