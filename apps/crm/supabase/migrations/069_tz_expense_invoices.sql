-- 069_tz_expense_invoices.sql
--
-- Supplier invoices (חשבוניות ספקים) for Tazrim input VAT (מע״מ תשומות).
-- Tables keep the tz_ prefix used by 057 so they do not collide with CRM tables.
-- The names in the product are expense documents, expense invoices, VAT period closures.
--
-- NOT applied automatically. Review, then run on a branch or staging.
-- company_id is always the caller's membership. The app also ignores any
-- company id sent in the request body.
--
-- Rollback: the commented block at the bottom of this file, and
-- supabase/rollbacks/069_tz_expense_invoices_down.sql (that file is outside
-- supabase/migrations so `supabase db push` will not run it).

-- ---------------------------------------------------------------------------
-- Category: share of invoice VAT the accountant allows as input credit.
-- Default 100. The accountant changes it per category; a confirmed invoice
-- can still override the percent by hand.
-- ---------------------------------------------------------------------------
alter table public.tz_expense_categories
  add column if not exists vat_recognized_percent numeric(6, 2) not null default 100;

alter table public.tz_expense_categories
  drop constraint if exists tz_expense_categories_vat_recognized_percent_chk;

alter table public.tz_expense_categories
  add constraint tz_expense_categories_vat_recognized_percent_chk
  check (vat_recognized_percent >= 0 and vat_recognized_percent <= 100);

-- ---------------------------------------------------------------------------
-- Documents (the file) and invoices (the confirmed or draft reading)
-- ---------------------------------------------------------------------------
create table if not exists public.tz_expense_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size bigint not null,
  sha256 text not null,
  status text not null default 'uploaded',
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  constraint tz_expense_documents_status_chk
    check (status in ('uploaded', 'extracted', 'confirmed', 'rejected')),
  constraint tz_expense_documents_size_chk
    check (size > 0 and size <= 15728640),
  constraint tz_expense_documents_mime_chk
    check (mime_type in (
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
    )),
  -- Object key is always {company_id}/... so a signed URL cannot be aimed at another company.
  constraint tz_expense_documents_path_company_chk
    check (storage_path like (company_id::text || '/%') and storage_path not like '%..%'),
  constraint tz_expense_documents_company_sha256_key unique (company_id, sha256)
);

create table if not exists public.tz_expense_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.tz_expense_documents(id) on delete cascade,
  supplier_name text,
  supplier_tax_id text,
  invoice_number text,
  invoice_date date,
  doc_type text not null default 'other',
  currency text not null default 'ILS',
  net_amount numeric(14, 2),
  vat_rate numeric(6, 2),
  vat_amount numeric(14, 2),
  total_amount numeric(14, 2),
  allocation_number text,
  vat_recognized_percent numeric(6, 2) not null default 100,
  vat_period text,
  category_id uuid references public.tz_expense_categories(id) on delete set null,
  vendor_id uuid references public.tz_vendors(id) on delete set null,
  matched_cash_event_id uuid references public.tz_cash_events(id) on delete set null,
  estimated_amount numeric(14, 2),
  variance_amount numeric(14, 2),
  extraction_json jsonb,
  extraction_confidence numeric(4, 3),
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_at timestamptz not null default now(),
  constraint tz_expense_invoices_doc_type_chk
    check (doc_type in ('tax_invoice', 'receipt', 'other')),
  constraint tz_expense_invoices_vat_percent_chk
    check (vat_recognized_percent >= 0 and vat_recognized_percent <= 100),
  constraint tz_expense_invoices_period_chk
    check (vat_period is null or vat_period ~ '^\d{4}-\d{2}$'),
  constraint tz_expense_invoices_confidence_chk
    check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1))
);

-- Confirmed invoices only. Drafts may repeat a number while the user is still checking.
create unique index if not exists tz_expense_invoices_confirmed_supplier_number_uq
  on public.tz_expense_invoices (company_id, supplier_tax_id, invoice_number)
  where confirmed_at is not null
    and supplier_tax_id is not null
    and supplier_tax_id <> ''
    and invoice_number is not null
    and invoice_number <> '';

create index if not exists tz_expense_invoices_company_period_idx
  on public.tz_expense_invoices (company_id, vat_period);

create index if not exists tz_expense_invoices_document_idx
  on public.tz_expense_invoices (document_id);

create index if not exists tz_expense_invoices_matched_event_idx
  on public.tz_expense_invoices (matched_cash_event_id);

create table if not exists public.tz_vat_period_closures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vat_period text not null,
  closed_at timestamptz not null default now(),
  closed_by uuid,
  note text,
  constraint tz_vat_period_closures_period_chk
    check (vat_period ~ '^\d{4}-\d{2}$'),
  constraint tz_vat_period_closures_company_period_key unique (company_id, vat_period)
);

-- ---------------------------------------------------------------------------
-- RLS: membership of that company, owner/admin, same rule as the rest of Tazrim
-- but not pinned to one hardcoded company id. anon has nothing.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'tz_expense_documents',
    'tz_expense_invoices',
    'tz_vat_period_closures'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated, service_role',
      t
    );
    execute format('drop policy if exists tz_member_all on public.%I', t);
    execute format(
      'create policy tz_member_all on public.%I as permissive for all to authenticated '
      'using (exists (select 1 from public.company_members m '
      'where m.user_id = auth.uid() and m.company_id = %I.company_id '
      'and m.role in (''owner'', ''admin''))) '
      'with check (exists (select 1 from public.company_members m '
      'where m.user_id = auth.uid() and m.company_id = %I.company_id '
      'and m.role in (''owner'', ''admin'')))',
      t, t, t
    );
  end loop;
end $$;

-- First path segment of a storage object, or null when it is not a uuid.
create or replace function public.tz_storage_company_id(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  folder text;
begin
  folder := split_part(object_name, '/', 1);
  if folder !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return folder::uuid;
end;
$$;

revoke all on function public.tz_storage_company_id(text) from public, anon;
grant execute on function public.tz_storage_company_id(text) to authenticated, service_role;

-- Private bucket. 15 MiB. Signed URLs only (public = false, no public policy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tz-expense-invoices',
  'tz-expense-invoices',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tz_expense_invoices_select on storage.objects;
drop policy if exists tz_expense_invoices_insert on storage.objects;
drop policy if exists tz_expense_invoices_update on storage.objects;
drop policy if exists tz_expense_invoices_delete on storage.objects;

create policy tz_expense_invoices_select on storage.objects
for select to authenticated
using (
  bucket_id = 'tz-expense-invoices'
  and exists (
    select 1 from public.company_members m
    where m.user_id = auth.uid()
      and m.company_id = public.tz_storage_company_id(name)
      and m.role in ('owner', 'admin')
  )
);

create policy tz_expense_invoices_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'tz-expense-invoices'
  and exists (
    select 1 from public.company_members m
    where m.user_id = auth.uid()
      and m.company_id = public.tz_storage_company_id(name)
      and m.role in ('owner', 'admin')
  )
);

create policy tz_expense_invoices_update on storage.objects
for update to authenticated
using (
  bucket_id = 'tz-expense-invoices'
  and exists (
    select 1 from public.company_members m
    where m.user_id = auth.uid()
      and m.company_id = public.tz_storage_company_id(name)
      and m.role in ('owner', 'admin')
  )
)
with check (
  bucket_id = 'tz-expense-invoices'
  and exists (
    select 1 from public.company_members m
    where m.user_id = auth.uid()
      and m.company_id = public.tz_storage_company_id(name)
      and m.role in ('owner', 'admin')
  )
);

create policy tz_expense_invoices_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'tz-expense-invoices'
  and exists (
    select 1 from public.company_members m
    where m.user_id = auth.uid()
      and m.company_id = public.tz_storage_company_id(name)
      and m.role in ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- ROLLBACK (do not execute as part of this migration)
--
-- begin;
-- drop policy if exists tz_expense_invoices_select on storage.objects;
-- drop policy if exists tz_expense_invoices_insert on storage.objects;
-- drop policy if exists tz_expense_invoices_update on storage.objects;
-- drop policy if exists tz_expense_invoices_delete on storage.objects;
-- delete from storage.objects where bucket_id = 'tz-expense-invoices';
-- delete from storage.buckets where id = 'tz-expense-invoices';
-- drop function if exists public.tz_storage_company_id(text);
-- drop table if exists public.tz_expense_invoices;
-- drop table if exists public.tz_expense_documents;
-- drop table if exists public.tz_vat_period_closures;
-- alter table public.tz_expense_categories
--   drop constraint if exists tz_expense_categories_vat_recognized_percent_chk;
-- alter table public.tz_expense_categories
--   drop column if exists vat_recognized_percent;
-- commit;
-- ---------------------------------------------------------------------------
