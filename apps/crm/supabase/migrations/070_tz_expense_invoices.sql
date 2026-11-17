-- 070_tz_expense_invoices.sql
--
-- Supplier invoices (חשבוניות ספקים) for Tazrim input VAT (מע״מ תשומות).
-- Numbered 070 because 069_meta_capi.sql already uses 069.
-- Tables keep the tz_ prefix from 057.
--
-- NOT applied automatically. Review, then run yourself.
-- company_id comes from the checked session. The app ignores a company id in the body.
--
-- Writes: authenticated has SELECT only. Inserts and updates run in server
-- routes with the service role, after the session and owner/admin role are
-- checked. There is no client INSERT/UPDATE/DELETE on these tables or on the
-- bucket. The upload route stores the file; signed URLs are minted by that
-- same server client. A browser policy is not required to download a signed URL.
--
-- Rollback: the commented block at the bottom, and
-- supabase/rollbacks/070_tz_expense_invoices_down.sql (outside migrations, so
-- `supabase db push` will not run it).

begin;

-- ---------------------------------------------------------------------------
-- Category percent. Default 100 is a placeholder: confirm it with the accountant.
-- ---------------------------------------------------------------------------
alter table public.tz_expense_categories
  add column if not exists vat_recognized_percent numeric(6, 2) not null default 100;

alter table public.tz_expense_categories
  drop constraint if exists tz_expense_categories_vat_recognized_percent_chk;

alter table public.tz_expense_categories
  add constraint tz_expense_categories_vat_recognized_percent_chk
  check (vat_recognized_percent >= 0 and vat_recognized_percent <= 100);

comment on column public.tz_expense_categories.vat_recognized_percent is
  'Share of invoice VAT allowed as input credit. Default 100 — confirm with the accountant.';

alter table public.tz_vendors
  add column if not exists issues_monthly_invoice boolean not null default false;

comment on column public.tz_vendors.issues_monthly_invoice is
  'True when this supplier sends one tax invoice for the month, which replaces that month''s preliminary documents.';

-- ---------------------------------------------------------------------------
-- Documents (the file) and invoices (the reading)
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
  constraint tz_expense_documents_path_company_chk
    check (storage_path like (company_id::text || '/%') and storage_path not like '%..%'),
  constraint tz_expense_documents_company_sha256_key unique (company_id, sha256)
);

create unique index if not exists tz_expense_documents_id_company_uq
  on public.tz_expense_documents (id, company_id);

create table if not exists public.tz_expense_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null,
  supplier_name text,
  supplier_tax_id text,
  invoice_number text,
  invoice_date date,
  doc_type text not null default 'other',
  -- preliminary: deal document, forecast only. tax_invoice: tax invoice, including a monthly supplier invoice.
  doc_kind text not null default 'preliminary',
  currency text not null default 'ILS',
  net_amount numeric(14, 2),
  vat_rate numeric(6, 2),
  vat_amount numeric(14, 2),
  total_amount numeric(14, 2),
  allocation_number text,
  vat_recognized_percent numeric(6, 2) not null default 100,
  vat_period text,
  category_id uuid,
  vendor_id uuid,
  deal_id uuid,
  is_monthly boolean not null default false,
  superseded_by uuid,
  matched_cash_event_id uuid,
  estimated_amount numeric(14, 2),
  variance_amount numeric(14, 2),
  extraction_json jsonb,
  extraction_confidence numeric(4, 3),
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_at timestamptz not null default now(),
  constraint tz_expense_invoices_doc_type_chk
    check (doc_type in ('tax_invoice', 'receipt', 'other')),
  constraint tz_expense_invoices_doc_kind_chk
    check (doc_kind in ('preliminary', 'tax_invoice')),
  constraint tz_expense_invoices_vat_percent_chk
    check (vat_recognized_percent >= 0 and vat_recognized_percent <= 100),
  constraint tz_expense_invoices_period_chk
    check (vat_period is null or vat_period ~ '^\d{4}-\d{2}$'),
  constraint tz_expense_invoices_confidence_chk
    check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  -- Drafts may omit the link. A confirmed preliminary belongs to a deal and a supplier.
  -- A confirmed tax invoice belongs to a supplier and a month.
  constraint tz_expense_invoices_preliminary_link_chk
    check (confirmed_at is null or doc_kind <> 'preliminary' or (deal_id is not null and vendor_id is not null)),
  constraint tz_expense_invoices_tax_link_chk
    check (confirmed_at is null or doc_kind <> 'tax_invoice' or (vendor_id is not null and vat_period is not null)),
  constraint tz_expense_invoices_kind_type_chk
    check (doc_kind <> 'tax_invoice' or doc_type = 'tax_invoice')
);

create unique index if not exists tz_expense_invoices_id_company_uq
  on public.tz_expense_invoices (id, company_id);

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_kind_type_chk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_kind_type_chk
  check (doc_kind <> 'tax_invoice' or doc_type = 'tax_invoice');

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_doc_kind_chk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_doc_kind_chk
  check (doc_kind in ('preliminary', 'tax_invoice'));

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_preliminary_link_chk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_preliminary_link_chk
  check (confirmed_at is null or doc_kind <> 'preliminary' or (deal_id is not null and vendor_id is not null));

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_tax_link_chk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_tax_link_chk
  check (confirmed_at is null or doc_kind <> 'tax_invoice' or (vendor_id is not null and vat_period is not null));

-- Parents must expose (id, company_id) so a child cannot point at another company's row.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tz_vendors' and column_name = 'company_id'
  ) then
    raise exception 'tz_vendors.company_id is required';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tz_expense_categories' and column_name = 'company_id'
  ) then
    raise exception 'tz_expense_categories.company_id is required';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tz_cash_events' and column_name = 'company_id'
  ) then
    raise exception 'tz_cash_events.company_id is required';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deals' and column_name = 'company_id'
  ) then
    raise exception 'deals.company_id is required';
  end if;
end $$;
create unique index if not exists tz_vendors_id_company_uq
  on public.tz_vendors (id, company_id);
create unique index if not exists tz_expense_categories_id_company_uq
  on public.tz_expense_categories (id, company_id);
create unique index if not exists tz_cash_events_id_company_uq
  on public.tz_cash_events (id, company_id);
create unique index if not exists deals_id_company_uq
  on public.deals (id, company_id);

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_document_company_fk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_document_company_fk
  foreign key (document_id, company_id)
  references public.tz_expense_documents (id, company_id)
  on delete cascade;

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_vendor_company_fk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_vendor_company_fk
  foreign key (vendor_id, company_id)
  references public.tz_vendors (id, company_id)
  on delete set null (vendor_id);

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_category_company_fk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_category_company_fk
  foreign key (category_id, company_id)
  references public.tz_expense_categories (id, company_id)
  on delete set null (category_id);

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_deal_company_fk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_deal_company_fk
  foreign key (deal_id, company_id)
  references public.deals (id, company_id)
  on delete set null (deal_id);

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_event_company_fk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_event_company_fk
  foreign key (matched_cash_event_id, company_id)
  references public.tz_cash_events (id, company_id)
  on delete set null (matched_cash_event_id);

alter table public.tz_expense_invoices
  drop constraint if exists tz_expense_invoices_superseded_company_fk;
alter table public.tz_expense_invoices
  add constraint tz_expense_invoices_superseded_company_fk
  foreign key (superseded_by, company_id)
  references public.tz_expense_invoices (id, company_id)
  on delete set null (superseded_by);

drop index if exists public.tz_expense_invoices_confirmed_supplier_number_uq;
create unique index tz_expense_invoices_confirmed_supplier_number_uq
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

create index if not exists tz_expense_invoices_deal_idx
  on public.tz_expense_invoices (deal_id);

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

create or replace function public.tz_apply_expense_invoice(
  p_company_id uuid,
  p_invoice_id uuid,
  p_action text,
  p_row jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_kind text;
  v_vendor uuid;
  v_period text;
  v_document uuid;
begin
  if p_company_id is null or p_invoice_id is null or p_action not in ('confirm', 'release', 'delete') then
    raise exception 'bad invoice action' using errcode = '22023';
  end if;

  select company_id into v_company
  from public.tz_expense_invoices
  where id = p_invoice_id
  for update;

  if v_company is null or v_company <> p_company_id then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;

  if p_action = 'confirm' then
    update public.tz_expense_invoices set
      supplier_name = p_row->>'supplier_name',
      supplier_tax_id = nullif(p_row->>'supplier_tax_id', ''),
      invoice_number = nullif(p_row->>'invoice_number', ''),
      invoice_date = nullif(p_row->>'invoice_date', '')::date,
      doc_type = p_row->>'doc_type',
      doc_kind = case when p_row->>'doc_kind' = 'tax_invoice' then 'tax_invoice' else 'preliminary' end,
      currency = coalesce(nullif(p_row->>'currency', ''), 'ILS'),
      net_amount = (p_row->>'net_amount')::numeric,
      vat_rate = (p_row->>'vat_rate')::numeric,
      vat_amount = (p_row->>'vat_amount')::numeric,
      total_amount = (p_row->>'total_amount')::numeric,
      allocation_number = nullif(p_row->>'allocation_number', ''),
      vat_recognized_percent = coalesce((p_row->>'vat_recognized_percent')::numeric, 100),
      vat_period = nullif(p_row->>'vat_period', ''),
      category_id = nullif(p_row->>'category_id', '')::uuid,
      vendor_id = nullif(p_row->>'vendor_id', '')::uuid,
      deal_id = nullif(p_row->>'deal_id', '')::uuid,
      is_monthly = coalesce((p_row->>'is_monthly')::boolean, false),
      company_id = p_company_id,
      superseded_by = null,
      confirmed_at = pg_catalog.now(),
      confirmed_by = nullif(p_row->>'confirmed_by', '')::uuid
    where id = p_invoice_id
      and company_id = p_company_id
    returning doc_kind, vendor_id, vat_period, document_id
      into v_kind, v_vendor, v_period, v_document;

    update public.tz_expense_documents
      set status = 'confirmed'
      where id = v_document
        and company_id = p_company_id;

    if v_kind = 'tax_invoice' and v_vendor is not null and v_period is not null then
      update public.tz_expense_invoices
        set superseded_by = p_invoice_id
        where company_id = p_company_id
          and vendor_id = v_vendor
          and vat_period = v_period
          and doc_kind = 'preliminary'
          and confirmed_at is not null
          and id <> p_invoice_id;
    end if;
    return p_invoice_id;
  end if;

  update public.tz_expense_invoices
    set superseded_by = null
    where company_id = p_company_id
      and superseded_by = p_invoice_id;

  if p_action = 'release' then
    update public.tz_expense_invoices
      set confirmed_at = null,
          confirmed_by = null
      where id = p_invoice_id
        and company_id = p_company_id
      returning document_id into v_document;
    update public.tz_expense_documents
      set status = case when p_row->>'document_status' = 'rejected' then 'rejected' else 'extracted' end
      where id = v_document
        and company_id = p_company_id;
    return p_invoice_id;
  end if;

  delete from public.tz_expense_invoices
    where id = p_invoice_id
      and company_id = p_company_id;
  return p_invoice_id;
end;
$$;

revoke all on function public.tz_apply_expense_invoice(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.tz_apply_expense_invoice(uuid, uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: authenticated may SELECT rows of a company they own or admin.
-- No write policy. service_role bypasses RLS and is the only writer.
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
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('revoke all on table public.%I from public', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists tz_member_all on public.%I', t);
    execute format('drop policy if exists tz_member_select on public.%I', t);
    execute format(
      'create policy tz_member_select on public.%I as permissive for select to authenticated '
      'using (exists (select 1 from public.company_members m '
      'where m.user_id = auth.uid() and m.company_id = %I.company_id '
      'and m.role in (''owner'', ''admin'')))',
      t, t
    );
  end loop;
end $$;

-- Private bucket. 15 MiB. No client storage policies: the server uploads with
-- the service role and returns a signed URL. HEIC stays in the allow-list as
-- a server-side fallback; the upload control does not offer it.
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

do $$
declare
  r record;
begin
  for r in
    select pol.polname as name
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'storage'
      and cls.relname = 'objects'
      and (
        pol.polname like 'tz_expense_invoices_%'
        or pg_get_expr(pol.polqual, pol.polrelid) ilike '%tz-expense-invoices%'
        or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ilike '%tz-expense-invoices%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', r.name);
  end loop;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- ROLLBACK (do not execute as part of this migration)
--
-- begin;
-- drop function if exists public.tz_apply_expense_invoice(uuid, uuid, text, jsonb);
-- drop policy if exists tz_expense_invoices_select on storage.objects;
-- drop policy if exists tz_expense_invoices_insert on storage.objects;
-- drop policy if exists tz_expense_invoices_update on storage.objects;
-- drop policy if exists tz_expense_invoices_delete on storage.objects;
-- delete from storage.objects where bucket_id = 'tz-expense-invoices';
-- delete from storage.buckets where id = 'tz-expense-invoices';
-- drop table if exists public.tz_expense_invoices;
-- drop table if exists public.tz_expense_documents;
-- drop table if exists public.tz_vat_period_closures;
-- drop index if exists public.tz_vendors_id_company_uq;
-- drop index if exists public.tz_expense_categories_id_company_uq;
-- drop index if exists public.tz_cash_events_id_company_uq;
-- drop index if exists public.deals_id_company_uq;
-- alter table public.tz_vendors drop column if exists issues_monthly_invoice;
-- alter table public.tz_expense_categories
--   drop constraint if exists tz_expense_categories_vat_recognized_percent_chk;
-- alter table public.tz_expense_categories drop column if exists vat_recognized_percent;
-- commit;
-- ---------------------------------------------------------------------------
