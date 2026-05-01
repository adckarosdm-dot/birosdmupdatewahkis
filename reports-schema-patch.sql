-- Reports / Pelaporan Satker Polres
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  polres_name text,
  bag_subbag text,
  title text,
  activity_date date,
  description text,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reports add column if not exists polres_name text;
alter table public.reports add column if not exists bag_subbag text;
alter table public.reports add column if not exists title text;
alter table public.reports add column if not exists activity_date date;
alter table public.reports add column if not exists description text;
alter table public.reports add column if not exists image_url text;
alter table public.reports add column if not exists created_at timestamptz default now();
alter table public.reports add column if not exists updated_at timestamptz default now();

alter table public.reports enable row level security;

drop policy if exists "Public manage reports" on public.reports;
create policy "Public manage reports"
on public.reports
for all
to public
using (true)
with check (true);
