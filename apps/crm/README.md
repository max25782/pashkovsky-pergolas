# Pashkovsky CRM

**Database:** a clean database starts from `apps/crm/supabase/migrations/000_baseline.sql`, then apply subsequent files in numeric order. New migrations are numbered from 052.

## Known backlog (not scheduled)

- **Kanban column counts via aggregation:** currently the column totals (e.g. "363 ממתין") reflect only the 500 newest leads loaded in the view, not the true total per status. Fix: add a separate `SELECT status, COUNT(*) FROM leads WHERE company_id = $1 GROUP BY status` query to `useLeads` and render column headers from that count, independent of the loaded page.

- **`allocate_offer_number` caller authorization:** function body has no membership check. Any service_role caller can allocate a number for any company. Acceptable while all calls originate from the trusted server process, but should be hardened if the function is ever exposed more broadly.

---

Multi-tenant CRM система для управления лидами, сделками и проектами.

## 🚀 Запуск

```bash
# Из root директории монорепо
npm run dev:crm

# Или из apps/crm
npm run dev
```

Откроется на `http://localhost:3001`

## 📦 Что включает

- **Лиды**: Управление входящими заявками
- **Сделки**: Канбан доска с воронкой продаж
- **Воркеры**: Управление рабочими и сменами
- **Проекты**: Трекинг установки пергол
- **Оффер-листы**: Генерация PDF предложений
- **AI Аналитика**: Умная аналитика по сделкам
- **Multi-tenancy**: Разные компании в одной системе

## 🔒 Безопасность

- JWT authentication
- Row-Level Security (RLS)
- Company-based data isolation
- Role-based permissions
- Runtime assertions

## 🛠️ Технологии

- Next.js 14
- React 18
- Supabase (PostgreSQL)
- Puppeteer (PDF generation)
- AWS S3 (хранилище)
- Recharts (графики)

## 📝 Environment Variables

См. `/docs/ENV_LOCAL_SETUP.md`

## 🗄️ Миграции

**Источник правды:** `apps/crm/supabase/migrations/` (применять через Supabase CLI или SQL Editor по файлам из этой папки).

```bash
# Из корня монорепо, при настроенном link на проект:
cd apps/crm && npx supabase db push
# или вручную: SQL Editor → по порядку файлов из apps/crm/supabase/migrations/
```

## 🧪 Тестирование

```bash
npm run test:security
```

## 📚 Документация

- `/docs/SECURITY_LAYER_IMPLEMENTATION.md`
- `/docs/PUBLIC_LEAD_API.md`
- `/docs/SAAS_PLAN.md`

