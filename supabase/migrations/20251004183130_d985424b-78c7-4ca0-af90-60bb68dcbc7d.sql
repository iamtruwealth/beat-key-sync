-- Create table to track signup attempts for rate limiting
create table if not exists public.signup_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  user_agent text,
  attempted_at timestamp with time zone not null default now(),
  success boolean not null default false
);

-- Enable RLS with service-role only access
alter table public.signup_attempts enable row level security;
create policy "signup_attempts_select_service_role" on public.signup_attempts
for select using (auth.role() = 'service_role');
create policy "signup_attempts_insert_service_role" on public.signup_attempts
for insert with check (auth.role() = 'service_role');
create policy "signup_attempts_update_service_role" on public.signup_attempts
for update using (auth.role() = 'service_role');

-- Index to speed up rate limit queries
create index if not exists idx_signup_attempts_ip_time on public.signup_attempts (ip_address, attempted_at desc);

-- Ensure profiles has required columns used by the edge function
alter table public.profiles add column if not exists ip_address text;
alter table public.profiles add column if not exists plan text not null default 'free';

-- Helpful index for IP lookups
create index if not exists idx_profiles_ip_address on public.profiles (ip_address);
