# Archive — ad-hoc SQL and superseded migrations

Source of truth for the production schema is `supabase/baseline/schema_baseline_2026-08-08.sql`
(see `supabase/baseline/README.md`). Files here are kept for history only and must NOT be applied.

## `adhoc/`

One-off SQL scripts that were run manually against production via the Supabase SQL editor
(phone login fixes, superadmin setup, deals table hotfixes, RLS toggles, diagnostic queries).
Their effects, where permanent, are captured in the baseline. Moved here from the repository
root and from `supabase/` during the 2026-09-11 cleanup.

## `superseded-migrations/`

Migration versions replaced by a newer file with the same number:

| Archived file | Superseded by | Why |
|---|---|---|
| `013_add_roles_and_permissions.sql` | `migrations/013_add_roles_and_permissions.sql` (was `_MODIFIED`) | Rewritten version was the one applied |
| `021_fix_company_members_fkey.sql` | `migrations/021_fix_company_members_fkey.sql` (was `_v2`) | v2 adds orphaned-record cleanup before the FK switch |
| `027_create_articles_table.sql` | `migrations/022_create_articles_table.sql` | Production `articles` (per baseline) matches the 022 schema: bigint id, company_id, author_id, published |

## Duplicate migration numbers

Migrations that shared a number with an unrelated migration were renamed with a `b`/`c` suffix
to keep lexicographic ordering while making names unique:

- `017b_add_missing_leads_columns.sql`
- `019b_migrate_company_data.sql`
- `025b_sync_auth_users.sql`
- `026b_remove_password_hash_optional.sql`
- `027b_add_worker_shift_type.sql`
- `028b_ai_director_sessions.sql`
