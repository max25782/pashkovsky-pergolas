# Worker Timesheet UX - Testing Checklist

## Prerequisites

1. Run migrations: `024_create_worker_shifts.sql`, `025_add_workers_hourly_rate.sql`
2. Ensure at least one worker and one deal exist

## Desktop

- [ ] Month selector shows current month by default
- [ ] Changing month updates timesheet data when panel is expanded
- [ ] Click chevron to expand worker row; TimesheetPanel loads
- [ ] Summary shows: days_worked, total_hours, total_cost, late_days_count
- [ ] Add shift: date, deal selector (searchable), start/end time, note
- [ ] Time presets (07:00-16:00, 08:00-17:00, etc.) set form values
- [ ] Copy yesterday: prefills form when previous shift exists
- [ ] Copy yesterday: shows "No previous shift found" when none exists
- [ ] Duplicate shift: copies row into form with date=today
- [ ] Save validates: both start/end required when one filled; end >= start
- [ ] Save without deal: allowed, warning "No deal linked" shown
- [ ] Edit shift: opens form with existing data
- [ ] Delete shift: confirms and removes
- [ ] Plan tomorrow: bulk form with date, deal, start/end, worker checkboxes
- [ ] Bulk apply: upserts for selected workers (no duplicates)
- [ ] Deal page: ProfitWidget shows labor cost from worker_shifts
- [ ] Deal page: WorkLogSection shows shifts with start/end, computed cost
- [ ] Deal page: Add shift creates worker_shift with deal_id, 08:00-17:00 default

## Mobile Safari

- [ ] Month selector works (native date input)
- [ ] Time input uses native picker (input type="time")
- [ ] Expand/collapse panel works
- [ ] Deal search dropdown usable on small screen
- [ ] Bulk plan worker checkboxes scrollable

## Edge Cases

- [ ] No overnight shifts: end < start shows validation error
- [ ] Empty start/end allowed; partial (one only) rejected
- [ ] Workers page: company from auth (no hardcoded ID)
- [ ] 401 from API redirects to login
