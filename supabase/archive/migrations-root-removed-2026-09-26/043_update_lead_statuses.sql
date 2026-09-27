-- Update lead statuses to new values
-- Map old statuses to closest new equivalents
UPDATE leads SET status = 'waiting'      WHERE status = 'pending';
UPDATE leads SET status = 'thinking'     WHERE status = 'confirmed';
UPDATE leads SET status = 'thinking'     WHERE status = 'contacted';
UPDATE leads SET status = 'thinking'     WHERE status = 'qualified';
UPDATE leads SET status = 'meeting_set'  WHERE status = 'won';
UPDATE leads SET status = 'not_relevant' WHERE status = 'lost';
