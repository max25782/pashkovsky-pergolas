-- Tazrim: CRM payments move the bank-account balance (computed, not stored).
--
-- NOT APPLIED. Review, then apply by hand (SQL editor or `supabase db push`).
-- Rollback: supabase/rollbacks/059_tz_cash_events_crm_balance_down.sql
--
-- Balance model (see lib/tazrim/account-balance.ts): last tz_bank_balance_snapshots row
-- + cleared AluminCRM income that is linked to the account, not reversed, in
-- ILS and cleared strictly after the snapshot date. No stored balance, no RPC.

begin;

-- 1. tz_bank_accounts: which account receives CRM payments by default --------------

alter table public.tz_bank_accounts
  add column if not exists is_crm_default boolean not null default false;

-- At most one default account per company.
create unique index if not exists tz_bank_accounts_one_crm_default_per_company
  on public.tz_bank_accounts (company_id)
  where is_crm_default;

-- 2. tz_cash_events: account link, CRM payment id, "needs account" flag ------------

alter table public.tz_cash_events
  add column if not exists bank_account_id uuid references public.tz_bank_accounts (id),
  add column if not exists crm_payment_id text,
  add column if not exists needs_account boolean not null default false;

create index if not exists tz_cash_events_bank_account_idx
  on public.tz_cash_events (bank_account_id)
  where bank_account_id is not null;

-- One Tazrim row per CRM payment per company (tenant).
create unique index if not exists tz_cash_events_company_crm_payment_uq
  on public.tz_cash_events (company_id, crm_payment_id)
  where crm_payment_id is not null;

-- 3. Upsert key used by syncAluminCRM: (company_id, external_source, external_id).
-- It must be a plain (non-partial) unique index for ON CONFLICT to infer it.
-- Created only if no equivalent unique index exists yet. If this fails with a
-- duplicate-key error, de-duplicate tz_cash_events first.

do $$
begin
  if not exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.tz_cash_events'::regclass
      and i.indisunique
      and i.indpred is null
      and i.indexprs is null
      and i.indnatts = 3
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from pg_attribute a
        where a.attrelid = i.indrelid
          and a.attnum = any (i.indkey)
      ) = array['company_id', 'external_id', 'external_source']::text[]
  ) then
    create unique index tz_cash_events_company_external_uq
      on public.tz_cash_events (company_id, external_source, external_id);
  end if;
end
$$;

-- 4. Allow status 'reversed'. If tz_cash_events.status has a CHECK list, extend it
-- in place (the existing allowed values are kept). If there is no such CHECK,
-- nothing to do. A CHECK of any other shape aborts the migration (rolled back).

do $$
declare
  c record;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.tz_cash_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) not ilike '%reversed%'
  loop
    if c.def !~* 'status[^;]*ANY[^;]*ARRAY' or c.def not like '%''cleared''%' then
      raise exception
        'tz_cash_events constraint % has an unexpected shape, extend it by hand: %',
        c.conname, c.def;
    end if;

    execute format('alter table public.tz_cash_events drop constraint %I', c.conname);
    execute format(
      'alter table public.tz_cash_events add constraint %I %s',
      c.conname,
      regexp_replace(c.def, '(''cleared''::[a-z ]+)', '\1, ''reversed''::text')
    );
  end loop;
end
$$;

commit;
