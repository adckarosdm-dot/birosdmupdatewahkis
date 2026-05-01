# Portal CMS Biro SDM Polda Bali

Project ini adalah starter website statis dengan CMS admin.

Fitur utama:
- Halaman publik: beranda, profil, visi-misi, pejabat, bagian/fungsi, pengumuman, berita, galeri, dokumen, kontak.
- Admin CMS: login, edit pengaturan website, kelola pejabat, bagian, berita, galeri, dokumen, dan pengumuman.
- Database: Supabase.
- Upload file/foto: Supabase Storage bucket `media`.
- Hosting: bisa GitHub Pages, Vercel, Netlify, atau hosting statis lain.

## Struktur File

```text
ro-sdm-polda-bali-cms/
  index.html
  admin.html
  vercel.json
  supabase-schema.sql
  assets/
    css/style.css
    js/config.js
    js/public.js
    js/admin.js
```

## Cara Setup Supabase

1. Buat project baru di Supabase.
2. Buka SQL Editor.
3. Copy semua isi `supabase-schema.sql`.
4. Jalankan SQL tersebut.
5. Buka Authentication -> Users.
6. Buat user admin dengan email dan password.
7. Kembali ke SQL Editor.
8. Jalankan perintah bootstrap admin di bagian bawah `supabase-schema.sql`, ganti emailnya dengan email admin yang dibuat.

Contoh:

```sql
insert into public.admin_users (user_id, name, role, is_active)
select id, 'Super Admin', 'super_admin', true
from auth.users
where email = 'admin@emailkamu.com'
on conflict (user_id) do update set role = 'super_admin', is_active = true;
```

## Cara Sambungkan Website ke Supabase

Buka file:

```text
assets/js/config.js
```

Ganti:

```js
SUPABASE_URL: "ISI_SUPABASE_URL_KAMU",
SUPABASE_ANON_KEY: "ISI_SUPABASE_ANON_KEY_KAMU",
```

Dengan data dari Supabase Project Settings -> API.

Catatan penting:
- `anon key` boleh dipakai di frontend.
- Jangan pernah masukkan `service_role key` ke file frontend.

## Cara Tes Lokal

Buka terminal di folder project, lalu jalankan:

```bash
python3 -m http.server 8080
```

Buka:

```text
http://localhost:8080
http://localhost:8080/admin.html
```

## Cara Upload ke GitHub + Vercel

1. Buat repository GitHub.
2. Upload semua file project ini.
3. Masuk ke Vercel.
4. Import repository GitHub tersebut.
5. Deploy.
6. Admin bisa dibuka di:

```text
https://domain-kamu.com/admin
```

Karena sudah ada `vercel.json`, route `/admin` diarahkan ke `admin.html`.

## Menu Admin yang Bisa Diedit

- Website: nama, tagline, hero, profil, visi, misi, kontak, media sosial.
- Pejabat: nama, pangkat, jabatan, foto, deskripsi, urutan, status aktif.
- Bagian: Bag Dalpers, Bag Binkar, Bag Watpers, Bag Psi, Subbag Renmin, atau bagian lain.
- Berita: judul, kategori, foto, isi, status draft/published/archived.
- Galeri: foto/video, album, judul, status aktif.
- Dokumen: PDF/file, kategori, tahun, status publik.
- Pengumuman: judul, isi, tanggal aktif, lampiran, prioritas.

## Status Konten

Konten akan tampil di halaman publik jika:
- Pejabat: `is_active = true`
- Bagian: `is_active = true`
- Berita: `status = published`
- Galeri: `is_active = true`
- Dokumen: `is_public = true`
- Pengumuman: `status = published` dan tanggalnya masih aktif

## Keamanan

Project ini sudah menggunakan Row Level Security (RLS):
- Publik hanya bisa membaca konten yang memang dipublikasikan.
- Admin yang login dan terdaftar di tabel `admin_users` bisa tambah/edit/hapus konten.
- Upload file hanya bisa dilakukan admin.

