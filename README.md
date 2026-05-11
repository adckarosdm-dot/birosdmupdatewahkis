# Portal CMS Biro SDM Polda Bali

Website statis + CMS admin untuk Portal Biro SDM Polda Bali.

## Fitur

- Halaman publik: profil, visi-misi, pejabat, bagian/fungsi, berita/kegiatan, grafik pelaporan, galeri, dokumen, pengumuman, kontak.
- CMS admin: login Supabase, edit konten website, upload foto/file, export Excel pelaporan.
- Role khusus `reports_editor`: hanya bisa membuka dan mengelola menu Pelaporan.
- Database dan storage: Supabase.
- Hosting: Vercel atau hosting statis lain.

## Struktur File Utama

```text
/
  index.html                 # Halaman publik
  admin.html                 # Halaman CMS admin
  vercel.json                # Route /admin ke /admin.html
  supabase-schema.sql        # Satu-satunya file SQL utama untuk deploy baru
  assets/
    css/style.css
    img/logo.png
    js/config.js             # Konfigurasi Supabase aktif
    js/public.js             # Controller halaman publik
    js/admin-v2.js           # Controller CMS admin final/terstruktur
  admin/
    index.html               # Redirect fallback ke /admin.html
```

## Deploy Baru ke Domain Baru

1. Import repository ini ke Vercel.
2. Tambahkan domain baru di Vercel.
3. Buat project baru di Supabase.
4. Buka `assets/js/config.js`, lalu isi dengan data Supabase baru:

```js
window.ROSDM_CONFIG = {
  SUPABASE_URL: "https://PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "ISI_ANON_KEY_SUPABASE",
  STORAGE_BUCKET: "media"
};
```

5. Buka Supabase -> SQL Editor.
6. Jalankan seluruh isi file:

```text
supabase-schema.sql
```

7. Buka Supabase -> Authentication -> Users.
8. Buat user admin dan user pelaporan sesuai kebutuhan.
9. Jalankan query bootstrap user di bagian bawah file `supabase-schema.sql`.

## Bootstrap Admin Utama

Jalankan setelah user dibuat di Supabase Authentication:

```sql
insert into public.admin_users (user_id, name, role, is_active)
select id, 'Super Admin', 'super_admin', true
from auth.users
where email = 'adckarosdm@gmail.com'
on conflict (user_id) do update
set name = excluded.name,
    role = excluded.role,
    is_active = true,
    updated_at = now();
```

## Bootstrap Admin Pelaporan Saja

Untuk akun yang hanya boleh akses menu Pelaporan:

```sql
insert into public.admin_users (user_id, name, role, is_active)
select id, 'Admin Pelaporan', 'reports_editor', true
from auth.users
where email = 'adminpolres@gmail.com'
on conflict (user_id) do update
set name = excluded.name,
    role = excluded.role,
    is_active = true,
    updated_at = now();
```

Role `reports_editor` hanya bisa:

- login ke CMS;
- melihat Dashboard dan Pelaporan;
- tambah/edit/hapus laporan;
- upload file ke folder `reports/` pada bucket `media`.

## Akses Admin

Setelah deploy:

```text
https://domain-kamu.com/admin
```

atau langsung:

```text
https://domain-kamu.com/admin.html
```

## Tes Lokal

Jalankan server lokal dari folder project:

```bash
python3 -m http.server 8080
```

Buka:

```text
http://localhost:8080
http://localhost:8080/admin.html
```

## Keamanan

- Jangan pernah menaruh `service_role key` di file frontend.
- `anon key` boleh digunakan di frontend.
- Semua tabel memakai Row Level Security.
- Publik hanya membaca data yang memang boleh tampil.
- Admin penuh bisa kelola semua konten.
- `reports_editor` hanya bisa kelola tabel `reports` dan file folder `reports/`.

## Catatan Penting

Untuk deploy baru, cukup gunakan satu file SQL:

```text
supabase-schema.sql
```

File patch lama sudah tidak dipakai lagi agar struktur deployment lebih bersih.
