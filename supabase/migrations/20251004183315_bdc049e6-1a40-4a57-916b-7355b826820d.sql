-- Ensure profiles has required columns used by the edge function
alter table public.profiles add column if not exists ip_address text;
alter table public.profiles add column if not exists plan text not null default 'free';
create index if not exists idx_profiles_ip_address on public.profiles (ip_address);
