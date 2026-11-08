-- Rollback for supabase/migrations/059_tz_cash_events_crm_balance.sql
--
-- NOT APPLIED. Kept outside supabase/migrations on purpose so `supabase db push`
-- never runs it by accident. Run by hand only if you want to undo the feature.
--
-- Data note: dropping the new columns loses bank_account_id, crm_payment_id and
-- needs_account. Rows the sync marked 'reversed' go back to 'cleared' (the status
-- they had before reversal); each reversal is recorded in tz_audit_log
-- (action 'crm_sync_reverse', old_data/new_data) if you need to redo it.

begin;

update public.tz_cash_events
set status = 'cleared'
where status = 'reversed';

-- Remove 'reversed' from the status CHECK list (if one exists and contains it).
do $$
declare
  c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.tz_cash_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%reversed%'
  loop
    execute format('alter table public.tz_cash_events drop constraint %I', c.conname);
    execute format(
      'alter table public.tz_cash_events add constraint %I %s',
      c.conname,
      regexp_replace(c.def, ',\s*''reversed''::[a-z ]+', '', 'g')
    );
  end loop;
end
$$;

drop index if exists public.tz_cash_events_company_crm_payment_uq;
drop index if exists public.tz_cash_events_bank_account_idx;

-- Dropped only if this migration created it; a pre-existing equivalent unique
-- index (any other name) is not touched.
drop index if exists public.tz_cash_events_company_external_uq;

alter table public.tz_cash_events
  drop column if exists needs_account,
  drop column if exists crm_payment_id,
  drop column if exists bank_account_id;

drop index if exists public.tz_bank_accounts_one_crm_default_per_company;

alter table public.tz_bank_accounts
  drop column if exists is_crm_default;

commit;
