create table if not exists public.configurator_link_tokens (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  locale text not null default 'he',
  prefill_config jsonb default null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_configurator_link_tokens_offer_id
  on public.configurator_link_tokens (offer_id);

create index if not exists idx_configurator_link_tokens_expires_at
  on public.configurator_link_tokens (expires_at desc);

alter table public.configurator_link_tokens enable row level security;

alter table public.pergola_config_submissions
  add column if not exists offer_id uuid references public.offers (id) on delete set null;

alter table public.pergola_config_submissions
  add column if not exists configurator_token_id uuid references public.configurator_link_tokens (id) on delete set null;

alter table public.offers
  add column if not exists configurator_meta jsonb;

comment on column public.offers.configurator_meta is '3D configurator: viewUrl, previewImageUrl, lastSubmissionId, updatedAt';

create index if not exists idx_pergola_config_submissions_offer_id
  on public.pergola_config_submissions (offer_id);
