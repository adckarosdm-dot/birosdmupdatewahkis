-- =========================================================
-- DATABASE SCHEMA FINAL - PORTAL BIRO SDM POLDA BALI
-- Jalankan sekali di Supabase SQL Editor untuk deploy baru.
-- Setelah itu buat user di Authentication, lalu jalankan bagian BOOTSTRAP USER di bawah.
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'admin' check (role in ('super_admin', 'admin', 'operator', 'viewer', 'reports_editor')),
  section text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  site_name text default 'RO SDM',
  tagline text,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  about_title text,
  about_body text,
  vision text,
  mission text,
  address text,
  email text,
  phone text,
  instagram_url text,
  facebook_url text,
  youtube_url text,
  tiktok_url text,
  x_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.officers (
  id uuid primary key default gen_random_uuid(),
  rank text,
  name text not null,
  position text not null,
  photo_url text,
  description text,
  duties text,
  sort_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duties text,
  sort_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default 'Berita',
  body text not null,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  album text,
  description text,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  sort_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  file_url text not null,
  year int,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  attachment_url text,
  start_date date,
  end_date date,
  is_pinned boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  polres_name text,
  bag_subbag text,
  title text,
  activity_date date,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward-safe columns for existing databases.
alter table public.reports add column if not exists polres_name text;
alter table public.reports add column if not exists bag_subbag text;
alter table public.reports add column if not exists title text;
alter table public.reports add column if not exists activity_date date;
alter table public.reports add column if not exists description text;
alter table public.reports add column if not exists image_url text;
alter table public.reports add column if not exists created_at timestamptz not null default now();
alter table public.reports add column if not exists updated_at timestamptz not null default now();

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists officers_active_sort_idx on public.officers(is_active, sort_order);
create index if not exists sections_active_sort_idx on public.sections(is_active, sort_order);
create index if not exists news_status_published_idx on public.news(status, published_at desc);
create index if not exists gallery_active_created_idx on public.gallery(is_active, created_at desc);
create index if not exists documents_public_created_idx on public.documents(is_public, created_at desc);
create index if not exists announcements_status_pinned_idx on public.announcements(status, is_pinned desc, created_at desc);
create index if not exists reports_created_idx on public.reports(created_at desc);
create index if not exists reports_filter_idx on public.reports(polres_name, bag_subbag, activity_date);

-- =========================================================
-- AUTH HELPER FUNCTIONS
-- =========================================================

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

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.officers enable row level security;
alter table public.sections enable row level security;
alter table public.news enable row level security;
alter table public.gallery enable row level security;
alter table public.documents enable row level security;
alter table public.announcements enable row level security;
alter table public.reports enable row level security;

-- ADMIN USERS

drop policy if exists "Users can read own admin profile" on public.admin_users;
create policy "Users can read own admin profile"
on public.admin_users for select
to authenticated
using (user_id = auth.uid() and is_active = true);

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists "Admins can manage admin users" on public.admin_users;
create policy "Admins can manage admin users"
on public.admin_users for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- SITE SETTINGS

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings"
on public.site_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- OFFICERS

drop policy if exists "Public can read active officers" on public.officers;
create policy "Public can read active officers"
on public.officers for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage officers" on public.officers;
create policy "Admins can manage officers"
on public.officers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- SECTIONS

drop policy if exists "Public can read active sections" on public.sections;
create policy "Public can read active sections"
on public.sections for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage sections" on public.sections;
create policy "Admins can manage sections"
on public.sections for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- NEWS

drop policy if exists "Public can read published news" on public.news;
create policy "Public can read published news"
on public.news for select
to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "Admins can manage news" on public.news;
create policy "Admins can manage news"
on public.news for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- GALLERY

drop policy if exists "Public can read active gallery" on public.gallery;
create policy "Public can read active gallery"
on public.gallery for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage gallery" on public.gallery;
create policy "Admins can manage gallery"
on public.gallery for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- DOCUMENTS

drop policy if exists "Public can read public documents" on public.documents;
create policy "Public can read public documents"
on public.documents for select
to anon, authenticated
using (is_public = true or public.is_admin());

drop policy if exists "Admins can manage documents" on public.documents;
create policy "Admins can manage documents"
on public.documents for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ANNOUNCEMENTS

drop policy if exists "Public can read published announcements" on public.announcements;
create policy "Public can read published announcements"
on public.announcements for select
to anon, authenticated
using (
  public.is_admin()
  or (
    status = 'published'
    and (start_date is null or start_date <= current_date)
    and (end_date is null or end_date >= current_date)
  )
);

drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements"
on public.announcements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- REPORTS
-- Reports tampil di halaman publik. Insert/update/delete hanya admin atau reports_editor.

drop policy if exists "Public manage reports" on public.reports;
drop policy if exists "Authenticated can read reports" on public.reports;
drop policy if exists "Public can read reports" on public.reports;
drop policy if exists "Admins and reports editor can manage reports" on public.reports;

create policy "Public can read reports"
on public.reports for select
to anon, authenticated
using (true);

create policy "Admins and reports editor can manage reports"
on public.reports for all
to authenticated
using (public.is_admin() or public.is_reports_editor())
with check (public.is_admin() or public.is_reports_editor());

-- =========================================================
-- STORAGE
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "Media public read" on storage.objects;
create policy "Media public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'media');

drop policy if exists "Media admin insert" on storage.objects;
create policy "Media admin insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "Media admin update" on storage.objects;
create policy "Media admin update"
on storage.objects for update
to authenticated
using (bucket_id = 'media' and public.is_admin())
with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "Media admin delete" on storage.objects;
create policy "Media admin delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'media' and public.is_admin());

drop policy if exists "Media reports editor insert" on storage.objects;
create policy "Media reports editor insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'media' and public.is_reports_editor() and name like 'reports/%');

drop policy if exists "Media reports editor update" on storage.objects;
create policy "Media reports editor update"
on storage.objects for update
to authenticated
using (bucket_id = 'media' and public.is_reports_editor() and name like 'reports/%')
with check (bucket_id = 'media' and public.is_reports_editor() and name like 'reports/%');

drop policy if exists "Media reports editor delete" on storage.objects;
create policy "Media reports editor delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'media' and public.is_reports_editor() and name like 'reports/%');

-- =========================================================
-- DEFAULT DATA
-- =========================================================

insert into public.site_settings (
  id, site_name, tagline, hero_title, hero_subtitle, hero_image_url,
  about_title, about_body, vision, mission, address, email, phone,
  instagram_url, facebook_url, youtube_url, tiktok_url, x_url
)
values (
  1,
  'RO SDM',
  'Portal Digital Biro SDM',
  'SDM Polri Unggul',
  'Manajemen informasi SDM Polri Polda Bali yang modern, transparan, dan akuntabel.',
  'https://ui-avatars.com/api/?name=RO+SDM+POLDA+BALI&background=FFEB3B&color=1A237E&size=900&bold=true',
  'Biro SDM Polda Bali',
  'Biro SDM Polda Bali menyelenggarakan pembinaan dan pengelolaan sumber daya manusia Polri di lingkungan Polda Bali.',
  'Terwujudnya SDM Polri Polda Bali yang unggul, profesional, modern, dan berintegritas.',
  'Menyelenggarakan manajemen SDM yang transparan dan akuntabel.
Meningkatkan kompetensi dan profesionalisme personel.
Melaksanakan pembinaan karier secara objektif dan berkelanjutan.
Mengoptimalkan pelayanan administrasi SDM berbasis digital.',
  'Polda Bali, Denpasar, Bali',
  '-',
  '-',
  'https://www.instagram.com/biro_sdm_polda_bali',
  'https://www.facebook.com/ro.sdm.polda.bali',
  'https://www.youtube.com/@BiroSDMPoldaBali',
  'https://www.tiktok.com/@sdm_polda_bali',
  'https://x.com/birosdmbali'
)
on conflict (id) do nothing;

insert into public.officers (id, rank, name, position, photo_url, description, sort_order, is_active)
values
('00000000-0000-0000-0000-000000000001', '', 'KOMPOL DAYU KALPIKA', 'KASUBAG RENMIN', 'https://ui-avatars.com/api/?name=DAYU+KALPIKA&background=FFEB3B&color=1A237E&size=400&bold=true', 'Pejabat Subbag Renmin.', 1, true),
('00000000-0000-0000-0000-000000000002', '', 'AKBP GEDE JUNAEDI', 'KABAG DALPERS', 'https://ui-avatars.com/api/?name=GEDE+JUNAEDI&background=FFEB3B&color=1A237E&size=400&bold=true', 'Pejabat Bag Dalpers.', 2, true),
('00000000-0000-0000-0000-000000000003', '', 'AKBP MICHAEL RISAKOTTA', 'KABAG BINKAR', 'https://ui-avatars.com/api/?name=MICHAEL+RISAKOTTA&background=FFEB3B&color=1A237E&size=400&bold=true', 'Pejabat Bag Binkar.', 3, true),
('00000000-0000-0000-0000-000000000004', '', 'KABAG WATPERS', 'KABAG WATPERS', 'https://ui-avatars.com/api/?name=WATPERS&background=E5E7EB&color=111827&size=400&bold=true', 'Pejabat Bag Watpers.', 4, true),
('00000000-0000-0000-0000-000000000005', '', 'AKBP I NYOMAN WIBAWA', 'KABAG PSI', 'https://ui-avatars.com/api/?name=I+NYOMAN+WIBAWA&background=FFEB3B&color=1A237E&size=400&bold=true', 'Pejabat Bag Psi.', 5, true)
on conflict (id) do nothing;

insert into public.sections (id, name, description, duties, sort_order, is_active)
values
('10000000-0000-0000-0000-000000000001', 'BAG DALPERS', 'Pelayanan penyediaan personel, seleksi, dan administrasi penerimaan anggota Polri.', 'Seleksi penerimaan, administrasi pendidikan, dan pengelolaan personel.', 1, true),
('10000000-0000-0000-0000-000000000002', 'BAG BINKAR', 'Pembinaan karier, kepangkatan, mutasi jabatan, dan asesmen kompetensi.', 'UKP, mutasi jabatan, asesmen, dan pengembangan karier.', 2, true),
('10000000-0000-0000-0000-000000000003', 'BAG WATPERS', 'Perawatan personel, kesejahteraan, rohani jasmani, dan penghargaan.', 'Pembinaan mental, jasmani, kesejahteraan, dan administrasi akhir dinas.', 3, true),
('10000000-0000-0000-0000-000000000004', 'BAG PSI', 'Pelayanan psikologi kepolisian dan psikologi personel.', 'Psikologi operasional, psikologi personel, dan pemeriksaan psikologi.', 4, true),
('10000000-0000-0000-0000-000000000005', 'SUBBAG RENMIN', 'Perencanaan, administrasi, tata usaha, keuangan, dan logistik internal.', 'Renja, DIPA, tata usaha, keuangan, dan inventaris.', 5, true)
on conflict (id) do nothing;

insert into public.news (id, title, category, body, image_url, status, published_at)
values (
  '20000000-0000-0000-0000-000000000001',
  'Selamat Datang di Portal Biro SDM Polda Bali',
  'INFORMASI',
  'Berita ini adalah contoh awal. Setelah Supabase tersambung, admin dapat menghapus dan mengganti berita melalui dashboard.',
  'https://via.placeholder.com/900x600/FFEB3B/1A237E?text=RO+SDM+BALI',
  'published',
  now()
)
on conflict (id) do nothing;

-- =========================================================
-- BOOTSTRAP USER
-- Jalankan setelah user dibuat di Supabase Dashboard -> Authentication -> Users.
-- =========================================================

-- Admin utama:
-- insert into public.admin_users (user_id, name, role, is_active)
-- select id, 'Super Admin', 'super_admin', true
-- from auth.users
-- where email = 'adckarosdm@gmail.com'
-- on conflict (user_id) do update set name = excluded.name, role = excluded.role, is_active = true, updated_at = now();

-- Editor pelaporan saja:
-- insert into public.admin_users (user_id, name, role, is_active)
-- select id, 'Editor Pelaporan', 'reports_editor', true
-- from auth.users
-- where email = 'editportal@gmail.com'
-- on conflict (user_id) do update set name = excluded.name, role = excluded.role, is_active = true, updated_at = now();
