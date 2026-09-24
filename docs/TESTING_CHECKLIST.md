# Testing Checklist Final — TOKOQIA (TOKO AZQIA)

Selesaikan seluruh checklist ini sebelum go-live (TAHAP 22 di `docs/DEPLOYMENT.md`).

## LOGIN
- [ ] Login Pemilik berhasil
- [ ] Login Pengelola berhasil
- [ ] Password salah ditolak dengan pesan jelas
- [ ] Logout berfungsi (sesi tidak bisa dipakai lagi setelah logout)
- [ ] Sesi tetap aktif selama < 6 jam pemakaian normal

## PRODUK
- [ ] Tambah produk baru
- [ ] Edit produk (harga, kategori, dsb.)
- [ ] Nonaktifkan produk (hilang dari kasir & katalog online)
- [ ] Pencarian produk lewat SKU/barcode berhasil menemukan produk
- [ ] Perubahan harga jual/beli tercatat di riwayat harga (`60_PRICE_HISTORY`)

## PEMBELIAN
- [ ] Tambah supplier baru
- [ ] Input barang masuk (draft) berhasil disimpan
- [ ] Konfirmasi barang masuk → stok bertambah sesuai qty
- [ ] Barang masuk yang sudah dikonfirmasi tidak bisa dikonfirmasi ulang (double stock masuk)

## KASIR
- [ ] Scan/cari produk dan tambah ke keranjang
- [ ] Scan barcode via kamera HP (📷 di Kasir) berhasil menambah produk
- [ ] Barcode yang sama discan berkali-kali → qty bertambah di baris yang sama (bukan baris baru)
- [ ] Ubah qty di keranjang (+/-)
- [ ] **Subtotal per baris (Harga × Qty) tampil benar di setiap item keranjang**
- [ ] Ganti satuan produk di keranjang (jika produk punya satuan alternatif) → harga menyesuaikan
- [ ] Total & diskon terhitung benar
- [ ] Pembayaran Tunai dengan kembalian benar
- [ ] Pembayaran QRIS/Transfer tercatat tanpa field kembalian
- [ ] **Mixed Payment**: split 2 metode (mis. sebagian Tunai + sebagian QRIS), total kedua metode
      harus pas sama dengan total transaksi, transaksi berhasil tersimpan LUNAS
- [ ] **Pembayaran Hutang**: wajib pilih Pelanggan dahulu, transaksi masuk ke Piutang Pelanggan
      berstatus Belum Lunas
- [ ] **Double-click tombol Bayar TIDAK membuat transaksi ganda** (idempotency) — coba klik
      Bayar 2x cepat berturut-turut, pastikan hanya 1 baris baru muncul di `20_SALES`
- [ ] Transaksi selesai dan tercatat di `20_SALES` dengan status `COMPLETED`
- [ ] Struk tercetak/terpreview dengan benar (nomor, item, kasir, total sesuai - tanpa tulisan
      "Developed By")
- [ ] Void transaksi mengembalikan stok dan mencatat alasan; jika akun punya PIN aktif, sistem
      meminta PIN sebelum void berhasil

## STOK
- [ ] Penjualan mengurangi `current_stock` sesuai qty terjual
- [ ] Pembelian yang dikonfirmasi menambah `current_stock` sesuai qty
- [ ] Retur pelanggan (kondisi Baik) mengembalikan stok
- [ ] Retur supplier mengurangi stok
- [ ] Stock opname mencatat selisih dengan alasan wajib untuk produk yang berbeda
- [ ] **Tidak ada pengurangan stok ganda** — total mutasi `30_STOCK_MOVEMENTS` untuk 1 produk
      cocok dengan `stock_after` baris terakhirnya, dan cocok dengan `current_stock` produk saat
      ini di `05_PRODUCTS`

## ONLINE
- [ ] Katalog menampilkan produk aktif dengan harga & status stok yang benar
- [ ] Tambah ke keranjang & checkout PICKUP berhasil
- [ ] Checkout DELIVERY mewajibkan nama/WA/alamat terisi
- [ ] Pesanan baru me-reserve stok (`reserved_stock` naik) TANPA mengurangi `current_stock`
- [ ] Konfirmasi pembayaran men-commit stok (`current_stock` baru berkurang saat ini)
- [ ] Tracking pesanan dengan nomor pesanan (+ verifikasi 4 digit WA untuk delivery) berhasil
- [ ] Pembatalan pesanan SEBELUM pembayaran dikonfirmasi melepas reservasi stok
- [ ] Perubahan status pesanan mengikuti alur yang valid (tidak bisa lompat status sembarangan)

## PIUTANG PELANGGAN
- [ ] Transaksi Kasir metode Hutang membuat 1 baris piutang baru berstatus Belum Lunas
- [ ] Bayar sebagian → status berubah jadi Sebagian, sisa piutang berkurang sesuai nominal
- [ ] Bayar penuh/pelunasan sisa → status jadi Lunas, tidak bisa dibayar lagi setelah lunas
- [ ] Pembayaran piutang menambah saldo Kas (kas masuk)
- [ ] Piutang lewat tanggal jatuh tempo → ditandai "Jatuh Tempo" di daftar

## HUTANG SUPPLIER
- [ ] Konfirmasi Barang Masuk dengan pilihan "Catat sebagai Hutang" → 1 baris hutang baru dibuat,
      stok tetap bertambah normal
- [ ] Konfirmasi Barang Masuk dengan pilihan "Sudah Dibayar" → TIDAK membuat hutang, kas berkurang
      langsung
- [ ] Bayar sebagian/penuh hutang → status & sisa terupdate, kas berkurang (kas keluar)
- [ ] Hutang lewat tanggal jatuh tempo → ditandai "Jatuh Tempo" di daftar

## PROMO
- [ ] Buat promo Persentase, Nominal, Harga Khusus, dan Berdasarkan Qty Minimal — masing-masing
      berhasil disimpan
- [ ] Promo aktif & dalam periode berlaku otomatis mengubah harga di Kasir tanpa input manual
- [ ] Promo aktif juga tampil sebagai harga promo di Katalog/Checkout toko online
- [ ] Promo di luar periode (belum mulai/sudah berakhir) TIDAK diterapkan
- [ ] Nonaktifkan promo → harga kembali normal di Kasir & toko online

## PESAN
- [ ] Pembeli mengirim pesan dari halaman Lacak Pesanan (dengan nomor pesanan miliknya)
- [ ] Pesan pembeli muncul di menu Pesan → Pesan Pelanggan sisi internal, badge belum-dibaca naik
- [ ] Staf membalas pesan → balasan muncul di halaman Lacak Pesanan pembeli
- [ ] Pesan Internal Tim: kirim & tampil untuk staf lain yang login

## PROFIL & PIN
- [ ] Menu Profil Saya menampilkan nama, role, status akun, nomor HP (TANPA field email/data
      yang tidak tersedia di sistem)
- [ ] Ubah nama/telepon di Profil Saya tersimpan dan langsung terlihat di sidebar/drawer
- [ ] Ganti password berhasil dengan password saat ini yang benar; ditolak jika password saat
      ini salah
- [ ] Atur PIN 6 digit berhasil (wajib isi password saat ini terlebih dahulu)
- [ ] Setelah PIN aktif, aksi Void transaksi meminta PIN sebelum diproses

## PRINTER
- [ ] Cetak struk lewat Browser berhasil di desktop
- [ ] Cetak struk lewat Browser berhasil di HP (Android & iOS)
- [ ] Format struk sesuai lebar kertas 58mm
- [ ] Reprint struk dari transaksi lama berhasil tanpa membuat transaksi baru
- [ ] (Jika ada unit fisik) Cetak lewat Bluetooth thermal diuji, hasil dicatat: berhasil / gagal
      (SPP bukan BLE) — lihat `docs/KNOWN_LIMITATIONS.md`

## SECURITY
- [ ] Pengelola tidak bisa mengakses menu Pengguna/Audit/Backup (baik lewat UI maupun jika
      dicoba langsung lewat action API — harus ditolak `FORBIDDEN`)
- [ ] Audit log mencatat aksi penting (buat transaksi, ubah produk, ubah harga, dst.)
- [ ] Tidak ada secret (API key/kredensial) yang terlihat di kode frontend atau repository GitHub
- [ ] Public API (`public.*`) tidak pernah mengembalikan `purchase_price`, `main_supplier_id`,
      `reserved_stock`, atau `rack_id`
- [ ] Harga beli (cost price) tidak terlihat di mana pun pada sisi toko online

## BACKUP
- [ ] Backup manual berhasil membuat file baru di folder Google Drive yang ditentukan
- [ ] Trigger harian terpasang (`View → Triggers` di Apps Script menampilkan `runDailyBackup`)
- [ ] Prosedur restore dipahami: buka file backup (salinan Spreadsheet) di Google Drive, salin
      `SPREADSHEET_ID`-nya, ganti Script Property `SPREADSHEET_ID` ke ID tersebut jika perlu
      memulihkan dari backup (lakukan dengan hati-hati, sebaiknya di bawah pengawasan Pemilik)

## RESPONSIVE
- [ ] Tampilan baik di layar 390px (mis. iPhone 12/13/14 standar)
- [ ] Tampilan baik di layar 430px (mis. iPhone Pro Max)
- [ ] Tidak ada scroll horizontal di halaman mana pun pada lebar 390-430px
- [ ] Tidak ada teks/tombol terpotong atau keluar dari kontainer
- [ ] Bottom navigation tidak menutupi konten di bawahnya (termasuk tombol Bayar di Kasir)
- [ ] Drawer (☰) terbuka penuh tanpa menyebabkan scroll horizontal pada layar sempit
- [ ] Tampilan baik di Tablet
- [ ] Tampilan baik di Desktop (sidebar muncul otomatis di layar ≥900px, bottom nav tersembunyi)
- [ ] Header menyatu dengan status bar (tidak terlihat seperti kotak menggantung) di HP dengan
      notch/Dynamic Island (iPhone terbaru)

## PWA
- [ ] Toko online (`index.html`) bisa di-"Tambahkan ke Layar Utama" dan ikonnya sesuai logo
- [ ] Halaman staf (`staff.html`) bisa di-"Tambahkan ke Layar Utama" secara TERPISAH dari toko,
      dan ikon tsb selalu membuka langsung ke halaman login/ringkasan staf (bukan beranda pembeli)
- [ ] Aplikasi tetap bisa dibuka (tampilan) saat tidak ada koneksi internet, tapi transaksi baru
      ditolak dengan pesan jelas, bukan pura-pura berhasil
