-- Pergola projects table to store dynamic projects (instead of static JSON)
create table if not exists public.pergola_projects (
  id uuid primary key default gen_random_uuid(),
  title_he text not null,
  title_ru text,
  title_en text,
  desc_he text,
  desc_ru text,
  desc_en text,
  images text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Index for ordering
create index if not exists idx_pergola_projects_created_at on public.pergola_projects(created_at desc);

-- RLS (public read, service role full)
alter table public.pergola_projects enable row level security;

create policy "Public can read pergola_projects"
  on public.pergola_projects for select
  to public
  using (true);

create policy "Service role can do everything on pergola_projects"
  on public.pergola_projects for all
  to service_role
  using (true) with check (true);






