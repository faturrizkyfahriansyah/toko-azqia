# Changelog — TOKO AZKIA

## V1.0.0 — 2026 (Rilis Awal)

Rilis pertama sistem lengkap: POS/kasir, manajemen produk & stok (ledger, opname, retur),
pembelian dari supplier, toko online (katalog, keranjang, checkout pickup/delivery, tracking
tanpa login), QRIS statis, cetak struk (thermal Bluetooth + fallback browser), laporan
(11 jenis), audit log, backup otomatis ke Google Drive, dan manajemen pengguna 2 role
(Pemilik/Pengelola).

**Cakupan modul:**
- Backend: 31 file Google Apps Script, 79 action API, seluruh permission ditegakkan di backend.
- Frontend: PWA statis (tanpa framework/build tool), area staf (internal) & toko online (shop).
- Database: 31 Sheet dengan initializer otomatis (`setupDatabase()`) + seed data non-produk.

**Keterbatasan yang diketahui di V1.0.0** (lihat `docs/KNOWN_LIMITATIONS.md` untuk detail):
password hashing bukan bcrypt/PBKDF2 native, sesi maksimum 6 jam, tanpa pencatatan IP address,
laba kotor pakai harga beli saat ini (bukan snapshot historis), kompatibilitas printer Bluetooth
tidak dapat dijamin untuk semua unit fisik, Dynamic QRIS belum aktif (butuh kredensial provider).

## Rencana Pengembangan Berikutnya

- **V1.1** — Webhook Dynamic QRIS (pembayaran otomatis terverifikasi), notifikasi WhatsApp/email
  untuk status pesanan, snapshot HPP per transaksi untuk laba kotor yang lebih akurat.
- **V1.2** — Purchase Order formal (sebelum Barang Masuk), penguncian produk saat Stock Opname
  (opsional, dapat dinyalakan/matikan), multi-cabang (jika diperlukan).
- **V2.0** — Zona/radius pengantaran (kolom `delivery_zone`/`delivery_radius` sudah tersedia di
  skema `14_DELIVERY_SETTINGS` sejak V1.0.0 agar migrasi tidak diperlukan), program loyalitas
  pelanggan, integrasi payment gateway penuh.

Tidak ada perubahan V2/V3 yang dikerjakan di rilis ini — sesuai arahan agar V1 fokus pada scope
yang sudah disepakati terlebih dahulu.
