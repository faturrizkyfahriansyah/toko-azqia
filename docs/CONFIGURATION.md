# Panduan Konfigurasi — TOKO AZQIA

## 1. Script Properties (Apps Script)

Dibuat di: Apps Script Editor → ikon ⚙️ **Project Settings** → bagian **Script Properties** →
**Add script property**.

| Key | Wajib? | Contoh Nilai | Keterangan |
|---|---|---|---|
| `SPREADSHEET_ID` | **Wajib** | `1AbCdEfGhIjKlMnOpQrStUvWxYz...` | ID Google Sheets database (dari URL spreadsheet). |
| `TIMEZONE` | **Wajib** | `Asia/Jakarta` | Dipakai seluruh perhitungan tanggal/laporan. |
| `QRIS_MODE` | Opsional | `static` | `static` (default) atau `dynamic`. |
| `QRIS_STATIC_IMAGE_URL` | Fallback opsional | `https://drive.google.com/uc?id=...` | **Cara utama sekarang adalah upload lewat Pengaturan (lihat bagian 3)** - isi ini hanya jika Anda sengaja ingin mengatur lewat Script Properties tanpa login. |
| `QRIS_PROVIDER_API_KEY` | Hanya untuk Dynamic QRIS | - | Dari dashboard provider (Midtrans/Xendit/dsb). |
| `QRIS_PROVIDER_MERCHANT_ID` | Hanya untuk Dynamic QRIS | - | Dari dashboard provider. |
| `BACKUP_FOLDER_ID` | Sangat disarankan | `1XyZ...` | ID folder Google Drive tujuan backup otomatis. |
| `OWNER_NOTIFICATION_EMAIL` | Opsional | `pemilik@email.com` | Dikirimi email jika backup harian gagal. |

**Tidak ada satu pun dari nilai di atas yang boleh ditulis di file frontend (HTML/JS) atau
di-commit ke GitHub.** Semuanya hanya ada di Script Properties backend.

## 2. Konfigurasi Toko (Pengaturan)

Setelah sistem berjalan, login sebagai Pemilik → menu **Pengaturan → Profil Toko**
untuk mengisi/mengubah: nama toko, tagline, **alamat**, **kontak/WhatsApp**, dan jam operasional.
Ini SENGAJA tidak di-hardcode secara permanen — bisa diubah kapan saja tanpa mengedit kode.

Tab **Ongkir** mengatur: aktif/nonaktif delivery, ongkir flat, minimal belanja gratis ongkir,
estimasi waktu antar, jam layanan delivery.

## 3. Menyiapkan QRIS

**Cara utama (disarankan): Upload langsung dari aplikasi.**
1. Login internal (Pemilik/Pengelola) → **Pengaturan → Pembayaran**.
2. Siapkan gambar QRIS statis toko Anda (dari aplikasi bank/e-wallet merchant Anda — bukan QRIS
   pribadi), format PNG/JPG, maksimal 3MB.
3. Klik **Upload Gambar QRIS**, pilih file, klik **Upload QRIS**.
4. Sistem otomatis menyimpan gambar ke Google Drive toko dan menampilkannya di halaman ini serta
   di Kasir (metode QRIS) dan Checkout toko online — tidak perlu Script Properties sama sekali.
5. Uji: buka toko online → checkout → pilih QRIS → gambar QRIS harus muncul di halaman pembayaran.

**Cara fallback (opsional, tanpa login ke aplikasi):** jika karena suatu alasan Anda ingin
mengatur QRIS langsung dari Apps Script Editor tanpa membuka aplikasi, isi Script Property
`QRIS_STATIC_IMAGE_URL` (lihat tabel di atas) dengan URL gambar yang sudah diupload manual ke
Google Drive dan dibagikan publik. **Jika QRIS sudah pernah diupload lewat Pengaturan (cara
utama), nilai dari Pengaturan yang dipakai** — Script Property hanya dibaca sebagai cadangan
saat belum ada yang diupload lewat aplikasi.

Pembayaran QRIS statis dikonfirmasi **manual** oleh staf (menu **Pesanan Online → Konfirmasi
Pembayaran**, atau **Kasir** untuk transaksi tunai di tempat) setelah memeriksa mutasi
rekening/e-wallet toko.

## 4. Rekening Transfer Bank (Multi-Rekening)

Login internal → **Pengaturan → Pembayaran** → bagian **Rekening Transfer Bank**:
1. Isi Nama Bank, No. Rekening, dan Atas Nama, klik **+ Tambah Rekening**.
2. Bisa menambahkan lebih dari satu rekening. Nonaktifkan rekening yang sedang tidak dipakai
   lewat tombol **Nonaktifkan** di sampingnya — rekening nonaktif tidak akan tampil ke pembeli.
3. Rekening yang aktif otomatis muncul sebagai pilihan saat pembeli/kasir memilih metode
   Transfer.

## 5. Mengaktifkan Dynamic QRIS (V1.1+, butuh kredensial provider)

**Belum aktif di V1.0.0.** Untuk mengaktifkan setelah toko memiliki akun payment provider
(Midtrans, Xendit, DOKU, atau lainnya):

1. Daftar akun merchant di provider pilihan Anda, dapatkan API Key dan Merchant ID.
2. Set Script Properties: `QRIS_PROVIDER_API_KEY`, `QRIS_PROVIDER_MERCHANT_ID`.
3. Set `QRIS_MODE` = `dynamic`.
4. Buka `backend/50_QRIS.gs`, cari fungsi `generatePaymentRequestDynamic` — lengkapi kode
   `UrlFetchApp.fetch(...)` yang sudah disiapkan sebagai contoh (dikomentari) sesuai dokumentasi
   API resmi provider yang Anda pilih (setiap provider punya format request/response berbeda).
5. Deploy ulang Apps Script (**Deploy → Manage deployments → Edit → New version**).
6. Uji transaksi QRIS kecil untuk memastikan gambar QR dan status pembayaran otomatis berfungsi.

Sampai langkah di atas dilakukan, sistem akan menampilkan pesan error yang jelas
(`NOT_CONFIGURED`) jika `QRIS_MODE=dynamic` diaktifkan tanpa kredensial — bukan gagal diam-diam.

## 6. Printer Thermal Bluetooth (58mm)

Login internal → **Pengaturan → Printer** → pilih metode cetak default perangkat
kasir ini ("Cetak via Browser" atau "Printer Thermal Bluetooth").

Jika memilih Bluetooth:
1. Pastikan printer menyala dan dalam mode pairing/discoverable.
2. Gunakan aplikasi BLE scanner (mis. **nRF Connect**, gratis di Play Store) untuk memeriksa
   apakah printer Anda memancarkan service BLE (bukan Classic Bluetooth/SPP). Catat UUID
   service & characteristic yang ditemukan.
3. Jika UUID berbeda dari default di `frontend/js/printer/thermalAdapter.js`
   (`SERVICE_UUID`/`CHARACTERISTIC_UUID`), edit nilainya sesuai printer Anda, lalu publish ulang
   ke GitHub Pages.
4. Jika printer Anda ternyata Classic Bluetooth/SPP (Web Bluetooth tidak bisa menjangkaunya sama
   sekali) atau Anda memakai iPhone/iPad, gunakan "Cetak via Browser" — selalu berfungsi.

## 7. Trigger Otomatis (Backup & Ringkasan Harian)

Dijalankan otomatis setiap hari SETELAH Anda menjalankan `installDailyTriggers()` satu kali
dari editor Apps Script (lihat `docs/DEPLOYMENT.md` TAHAP 21):
- `runDailyBackup` — 02:00 WIB, backup Spreadsheet ke Google Drive (`BACKUP_FOLDER_ID`).
- `runDailySummaryJob` — 01:00 WIB, menghitung ringkasan penjualan hari sebelumnya ke
  `90_DAILY_SUMMARY`/`91_MONTHLY_SUMMARY` (mempercepat laporan bulanan ke depannya).
