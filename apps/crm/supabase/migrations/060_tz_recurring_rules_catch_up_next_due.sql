-- Tazrim: catch stale tz_recurring_rules.next_due_date up to the next charge.
--
-- NOT APPLIED. Review the preview below, then apply by hand (SQL editor or
-- `supabase db push`). Data only, no schema change. Idempotent.
--
-- Why: nothing in the app advances next_due_date (no cron, no payment
-- confirmation, no bank reconciliation), so monthly rules keep the date they
-- were created with. The forecast no longer reads that date as "the" charge
-- date (lib/tazrim/recurring-schedule.ts derives every occurrence from the
-- frequency and payment day), so this update is cosmetic: the saved value
-- only needs to be a real upcoming date for anyone reading the table or the
-- raw column. The payment day (and, for yearly, the month) is preserved.
--
-- Only rules whose saved date is before today (Israel time) are touched.
-- Rules with a payment day above 28 are skipped on purpose: re-saving them as
-- e.g. the 30th would silently move the payment day.
--
-- Preview (read-only), run before applying: replace the final UPDATE with
-- `select * from next_dates order by old_date;` (the CTEs are identical).
--
-- Expected on the data of 2026-11-10 (today = 2026-11-10):
--   old_date    -> new_date     label            amount
--   2026-10-05  -> 2026-12-05   חברת פיננסים     7,670
--   2026-10-10  -> 2026-11-10   סיטרואן          1,080
--   2026-10-10  -> 2026-11-10   כרטיס אשראי      11,000 (variable)
--   2026-10-25  -> 2026-11-25   הלוואה           1,000
--   2026-10-25  -> 2026-11-25   הלוואה           1,200
--   2026-10-25  -> 2026-11-25   הלוואה           2,100
--   2026-10-25  -> 2026-11-25   הלוואה           5,500
-- Unchanged: שכירות (yearly, 2026-11-25 is not in the past).

begin;

with today as (
  select (now() at time zone 'Asia/Jerusalem')::date as d
),
stale as (
  select
    r.id,
    r.frequency,
    r.next_due_date as old_date,
    extract(day from r.next_due_date)::int as pay_day,
    extract(month from r.next_due_date)::int as pay_month,
    extract(year from t.d)::int as y,
    extract(month from t.d)::int as m,
    t.d as today
  from public.tz_recurring_rules r
  cross join today t
  where r.next_due_date is not null
    and r.next_due_date < t.d
    and r.frequency in ('monthly', 'yearly')
    and extract(day from r.next_due_date) <= 28
),
next_dates as (
  select
    id,
    old_date,
    case frequency
      when 'monthly' then
        case
          when make_date(y, m, pay_day) >= today then make_date(y, m, pay_day)
          else (make_date(y, m, pay_day) + interval '1 month')::date
        end
      else
        case
          when make_date(y, pay_month, pay_day) >= today
            then make_date(y, pay_month, pay_day)
          else (make_date(y, pay_month, pay_day) + interval '1 year')::date
        end
    end as new_date
  from stale
)
update public.tz_recurring_rules r
set next_due_date = n.new_date
from next_dates n
where r.id = n.id
  and r.next_due_date = n.old_date;

commit;
