# Pre-Baseline Migrations Archive

These 70 SQL files are the incremental migration history that built the production
database from an empty state up to the snapshot date (2026-09-27).

**They must not be applied to any new database.**  
The entire schema they describe is captured as a single snapshot in:

```
apps/crm/supabase/migrations/000_baseline.sql
```

The baseline was generated from the live production schema on 2026-09-27 and
includes everything up to and including migrations 050 and 051
(offer_number, offer_number_counters, allocate_offer_number, terms_snapshot).

New migrations are numbered from 052 onward.

## Why keep these files?

- Historical reference — shows the path the schema evolved through
- Blame / git-archaeology — each file is dated and authored
- Rollback context — if a future migration needs to understand what came before
