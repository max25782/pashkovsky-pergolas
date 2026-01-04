# 🚨 КРИТИЧНО: AWS Ключи в Git истории

## Проблема

GitHub заблокировал push из-за AWS ключей в коммите `a14a4ebf28cab22f88f8abc04f3a850588a778e4`:

```
AWS_ACCESS_KEY_ID=AKIA4PFZSZFMBYZSLE7L
AWS_SECRET_ACCESS_KEY=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
```

**⚠️ ЭТИ КЛЮЧИ СКОМПРОМЕТИРОВАНЫ!**

## Немедленные действия

### 1. Отзови AWS ключи (СРОЧНО!)

1. Открой **AWS Console** → IAM → Users
2. Найди пользователя с ключом `AKIA4PFZSZFMBYZSLE7L`
3. **Удали (Deactivate) этот Access Key**
4. **Создай новые ключи**
5. Обнови их в Vercel Environment Variables

### 2. Варианты решения git push

#### Вариант А: Разреши push через GitHub (быстрый)

GitHub предлагает временно разрешить push. Открой ссылки:
- https://github.com/max25782/pashkovsky-pergolas/security/secret-scanning/unblock-secret/37nvrExgwAl5IzHyq6hws9wgzrL
- https://github.com/max25782/pashkovsky-pergolas/security/secret-scanning/unblock-secret/37nvrHX4WSUZAbiwFRohU04dspE

Нажми **"Allow secret"** (только ПОСЛЕ того как отозвал ключи в AWS!)

Затем:
```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter
git push
```

#### Вариант Б: Полностью очисти историю (правильный, но долгий)

```bash
cd /Users/user/Downloads/pashkovsky-pergolas_starter

# Установи git-filter-repo (если нет)
brew install git-filter-repo

# Удали файл из всей истории
git filter-repo --path apps/site/VERCEL_DEPLOY.md --invert-paths

# Восстанови файл в актуальной версии (без ключей)
git checkout HEAD apps/site/VERCEL_DEPLOY.md

# Коммит и push
git add apps/site/VERCEL_DEPLOY.md
git commit -m "docs: restore VERCEL_DEPLOY.md without secrets"
git push --force
```

#### Вариант В: Новый коммит с BFG Repo-Cleaner

```bash
# Скачай BFG
brew install bfg

# Создай файл со старыми ключами
echo "AKIA4PFZSZFMBYZSLE7L" > secrets.txt
echo "9HWJmDZMyon6igmSbqI0h8MvzTDtiUNOPFvFD5du" >> secrets.txt

# Очисти репозиторий
cd /Users/user/Downloads/pashkovsky-pergolas_starter
bfg --replace-text secrets.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Push
git push --force
```

## Проверка безопасности

После отзыва ключей проверь:

1. **AWS CloudTrail** - были ли несанкционированные действия с этими ключами?
2. **S3 Bucket** `pashkovsky-gallery` - не изменено ли содержимое?
3. **Billing** - нет ли неожиданных расходов?

## Профилактика на будущее

1. **Никогда** не коммить реальные секреты
2. Используй `.env.local` (в `.gitignore`)
3. В документации используй плейсхолдеры: `your_key_here`
4. Для чувствительных данных используй environment variables

---

**Статус**: Файл исправлен локально, но push заблокирован  
**Действие**: Сначала отзови ключи в AWS, потом используй один из вариантов выше

