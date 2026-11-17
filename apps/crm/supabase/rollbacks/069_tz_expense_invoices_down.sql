-- Rollback for supabase/migrations/069_tz_expense_invoices.sql
--
-- NOT APPLIED. Kept outside supabase/migrations so `supabase db push` never
-- runs it. Run by hand only to undo the feature.
--
-- Drops supplier-invoice files, the private bucket, and the three tables.
-- Invoice rows and stored files are deleted. Cash events that were updated to
-- an actual invoice amount are NOT reverted (the previous amount is on
-- tz_expense_invoices.estimated_amount until this drop). VAT rows written by
-- a later sync go back to the materials estimate once the invoice tables are
-- gone. tz_audit_log entries for close/reopen are left in place.

begin;

drop policy if exists tz_expense_invoices_select on storage.objects;
drop policy if exists tz_expense_invoices_insert on storage.objects;
drop policy if exists tz_expense_invoices_update on storage.objects;
drop policy if exists tz_expense_invoices_delete on storage.objects;

delete from storage.objects where bucket_id = 'tz-expense-invoices';
delete from storage.buckets where id = 'tz-expense-invoices';

drop function if exists public.tz_storage_company_id(text);

drop table if exists public.tz_expense_invoices;
drop table if exists public.tz_expense_documents;
drop table if exists public.tz_vat_period_closures;

alter table public.tz_expense_categories
  drop constraint if exists tz_expense_categories_vat_recognized_percent_chk;

alter table public.tz_expense_categories
  drop column if exists vat_recognized_percent;

commit;
