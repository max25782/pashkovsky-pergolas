-- Store 3D configurator submissions from the site
create table if not exists public.pergola_config_submissions (
  id uuid primary key default gen_random_uuid(),
  config jsonb not null default '{}',
  screenshot text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pergola_config_submissions_created_at
  on public.pergola_config_submissions(created_at desc);

alter table public.pergola_config_submissions enable row level security;

-- Allow anonymous insert (from public site configurator)
create policy "Anyone can insert pergola_config_submissions"
  on public.pergola_config_submissions for insert
  to anon, authenticated
  with check (true);

-- Only service role can read (for CRM/admin)
create policy "Service role can read pergola_config_submissions"
  on public.pergola_config_submissions for select
  to service_role
  using (true);
