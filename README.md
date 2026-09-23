# TOKO AZKIA — Sistem POS + Toko Online

**Versi: TOKO AZKIA V1.0.0**
*"Melayani Kebutuhan, Membangun Kepercayaan."*

Sistem manajemen toko lengkap untuk TOKO AZKIA: kasir (POS), stok, pembelian, toko online
(pickup & delivery), laporan, hingga backup — dibangun di atas Google Sheets + Google Apps
Script (backend) dan PWA statis (frontend, di-hosting gratis di GitHub Pages).

Dikembangkan oleh **FATUR RIZKY FAHRIANSYAH**, 2026.

---

## Isi Paket

```
toko-azkia-v1/
├── README.md                 <- Anda di sini
├── CHANGELOG.md
├── frontend/                  <- Upload ISI folder ini ke GitHub Pages
│   ├── index.html, manifest.json, sw.js, offline.html
│   ├── css/, js/, assets/
│   ├── internal/               <- 12 modul area staf (kasir, produk, stok, dst.)
│   └── shop/                   <- 7 modul toko online (katalog, keranjang, checkout, dst.)
├── backend/                   <- Salin SEMUA file .gs ini ke 1 project Google Apps Script
│   └── 31 file .gs (lihat daftar di bawah)
└── docs/
    ├── DEPLOYMENT.md           <- PANDUAN UTAMA: 22 tahap dari nol sampai go-live
    ├── CONFIGURATION.md        <- Script Properties, QRIS, printer, dsb.
    ├── USER_GUIDE.md           <- Cara pakai harian (Pemilik/Pengelola/Kasir)
    ├── TESTING_CHECKLIST.md    <- Checklist uji sebelum go-live
    ├── TROUBLESHOOTING.md
    └── KNOWN_LIMITATIONS.md    <- WAJIB DIBACA sebelum go-live
```

## Mulai Dari Mana?

**Baru pertama kali deploy?** Buka `docs/DEPLOYMENT.md` dan ikuti TAHAP 1 sampai TAHAP 22
berurutan — setiap langkah menjelaskan apa yang dibuka, apa yang diklik, file apa yang dipakai,
dan hasil yang seharusnya muncul.

Setelah sistem berjalan, gunakan `docs/USER_GUIDE.md` untuk operasional harian, dan
`docs/CONFIGURATION.md` kapan pun perlu mengubah pengaturan.

## Ringkasan Arsitektur

```
Pembeli / Kasir / Pemilik
        │  (HTTPS)
        ▼
Frontend PWA (HTML/CSS/JS statis - GitHub Pages)
        │  (fetch POST JSON, satu endpoint)
        ▼
Backend Google Apps Script (Web App) — 01_Router.gs sebagai satu pintu masuk
        │
        ▼
Google Sheets (31 sheet = database)  +  Google Drive (backup otomatis)
```

- **Satu titik masuk API**: semua aksi (kasir, produk, stok, pesanan, laporan, dst.) lewat
  satu endpoint Web App dengan `{action, token, payload}`. Lihat daftar 79 action di
  `backend/01_Router.gs` dan permission-nya di `backend/42_Validation.gs`.
- **Dua role internal**: PEMILIK (akses penuh) dan PENGELOLA (semua kecuali Pengguna,
  Audit Log, Backup, dan Konfigurasi Sistem sensitif). Kasir adalah *modul*, bukan role
  terpisah — dipakai oleh Pemilik maupun Pengelola.
- **Stock ledger**: `30_STOCK_MOVEMENTS` adalah satu-satunya sumber kebenaran stok. Tidak ada
  modul yang mengubah `current_stock`/`reserved_stock` di `05_PRODUCTS` secara langsung — selalu
  lewat `backend/13_Stock.gs`.
- **Reservasi pesanan online**: checkout menaikkan `reserved_stock` (stok belum benar-benar
  dipotong); pembayaran dikonfirmasi staf → `current_stock` baru benar-benar berkurang
  (*commit*). Pembatalan sebelum commit → `reserved_stock` dilepas kembali (*release*).

## Penyesuaian dari Spesifikasi Awal (dan Alasannya)

Beberapa file/keputusan kecil ditambahkan di luar daftar minimal pada spesifikasi awal, semua
adalah *detail teknis* (bukan perubahan struktur/keamanan/transaksi inti) sesuai instruksi untuk
memakai "keputusan teknis paling aman dan masuk akal" tanpa berhenti bertanya:

| Item | Keputusan | Alasan |
|---|---|---|
| Pembelian (Barang Masuk) | Tanpa Purchase Order formal terpisah di V1 | Sesuai asumsi yang sudah ditandai `[NEED DECISION]` di spesifikasi V1 — alur langsung "barang datang → input → konfirmasi" lebih sederhana untuk toko kelontong; PO formal bisa ditambahkan di V1.1/V2 tanpa mengubah skema. |
| Stock Opname | Snapshot stok sistem saat opname dimulai, TIDAK mengunci penjualan produk yang sedang dihitung | Mengunci penjualan selama opname akan mengganggu operasional kasir; selisih tetap tercatat & butuh alasan wajib saat konfirmasi. |
| Rate limiting | Login: 5 percobaan/15 menit per username. Checkout publik: 10 percobaan/jam per nomor HP | Nilai default aman yang lazim dipakai; dapat disesuaikan langsung di `backend/02_Auth.gs` dan `backend/20_OnlineOrders.gs` jika toko butuh nilai lain. |
| QRIS timeout | Tidak ada timeout otomatis di V1 (status tetap "menunggu pembayaran" sampai staf konfirmasi manual atau pesanan dibatalkan manual) | V1 QRIS statis + konfirmasi manual, bukan payment gateway otomatis — timeout otomatis baru relevan saat Dynamic QRIS (V1.1+) diaktifkan. |
| IP address di Audit Log | Kolom `ip_address` selalu kosong | Google Apps Script Web App tidak mengekspos IP klien secara andal — lihat `docs/KNOWN_LIMITATIONS.md`. |
| `backend/45_System.gs` | File tambahan (Audit Log, Backup, System Config, Pengaturan Toko) | Spesifikasi minimal tidak merinci file untuk area ini; dikelompokkan di sini agar kohesif. |
| `frontend/js/layout.js`, `router.js`, `cart-state.js`, `js/printer/*` | File tambahan di luar daftar folder minimal | Diperlukan untuk menyatukan SPA tanpa framework/build-tool (sesuai arsitektur PWA statis) dan untuk abstraksi printer. |
| `internal/settings.js`, `internal/orders.js` | File tambahan di luar daftar folder minimal | Pengaturan Toko/Ongkir/Sistem/Audit/Backup dan Kelola Pesanan Online butuh UI tersendiri yang tidak disebutkan di daftar minimal folder `internal/`. |

Tidak ada perubahan pada struktur database inti, alur transaksi, keamanan, atau hak akses di
luar yang sudah disepakati pada Prompt 1 & 2 — hanya satu penambahan field yang sudah diajukan
sebelumnya (`reserved_stock` pada `05_PRODUCTS`, untuk mendukung reservasi stok pesanan online).

## Keamanan — Ringkasan

Lihat detail lengkap di `docs/CONFIGURATION.md` dan `docs/KNOWN_LIMITATIONS.md`. Ringkasnya:
password di-hash (salted + stretched SHA-256, bukan plaintext), permission ditegakkan di
backend (bukan hanya disembunyikan di UI), Public API memakai whitelist field (harga beli/
supplier/rak TIDAK PERNAH terekspos ke publik), setiap transaksi terkunci (`LockService`)
agar tidak terjadi race condition, dan seluruh secret (kredensial QRIS, dsb.) hanya disimpan
di Script Properties backend — tidak pernah di kode frontend atau repository GitHub.
