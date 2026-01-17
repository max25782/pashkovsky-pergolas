# 🚀 Правильная команда для деплоя

## Вы уже в правильной директории! ✅

Вы находитесь в `/Users/user/Downloads/pashkovsky-pergolas_starter/apps/site`

## Правильная команда:

### Для Production деплоя:
```bash
vercel --prod
```

### Или для Preview деплоя (тестирование):
```bash
vercel
```

---

## Что произойдёт:

1. Vercel CLI спросит: **"Link to existing project?"** → **Yes**
2. Выберите проект: `pashkovsky-pergolas` (или ваш проект)
3. Спросит: **"Override settings?"** → **Yes**
4. **Build Command:** `cd ../.. && npm install --production=false && npx turbo run build --filter=@pashkovsky/site`
5. **Output Directory:** `.next`
6. **Install Command:** `cd ../.. && npm install --production=false`
7. Деплой начнётся автоматически

---

## Если проект не существует:

1. **"Link to existing project?"** → **No**
2. **Project name:** `pashkovsky-site`
3. **In which directory is your code located:** `./`
4. **Override settings:** **Yes**
5. Введите те же команды что выше

---

## Быстрая команда (копируйте целиком):

```bash
vercel --prod
```

Или если хотите сначала протестировать:

```bash
vercel
```

---

## После деплоя:

Проверьте URL который покажет Vercel CLI (например, `https://pashkovsky-site-xxx.vercel.app`)

