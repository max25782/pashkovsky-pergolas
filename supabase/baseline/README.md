# Baseline-дамп прод-схемы Supabase

## Зачем этот файл

Схема прода (`kvqupacmdishpfnscnio`, `crm.pashkovsky-group.com`) разошлась с миграциями в репозитории. Факт разъехался, вот доказательство:

- В репозитории две параллельные папки миграций: `supabase/migrations/` и `apps/crm/supabase/migrations/`, с дублирующейся нумерацией (`000_create_base_structure.sql`, `005_create_plans.sql`, `010_create_audit_logs.sql`, `013_add_roles_and_permissions_MODIFIED.sql` и т.д. — присутствуют в обеих папках), плюс минимум 16 разовых SQL-файлов прямо в корне репозитория и в `supabase/` (`FIX_SUPERADMIN_CONSTRAINT.sql`, `QUICK_FIX_DEALS_COLUMNS.sql`, `APPLY_MIGRATIONS_STEP2.sql`, `ADD_SUPERADMIN.sql`, `temp_disable_rls.sql` и др.).
- При этом **Supabase's собственный трекер миграций** (`list_migrations` / таблица `supabase_migrations.schema_migrations`) знает только про **4** миграции, все за 2026 год. То есть боевая схема (57 таблиц в `public`, плюс отдельная орфанная схема `pergola_configurator` с 10 таблицами) была построена не через воспроизводимый механизм миграций, а через ручные правки (вероятно — SQL Editor в дашборде Supabase). Файлы миграций в репозитории — это в лучшем случае исторический черновик, не источник истины.
- Найден конкретный артефакт этого дрейфа: на таблице `public.articles` висят **два** идентичных триггера — `articles_updated_at_trigger` и `update_articles_updated_at` — оба вызывают одну и ту же функцию `update_articles_updated_at()`. Это след повторного применения одной и той же логики из двух разных наборов миграций.

Этот файл фиксирует **реальность** — то, что прямо сейчас выполняется в проде — как отправную точку, от которой можно детектировать дальнейший дрейф и с которой можно поднимать staging.

## Как это сделано (и чем это НЕ является)

`pg_dump` не использовался: на машине нет клиента `pg_dump`/`psql`, а прямого пароля к Postgres (не сервис-роль ключа — реального пароля к самой БД) нигде в репозитории и `.env` не хранится (это нормально: приложение ходит в Supabase только через REST/service-role API, не по прямому TCP). Дамп собран через `execute_sql` MCP-инструмент Supabase, живой SQL-интроспекцией каталогов Postgres:

- Колонки таблиц — `information_schema.columns`
- Ограничения (PK/UNIQUE/FK/CHECK) — `pg_constraint` + `pg_get_constraintdef()`
- Индексы — `pg_indexes.indexdef`
- RLS-политики — `pg_policies`
- Функции — `pg_proc` + `pg_get_functiondef()`
- Триггеры — `pg_trigger` + `pg_get_triggerdef()`
- Enum-типы — `pg_enum`
- Установленные расширения — фактически включённые (`installed_version IS NOT NULL`) из `list_extensions`

Все фрагменты, кроме самого списка колонок, — это байт-в-байт то, что выдаёт сама Postgres (`pg_get_*def`), то есть готовый к выполнению SQL. Список колонок собран из `information_schema` вручную (`information_schema` не имеет функции «дай мне готовый CREATE TABLE»).

**Это не побайтово то же самое, что вывод `pg_dump --schema-only`** — например, здесь нет `SET` preamble-команд, COMMENT ON, GRANT/REVOKE на объекты (кроме RLS), и порядок объектов внутри файла — логический (по типу объекта), а не topological order, который строит pg_dump. Но по содержанию — таблицы, ограничения, индексы, RLS, функции, триггеры — это точное отражение живой схемы на момент снятия дампа.

**Если нужен побайтовый `pg_dump --schema-only`** (например, для восстановления в staging через `psql -f`), для этого нужен пароль/connection string к самой Postgres-базе (Settings → Database → Connection string в дашборде Supabase) — это отдельный шаг, который требует ручного действия владельца проекта (создание/просмотр пароля к БД — не то, что можно достать программно через management API).

## Область покрытия

Покрыты обе кастомные схемы приложения:

- **`public`** — 57 таблиц, основная рабочая схема CRM. Полный DDL в `schema_baseline_2026-08-08.sql`.
- **`pergola_configurator`** — 10 таблиц и одно представление, **у всех таблиц 0 строк**. Это отдельная, по всей видимости legacy-схема со своим `user_role` (`admin/manager/client`, в отличие от `public.user_role` — `admin/manager/worker/viewer/owner`). Она всё же включена в основной SQL-файл, потому что две функции `public.set_user_role*` делегируют в неё; без неё baseline не воспроизводим. **Решение — оставить, мигрировать или удалить — отдельная задача.**

Не входят: `auth`, `storage`, `realtime`, `extensions`, `graphql`, `graphql_public`, `vault`, `supabase_migrations` — это управляемые самой Supabase схемы, они создаются автоматически при поднятии любого нового проекта Supabase. Единственное критичное для staging исключение — триггер `on_auth_user_created` на `auth.users`, который вызывает `public.handle_new_auth_user()`. Он задокументирован отдельно внизу основного файла, потому что `auth.users` — не наша таблица, но триггер на ней — часть нашей логики, и на staging его придётся навешивать заново после инициализации auth.

## Как обновлять

Прогнать те же запросы через Supabase MCP (`execute_sql` на `kvqupacmdishpfnscnio`) заново и перезаписать файл с новой датой в имени. Разница между двумя дампами = что реально поменялось в проде за период — это и есть работающий способ детектировать будущий дрейф, вместо того чтобы доверять папкам миграций.
