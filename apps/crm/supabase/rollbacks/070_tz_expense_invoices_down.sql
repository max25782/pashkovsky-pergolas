-- Rollback for supabase/migrations/070_tz_expense_invoices.sql
--
-- NOT APPLIED. Kept outside supabase/migrations so `supabase db push` never
-- runs it. Run by hand only to undo the feature.
--
-- Cash-event amounts that were replaced are restored from calc_meta.expenseMatch
-- only by the unlink action, not by this script. After the invoice table is
-- gone, that previous amount is no longer on estimated_amount. tz_audit_log
-- rows for close/reopen are left in place.

begin;

drop function if exists public.tz_apply_expense_invoice(uuid, uuid, text, jsonb);

drop policy if exists tz_expense_invoices_select on storage.objects;
drop policy if exists tz_expense_invoices_insert on storage.objects;
drop policy if exists tz_expense_invoices_update on storage.objects;
drop policy if exists tz_expense_invoices_delete on storage.objects;

delete from storage.objects where bucket_id = 'tz-expense-invoices';
delete from storage.buckets where id = 'tz-expense-invoices';

drop table if exists public.tz_expense_invoices;
drop table if exists public.tz_expense_documents;
drop table if exists public.tz_vat_period_closures;

drop index if exists public.tz_vendors_id_company_uq;
drop index if exists public.tz_expense_categories_id_company_uq;
drop index if exists public.tz_cash_events_id_company_uq;
drop index if exists public.deals_id_company_uq;

alter table public.tz_vendors drop column if exists issues_monthly_invoice;

alter table public.tz_expense_categories
  drop constraint if exists tz_expense_categories_vat_recognized_percent_chk;

alter table public.tz_expense_categories
  drop column if exists vat_recognized_percent;

commit;
