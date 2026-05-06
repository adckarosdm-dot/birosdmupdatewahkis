-- Set akun editportal@gmail.com sebagai admin terbatas pelaporan saja
-- Jalankan di Supabase SQL Editor

insert into public.admin_users (user_id, name, role, is_active)
select id, 'Admin Pelaporan', 'reports_editor', true
from auth.users
where email = 'editportal@gmail.com'
on conflict (user_id) do update
set role = 'reports_editor',
    is_active = true,
    updated_at = now();

-- (Opsional) pastikan akun utama tetap super admin
-- insert into public.admin_users (user_id, name, role, is_active)
-- select id, 'Super Admin', 'super_admin', true
-- from auth.users
-- where email = 'addkarosdm@gmail.com'
-- on conflict (user_id) do update
-- set role = 'super_admin', is_active = true, updated_at = now();
