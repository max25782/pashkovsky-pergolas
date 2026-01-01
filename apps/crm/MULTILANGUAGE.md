# Мультиязычность AluminCRM (3 языка: Hebrew, Russian, English)

## ✅ Готово

### 1. Контекст языка
- `apps/crm/lib/language-context.tsx` - уже создан
- Поддерживает: `he`, `ru`, `en`
- Сохраняет выбор в `localStorage`

### 2. Переключатель языков
- `apps/crm/components/admin/LanguageSwitcher.tsx` - уже создан
- Флаги: 🇮🇱 🇷🇺 🇬🇧

### 3. Файлы переводов (НОВЫЕ)
Созданы файлы переводов:
- `apps/crm/lib/translations/common.ts` - общие тексты (кнопки, статусы)
- `apps/crm/lib/translations/company-settings.ts` - настройки компании
- `apps/crm/lib/translations/platform-settings.ts` - настройки платформы

### 4. Обновлённые страницы
✅ **Company Settings** (`/app/settings/company`) - полностью на 3 языках

## 🔄 Как использовать

### В любом Client Component:

```typescript
'use client'

import { useLanguage } from '@/lib/language-context'
import { LanguageSwitcher } from '@/components/admin/LanguageSwitcher'
import { commonTranslations } from '@/lib/translations/common'

export default function MyPage() {
  const { language } = useLanguage()
  const t = commonTranslations[language]
  
  return (
    <div>
      <LanguageSwitcher />
      <h1>{t.title}</h1>
      <button>{t.save}</button>
    </div>
  )
}
```

### Добавить переводы для новой страницы:

1. Создайте файл в `apps/crm/lib/translations/my-page.ts`:

```typescript
export const myPageTranslations = {
  en: {
    title: 'My Page',
    subtitle: 'Page description',
    buttonSave: 'Save Changes',
  },
  he: {
    title: 'הדף שלי',
    subtitle: 'תיאור הדף',
    buttonSave: 'שמור שינויים',
  },
  ru: {
    title: 'Моя страница',
    subtitle: 'Описание страницы',
    buttonSave: 'Сохранить изменения',
  },
}
```

2. Используйте в компоненте:

```typescript
import { myPageTranslations } from '@/lib/translations/my-page'

const { language } = useLanguage()
const t = myPageTranslations[language]
```

## 📝 TODO: Добавить переводы для

- [ ] SuperAdmin Dashboard
- [ ] SuperAdmin Settings (Platform)
- [ ] Login/Register pages
- [ ] Statistics page
- [ ] Deals page
- [ ] Leads page
- [ ] Offers page
- [ ] Workers page
- [ ] Materials page

## 🎨 Дизайн переключателя

Текущий дизайн (в `LanguageSwitcher.tsx`):
- Флаги + текст (на больших экранах)
- Только флаги (на мобильных)
- Синий фон для активного языка
- Полупрозрачный фон для других

## 🌍 Направление текста (RTL/LTR)

- **Hebrew (he)**: RTL (справа налево) ✅
- **Russian (ru)**: LTR (слева направо)
- **English (en)**: LTR (слева направо)

При необходимости добавьте в layout:
```typescript
<html lang={language} dir={language === 'he' ? 'rtl' : 'ltr'}>
```

## 🚀 Быстрый старт

1. Перезапустите dev сервер
2. Откройте `/app/settings/company`
3. Используйте переключатель языков в правом верхнем углу
4. Язык сохраняется автоматически

