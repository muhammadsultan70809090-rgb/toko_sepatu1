# SneakerSpace

Digital sneaker showroom + admin studio. Editorial campaign-style storefront, interactive rack, product detail with a 360° viewer inside **DETAIL**, shopping bag with WhatsApp checkout, and a full admin dashboard backed by SQLite.

## Stack

- **Frontend** — HTML, CSS and native ES modules in `public/`
- **Backend** — Express 4 (`server/`)
- **Database** — SQLite via Node's built-in `node:sqlite` (`data/sneakerspace.db`, dibuat otomatis)

## Menjalankan

```bash
npm install
npm start          # http://localhost:3000
```

Node.js **22.5+** diperlukan karena memakai modul `node:sqlite`. Database dan data seed dibuat otomatis pada jalankan pertama.

## Halaman

| URL | Deskripsi |
| --- | --- |
| `/` | Homepage: hero kampanye, kategori, showroom rack, campaign banner, koleksi dengan filter |
| `/produk/:id` | Halaman detail produk; tombol **DETAIL** membuka spesifikasi + viewer 360° |
| `/admin/login` | Login administrator |
| `/admin` | Dashboard admin (dilindungi sesi) |

## Admin

Kredensial prototipe: **admin / admin**.

Menu: Dashboard, Products, Categories, Inventory, Orders, Store Settings, Logout.

- **Products** — CRUD lengkap, unggah foto, editor ukuran + stok per ukuran, warna, dan 24–36 frame 360°.
- **Categories** — CRUD, jumlah produk per kategori; kategori yang masih dipakai tidak bisa dihapus.
- **Inventory** — stok per ukuran EU, indikator stok menipis/habis, warna per produk.
- **Orders** — pesanan dibuat saat checkout, status Pending → Diproses → Dikirim → Selesai / Dibatalkan. Pembatalan mengembalikan stok.
- **Store Settings** — nama toko, logo teks/gambar, WhatsApp, kontak, announcement, hero, banner, dan teks about. Perubahan langsung tampil di storefront.

## Deploy

### Vercel

Repo sudah disiapkan untuk Vercel: entry Express ada di `app.js` (root) dan `vercel.json` menetapkan `framework: express` sehingga Vercel tidak lagi mencoba `next build`.

1. Pastikan **Framework Preset** proyek = **Express** (atau biarkan `vercel.json` menimpanya).
2. Deploy ulang. Folder `public/**` disajikan Vercel dari CDN; seluruh `/api/*` dilayani Express sebagai satu Vercel Function.
3. Atur env `ADMIN_USERNAME`, `ADMIN_PASSWORD` di Project Settings → Environment Variables bila tidak ingin memakai kredensial demo.

> **Penting:** Vercel Functions hanya mengizinkan penulisan ke `/tmp`, dan penyimpanan itu tidak persisten. Di Vercel, database (`/tmp/sneakerspace/sneakerspace.db`) dan gambar unggahan akan kembali ke data seed ketika instance didaur ulang, dan beberapa instance bisa memiliki salinan berbeda. Cocok untuk preview/demo, bukan operasional toko.
>
> Untuk produksi dengan data yang benar-benar persisten, deploy ke host Node dengan disk (Render, Railway, Fly.io) lalu set `DB_FILE=/data/sneakerspace.db`, `UPLOAD_DIR=/data/uploads`, dan `COOKIE_SECURE=1`.

### Host Node dengan disk persisten

```bash
npm install
DB_FILE=/data/sneakerspace.db UPLOAD_DIR=/data/uploads \
ADMIN_USERNAME=owner ADMIN_PASSWORD='sandi-kuat' COOKIE_SECURE=1 npm start
```

## Keamanan

- Password admin di-hash dengan `scrypt` + salt; sesi disimpan di database dan dikirim sebagai cookie `HttpOnly`, `SameSite=Strict`.
- Semua endpoint admin memerlukan sesi; mutasi memeriksa `Origin` (same-origin).
- Login dibatasi 8 percobaan per 10 menit per IP.
- Untuk produksi, set `ADMIN_USERNAME` dan `ADMIN_PASSWORD` sebelum database pertama kali dibuat, lalu ganti kredensial demo:

```bash
ADMIN_USERNAME=owner ADMIN_PASSWORD='kata-sandi-kuat' npm start
```

Set `COOKIE_SECURE=1` bila dijalankan di belakang HTTPS. `PORT` dan `DB_FILE` juga dapat diatur lewat environment.

## Struktur

```
app.js                # Express app + Vercel entry (export default app)
vercel.json           # framework express, rewrites halaman statis
server/
  index.js            # runner lokal (app.listen)
  db.js               # koneksi SQLite, schema, serializer
  seed.js             # data awal kategori, produk, pengaturan
  auth.js             # hashing, sesi, rate limit, same-origin
  catalog.js          # validasi + CRUD produk/kategori
  validation.js
  routes/
    store.js          # katalog publik, detail produk, pembuatan pesanan
    auth.js           # login / logout / sesi
    admin.js          # dashboard, produk, kategori, inventory, order, settings
    upload.js         # unggah gambar produk/logo/banner
public/
  index.html, product.html, 404.html
  css/site.css
  js/                 # api, util, bag, viewer, home, product, card, site
  admin/              # login.html, index.html, css, js/views/*
uploads/              # file unggahan (dibuat saat runtime)
```

Environment opsional: `PORT`, `DB_FILE`, `UPLOAD_DIR`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `COOKIE_SECURE`.
Di Vercel, database dan upload otomatis diarahkan ke `/tmp` (sementara).
