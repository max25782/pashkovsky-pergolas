# 📦 Установка AWS CLI на macOS

## Способ 1: Через Homebrew (Рекомендуется)

Если у вас установлен Homebrew:

```bash
brew install awscli
```

После установки проверьте:

```bash
aws --version
```

Должно показать версию (например, `aws-cli/2.x.x`).

---

## Способ 2: Через установщик AWS (Если нет Homebrew)

### Шаг 1: Скачать установщик

```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
```

### Шаг 2: Установить

```bash
sudo installer -pkg AWSCLIV2.pkg -target /
```

### Шаг 3: Проверить

```bash
aws --version
```

---

## Способ 3: Через pip (Python)

Если у вас установлен Python:

```bash
pip3 install awscli --upgrade --user
```

Добавьте в PATH (если нужно):

```bash
export PATH=~/.local/bin:$PATH
```

---

## После установки: Настройка

### 1. Настроить credentials:

```bash
aws configure
```

Вам понадобится:
- **AWS Access Key ID:** ваш ключ
- **AWS Secret Access Key:** ваш секрет
- **Default region:** `eu-north-1` (или ваш регион)
- **Default output format:** `json` (или `text`)

### 2. Проверить настройку:

```bash
aws s3 ls
```

Должен показать список ваших S3 buckets.

---

## Быстрое решение для вашей проблемы

После установки AWS CLI, выполните:

```bash
# Сделать файл публичным
aws s3api put-object-acl \
  --bucket pashkovsky-gallery \
  --key images/dgamim/santa-fe/1.jpg \
  --acl public-read

# Или для всех файлов в папке santa-fe
aws s3 sync s3://pashkovsky-gallery/images/dgamim/santa-fe/ \
  s3://pashkovsky-gallery/images/dgamim/santa-fe/ \
  --acl public-read
```

---

## Если нет доступа к AWS CLI

Можно сделать файл публичным через AWS Console:
1. Откройте: https://s3.console.aws.amazon.com/s3/buckets/pashkovsky-gallery
2. Перейдите в `images/dgamim/santa-fe/`
3. Выберите `1.jpg`
4. Actions → "Make public using ACL"

