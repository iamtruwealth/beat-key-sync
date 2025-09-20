-- Create table to curate featured beat packs
create table if not exists public.featured_beat_packs (
  id uuid primary key default gen_random_uuid(),
  beat_pack_id uuid not null references public.beat_packs(id) on delete cascade,
  position integer not null default 0,
  added_by uuid not null,
  created_at timestamptz not null default now(),
  unique(beat_pack_id)
);

-- Enable RLS
alter table public.featured_beat_packs enable row level security;

-- Policies
create policy if not exists "Anyone can view featured beat packs"
  on public.featured_beat_packs for select
  using (true);

create policy if not exists "Only master can insert featured packs"
  on public.featured_beat_packs for insert
  with check ((current_setting('request.jwt.claims', true)::json ->> 'email') = 'iamtruwealth@gmail.com');

create policy if not exists "Only master can update featured packs"
  on public.featured_beat_packs for update
  using ((current_setting('request.jwt.claims', true)::json ->> 'email') = 'iamtruwealth@gmail.com');

create policy if not exists "Only master can delete featured packs"
  on public.featured_beat_packs for delete
  using ((current_setting('request.jwt.claims', true)::json ->> 'email') = 'iamtruwealth@gmail.com');