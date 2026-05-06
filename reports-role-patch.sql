-- Patch: akun admin khusus Pelaporan (reports_editor)
-- Jalankan file ini di Supabase SQL Editor untuk database yang sudah live.

begin;

alter table public.admin_users
  drop constraint if exists admin_users_role_check;

alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('super_admin', 'admin', 'operator', 'viewer', 'reports_editor'));

create or replace function public.is_reports_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.is_active = true
      and au.role = 'reports_editor'
  );
$$;

grant execute on function public.is_reports_editor() to anon, authenticated;

-- Batasi akses reports: hanya admin umum atau reports_editor
drop policy if exists "Public manage reports" on public.reports;
drop policy if exists "Authenticated can read reports" on public.reports;
drop policy if exists "Admins and reports editor can manage reports" on public.reports;

create policy "Authenticated can read reports"
on public.reports
for select
to authenticated
using (public.is_admin() or public.is_reports_editor());

create policy "Admins and reports editor can manage reports"
on public.reports
for all
to authenticated
using (public.is_admin() or public.is_reports_editor())
with check (public.is_admin() or public.is_reports_editor());

-- Batasi storage reports_editor hanya folder reports/
drop policy if exists "Media reports editor insert" on storage.objects;
create policy "Media reports editor insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and public.is_reports_editor()
  and name like 'reports/%'
);

drop policy if exists "Media reports editor update" on storage.objects;
create policy "Media reports editor update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media'
  and public.is_reports_editor()
  and name like 'reports/%'
)
with check (
  bucket_id = 'media'
  and public.is_reports_editor()
  and name like 'reports/%'
);

drop policy if exists "Media reports editor delete" on storage.objects;
create policy "Media reports editor delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
  and public.is_reports_editor()
  and name like 'reports/%'
);

commit;

-- Contoh assign akun jadi reports_editor (ganti email):
-- insert into public.admin_users (user_id, name, role, is_active)
-- select id, 'Operator Pelaporan', 'reports_editor', true
-- from auth.users
-- where email = 'operator-pelaporan@contoh.com'
-- on conflict (user_id) do update
-- set role = 'reports_editor', is_active = true;
