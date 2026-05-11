-- =========================================================
-- FIX LOGIN ADMIN + TAMPILKAN PELAPORAN DI HALAMAN PUBLIK
-- Jalankan file ini di Supabase SQL Editor untuk database yang sudah terlanjur dibuat.
-- Ganti email di bagian BOOTSTRAP ADMIN sesuai akun Supabase Authentication kamu.
-- =========================================================

-- Pastikan fungsi admin membaca role yang benar.
create or replace function public.is_admin()
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
      and au.role in ('super_admin', 'admin', 'operator')
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

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

-- Perbaikan penting: user yang sedang login harus bisa membaca profil admin miliknya sendiri.
-- Tanpa policy ini, akun reports_editor atau akun baru bisa gagal saat aplikasi menjalankan loadAdminProfile().
alter table public.admin_users enable row level security;

drop policy if exists "Users can read own admin profile" on public.admin_users;
create policy "Users can read own admin profile"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid() and is_active = true);

-- Tetap izinkan super_admin/admin/operator membaca dan mengelola data admin.
drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists "Admins can manage admin users" on public.admin_users;
create policy "Admins can manage admin users"
on public.admin_users
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Pastikan tabel reports ada.
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

alter table public.reports enable row level security;

-- Halaman publik public.js membaca tabel reports sebagai anon untuk kartu laporan dan grafik.
-- Jadi SELECT harus dibuka ke anon/authenticated, sedangkan INSERT/UPDATE/DELETE tetap admin/reports_editor.
drop policy if exists "Authenticated can read reports" on public.reports;
drop policy if exists "Public can read reports" on public.reports;
create policy "Public can read reports"
on public.reports
for select
to anon, authenticated
using (true);

drop policy if exists "Admins and reports editor can manage reports" on public.reports;
create policy "Admins and reports editor can manage reports"
on public.reports
for all
to authenticated
using (public.is_admin() or public.is_reports_editor())
with check (public.is_admin() or public.is_reports_editor());

-- BOOTSTRAP ADMIN UTAMA
-- Syarat: email ini sudah dibuat lebih dulu di Supabase Dashboard -> Authentication -> Users.
insert into public.admin_users (user_id, name, role, is_active)
select id, 'Super Admin', 'super_admin', true
from auth.users
where email = 'adckarosdm@gmail.com'
on conflict (user_id) do update
set name = excluded.name,
    role = excluded.role,
    is_active = true,
    updated_at = now();

-- Cek hasil setelah menjalankan file ini:
-- select au.user_id, u.email, au.name, au.role, au.is_active
-- from public.admin_users au
-- join auth.users u on u.id = au.user_id
-- order by au.created_at desc;
