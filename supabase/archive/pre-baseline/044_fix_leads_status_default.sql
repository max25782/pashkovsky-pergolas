-- Fix leads.status column default to match the check constraint
-- The check constraint (from migration 043) removed 'pending' as a valid status.
-- The new initial status for incoming leads is 'waiting'.
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'waiting';
