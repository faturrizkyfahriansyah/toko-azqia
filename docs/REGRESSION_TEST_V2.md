# Laporan Regression Test — TOKOQIA V2.0.0

Dokumen ini melaporkan hasil pengujian regresi setelah rangkaian update (rebranding AZQIA,
modul Piutang/Hutang/Promo/Pesan/PIN, redesign UI TOKOQIA, dan perbaikan hasil audit).

**PENTING — batasan metode pengujian**: pengujian di bawah ini dilakukan lewat **validasi kode
statis** (pembacaan & analisis langsung isi file, cross-check referensi antar file, pengecekan
sintaks). Ini BUKAN pengujian klik-langsung di browser/perangkat sungguhan — hal itu secara
teknis tidak dapat dilakukan oleh tim pengembang tanpa akses ke perangkat/browser nyata Anda.
Status "Terverifikasi (statis)" berarti kode-nya benar secara struktur/logika berdasarkan
pembacaan langsung; BUKAN klaim "sudah diuji berhasil di layar sungguhan".

## Metode Verifikasi Statis yang Dilakukan

1. **Syntax check** seluruh file `.gs` (36 file) dan `.js` (39 file) — semua valid, tanpa error.
2. **Cross-check action API**: setiap action yang dipanggil frontend (`Api.call('nama.aksi', …)`)
   dicocokkan dengan action yang benar-benar terdaftar di `backend/01_Router.gs`, dan setiap
   action tsb dicocokkan punya entri permission (`backend/42_Validation.gs`) — tidak ada yang
   hilang atau bolong izinnya.
3. **Cross-check referensi file/asset**: setiap `<script src>` dan `<img src>`/`href` di
   `index.html`/`staff.html`/modul JS dicocokkan dengan file yang benar-benar ada di project.
4. **Cross-check modul route**: setiap `Modules.X.render` yang didaftarkan di route dicocokkan
   dengan definisi modul yang benar-benar ada.
5. **Pembacaan logika transaksi kritis** (Kasir, Mixed Payment, idempotency, reservasi/commit
   stok online, Piutang/Hutang) baris-per-baris untuk memastikan alurnya konsisten dengan yang
   dimaksud, tanpa menjalankan di lingkungan sungguhan.

## Hasil per Modul

| Modul | Status Verifikasi Statis | Catatan |
|---|---|---|
| Login/Logout/Sesi | Terverifikasi (statis) | Alur kode konsisten; sesi 6 jam adalah batas platform |
| Dashboard/Ringkasan | Terverifikasi (statis) | Data Piutang/Hutang sudah nyata (bukan placeholder) |
| Kasir - transaksi dasar | Terverifikasi (statis) | - |
| Kasir - Mixed Payment | Terverifikasi (statis) | Validasi jumlah 2 metode = total, di backend |
| Kasir - idempotency | Terverifikasi (statis) | Cache key 120 detik, lihat KNOWN_LIMITATIONS.md |
| Kasir - subtotal per baris | Terverifikasi (statis) | Baru ditambahkan, murni tampilan |
| Kasir - scan kamera | **Perlu uji manual** | Bergantung izin kamera browser & pencahayaan fisik |
| Produk (CRUD, filter, SKU/barcode) | Terverifikasi (statis) | - |
| Stok/Opname/Retur | Terverifikasi (statis) | Tidak diubah pada pass ini |
| Barang Masuk | Terverifikasi (statis) | Termasuk pilihan Bayar Langsung/Hutang |
| Piutang Pelanggan | Terverifikasi (statis) | - |
| Hutang Supplier | Terverifikasi (statis) | - |
| Promo (4 tipe) | Terverifikasi (statis) | Perhitungan harga di backend, dicek logikanya |
| Pesan (pelanggan & internal) | Terverifikasi (statis) | Bukan real-time - lihat KNOWN_LIMITATIONS.md |
| Profil & PIN | Terverifikasi (statis) | Tanpa field email (memang tidak ada di database) |
| Pesanan Online (status) | Terverifikasi (statis) | Badge tampilan baru, status internal tidak berubah |
| Laporan | Terverifikasi (statis) | Tidak diubah pada pass ini |
| Pengaturan (Toko/Ongkir/Pembayaran/Printer) | Terverifikasi (statis) | QRIS upload & Rekening Bank baru |
| Pengguna/Audit Log/Backup | Terverifikasi (statis) | Tidak diubah pada pass ini |
| Header/Drawer/Bottom Nav | Terverifikasi (statis) | Ikon drawer sudah SVG, bukan emoji lagi |
| PWA (Tambah ke Layar Utama) | **Perlu uji manual** | Kode sudah direview ulang, tidak ditemukan bug - tapi perilaku "Add to Home Screen" berbeda-beda antar OS/browser, wajib dicoba langsung di perangkat |
| Printer thermal Bluetooth | **Perlu uji manual** | Bergantung unit fisik printer - lihat KNOWN_LIMITATIONS.md |
| Responsive 390px/430px/tablet/desktop | **Perlu uji manual** | CSS sudah ditulis sesuai breakpoint, tapi rendering visual sungguhan wajib dicek di layar asli |
| Safe-area (notch/Dynamic Island) | **Perlu uji manual** | Hanya bisa benar-benar dipastikan di iPhone fisik dengan notch |

## Yang WAJIB Diuji Manual oleh Anda Sebelum Go-Live

Gunakan `docs/TESTING_CHECKLIST.md` (91 item) sebagai panduan lengkap. Prioritaskan terutama:

1. **Kasir Mixed Payment & idempotency** — coba transaksi split pembayaran dan klik ganda tombol
   Bayar, pastikan tidak ada transaksi dobel.
2. **Scan barcode kamera** — coba di HP sungguhan, cek izin kamera diminta dengan benar.
3. **PWA staf** — pasang ulang ikon "Tambahkan ke Layar Utama" untuk staf, pastikan membuka
   halaman staf, bukan beranda pembeli.
4. **Tampilan di HP Anda sendiri** — buka semua menu utama, pastikan tidak ada yang terpotong.
5. **Printer thermal** (jika punya unit fisik) — coba cetak struk asli.

Setelah diuji, centang `docs/TESTING_CHECKLIST.md` satu per satu. Jika ditemukan masalah, catat
dan sampaikan — bagian tersebut akan diperbaiki secara terpisah (tidak perlu audit ulang total).
