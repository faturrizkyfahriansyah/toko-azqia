# Known Limitations — TOKOQIA (TOKO AZQIA) V2.0.0

Dokumen ini WAJIB dibaca Pemilik/Pengelola sebelum go-live. Semua batasan di sini adalah
keterbatasan teknis platform (Google Apps Script, Google Sheets, browser) atau keputusan desain
sadar — bukan bug yang belum diperbaiki, dan bukan fitur yang "dipalsukan".

## Keamanan & Autentikasi

- **Password hashing bukan bcrypt/PBKDF2 native.** Google Apps Script tidak menyediakan
  bcrypt/PBKDF2/Argon2 secara native. Sistem memakai SHA-256 berlapis (2000 putaran) dengan
  salt unik per pengguna (`backend/02_Auth.gs`, `PASSWORD_HASH_ROUNDS`). Ini jauh lebih aman
  dari SHA-256 satu putaran atau plaintext, tapi secara kriptografis tidak sekuat bcrypt/Argon2.
  Mitigasi tambahan: rate limiting login (5 percobaan/15 menit), dan sistem tidak pernah
  mengembalikan password/hash lewat API mana pun.
- **PIN keamanan (6 digit) memakai mekanisme hashing yang sama** dengan password (bukan
  algoritma terpisah yang lebih ringan) — cukup untuk konfirmasi tambahan sebelum aksi sensitif
  (mis. Void transaksi), tapi BUKAN pengganti password utama dan tidak dipakai untuk login penuh.
  PIN bersifat opsional per pengguna (diatur lewat **Profil Saya → Kata Sandi & PIN**); jika
  belum diatur, aksi yang biasanya meminta PIN (Void) tidak akan memintanya.
- **Sesi maksimum 6 jam.** `CacheService` Apps Script punya batas maksimum kedaluwarsa 6 jam
  (21600 detik) — ini batas platform, bukan bisa diperpanjang. Staf perlu login ulang setelah
  6 jam tanpa refresh token baru (aksi `auth.refresh` tersedia untuk memperpanjang sebelum habis).
- **Alamat IP tidak tercatat.** Apps Script Web App tidak mengekspos IP klien pemanggil secara
  andal ke kode backend. Kolom `ip_address` di `70_AUDIT_LOG` dan `71_LOGIN_LOG` selalu kosong.

## Kasir & Pembayaran

- **Idempotency tombol Bayar bersifat sementara (2 menit), bukan permanen.** Untuk mencegah
  transaksi ganda akibat klik ganda/koneksi lambat, setiap percobaan Bayar membawa
  `idempotency_key` yang di-cache backend selama 120 detik (`backend/10_Sales.gs`). Jika
  percobaan ulang dengan key yang sama terjadi LEBIH dari 2 menit setelah percobaan pertama,
  sistem akan menganggapnya transaksi baru (bukan mendeteksi ulang) — dalam praktiknya ini
  cukup karena klik ganda selalu terjadi dalam hitungan detik, bukan menit.
- **Mixed Payment (split 2 metode) hanya mendukung tepat 2 metode sekaligus** lewat UI Kasir saat
  ini (mis. Tunai + QRIS), bukan lebih dari 2. Metode HUTANG tidak bisa digabung dengan metode
  lain dalam satu transaksi (harus 100% Hutang atau 100% metode lain).
- **Subtotal per baris di keranjang dihitung Harga × Qty tanpa memperhitungkan diskon per-item**
  (diskon per-item belum ada input terpisah di UI Kasir - saat ini hanya ada diskon total
  transaksi). Backend sudah punya kolom `discount` per baris untuk pengembangan mendatang.

## Promo

- **Satu produk hanya memakai SATU promo terbaik otomatis** jika beberapa promo berlaku
  bersamaan (dipilih yang memberi harga akhir termurah untuk pembeli) — promo TIDAK ditumpuk
  (stacking). Ini berlaku sama baik di Kasir maupun Toko Online agar konsisten.
- Promo tipe **QTY_BASED** hanya mendukung satu ambang batas (`min_qty`) per promo, bukan
  tingkatan bertahap (mis. beli 5 diskon 10%, beli 10 diskon 20% dalam satu promo yang sama) -
  untuk itu perlu dibuat sebagai 2 promo terpisah.

## Pesan

- **Bukan live chat/real-time.** Pesan antara pembeli dan toko (terkait pesanan online) maupun
  pesan internal antar staf disimpan sebagai catatan biasa dan HANYA muncul saat halaman
  dibuka/dimuat ulang — tidak ada notifikasi push atau auto-refresh saat pesan baru masuk.
  Pengguna perlu membuka ulang menu Pesan atau me-refresh untuk melihat balasan terbaru.
- Pesan pelanggan HANYA bisa dikirim terkait pesanan online yang sudah dibuat (lewat halaman
  Lacak Pesanan) - belum ada saluran pesan umum tanpa nomor pesanan.

## Locking & Concurrency

- **LockService berskala seluruh script, bukan per-produk/per-SKU.** Google Apps Script tidak
  menyediakan lock bertarget kunci tertentu secara native. Semua transaksi yang mengubah stok/
  saldo kas/nomor dokumen memakai satu lock global (`backend/43_Locking.gs`) sehingga TIDAK ADA
  race condition — tapi transaksi diproses berurutan (serial), bukan paralel penuh. Untuk skala
  1 toko dengan beberapa kasir, ini cukup cepat; pada volume sangat tinggi (ratusan transaksi/menit
  bersamaan) bisa menjadi titik antrian.

## Laporan & Keuangan

- **Laba kotor pakai harga beli PRODUK SAAT INI, bukan snapshot historis per transaksi.** Sistem
  tidak menyimpan harga pokok penjualan (HPP) per baris transaksi pada saat transaksi terjadi.
  Jika harga beli produk sering berubah drastis, angka laba kotor historis adalah estimasi,
  bukan angka pasti.
- **Zona/radius pengantaran belum aktif** (`delivery_zone`, `delivery_radius` di
  `14_DELIVERY_SETTINGS` sudah ada di skema tapi belum dipakai kalkulasi ongkir — saat ini hanya
  ongkir flat + gratis ongkir minimal belanja). Kolom sengaja disiapkan agar pengembangan
  berikutnya tidak perlu migrasi skema.

## Printer & Perangkat

- **Printer referensi toko: PUTIAN POS RPP02N (firmware YC-6002), 58mm/48mm printable, 203dpi,
  384 dot, codepage default PC850.** Pola pairing-nya (nama device broadcast + PIN manual "0000")
  adalah indikasi KUAT bahwa printer ini memakai **Bluetooth Classic/SPP**, BUKAN Bluetooth Low
  Energy (BLE) — ini penting karena Web Bluetooth API browser **hanya bisa mengakses perangkat
  BLE**, tidak bisa sama sekali melihat/menyambung ke perangkat Classic/SPP. Karena itu:
  - `thermalAdapter.js` (Web Bluetooth/BLE) **kemungkinan besar TIDAK akan menemukan RPP02N**
    sama sekali saat dipilih — ini BUKAN bug, ini keterbatasan platform Web Bluetooth itu sendiri.
    Adapter ini tetap dipertahankan untuk printer BLE lain di masa depan.
  - Jalur yang lebih mungkin berhasil di **Windows**: `serialAdapter.js` (Web Serial API) — pair
    RPP02N lewat Bluetooth Windows (PIN 0000) sehingga muncul sebagai port COM virtual, lalu
    pilih "Windows - Bluetooth COM / USB (Serial)" di Pengaturan → Printer. Ini HANYA berfungsi
    di Chrome/Edge versi **desktop**.
  - Di **Android**, Web Serial hanya bisa untuk printer yang disambung **kabel USB** (bukan lewat
    pairing Bluetooth) — jadi jalur Bluetooth langsung di Android untuk printer Classic/SPP
    seperti ini **belum bisa** tanpa aplikasi native/bridge tambahan (di luar cakupan TOKOQIA,
    yang murni web app).
  - Di **iOS/Safari**, Web Bluetooth maupun Web Serial **sama sekali tidak tersedia** (keterbatasan
    WebKit/Apple). Satu-satunya jalur adalah "Cetak via Browser", dan itu pun bergantung apakah
    RPP02N mendukung AirPrint (belum dipastikan dari manual).
  - **"Cetak via Browser" tetap tersedia di semua platform** sebagai jalur paling universal, tapi
    di Android BUTUH printer terdaftar sebagai Android Print Service (biasanya lewat app resmi
    dari vendor printer) — sekadar pairing Bluetooth di Settings TIDAK otomatis membuatnya
    muncul di dialog print Android.
  - UUID service/characteristic BLE di `thermalAdapter.js` adalah nilai umum, HANYA relevan jika
    suatu saat dipakai printer BLE asli — bukan untuk RPP02N.
- **Command ESC/POS yang dikirim** (`ReceiptBuilder.buildEscPosBytes`): init (`ESC @`), pilih
  codepage PC850 (`ESC t 2` — nilai umum di printer kompatibel Epson, **belum diverifikasi
  presisi ke firmware YC-6002**), bold (`ESC E`), rata tengah/kiri (`ESC a`), dan bitmap raster
  (`GS v 0`) untuk logo. **TIDAK ADA command cutter (`GS V`) yang dikirim** — RPP02N tidak
  terkonfirmasi punya auto-cutter, struk diakhiri feed kertas untuk dirobek manual.
- **Barcode CODE128 dan QR Code pada struk/test print dikirim sebagai BITMAP** (raster `GS v 0`),
  BUKAN command native barcode/QR (`GS k` / `GS ( k`) — karena sintaks command native berbeda-
  beda antar firmware dan belum terverifikasi cocok dengan YC-6002. Bitmap adalah jalur lebih
  aman karena command raster bitmap jauh lebih universal didukung printer ESC/POS.
- **Karakter non-ASCII dinormalisasi otomatis** (`ReceiptBuilder.ascSafe`) sebelum dikirim ke
  printer — mis. "©" diganti "(c)" — untuk menghindari karakter salah cetak akibat perbedaan
  codepage.
- **Web Bluetooth tidak tersedia sama sekali di Safari/iOS**, dan **Web Serial juga tidak
  tersedia di Safari/iOS** (keterbatasan WebKit/Apple, bukan keterbatasan sistem ini).
- **Barcode scanner USB/Bluetooth eksternal belum diuji ke perangkat fisik tertentu.** Secara
  teknis scanner jenis ini umumnya bekerja seperti keyboard (mengetik hasil scan otomatis), jadi
  seharusnya berfungsi langsung lewat kolom pencarian di Kasir/Barang Masuk tanpa kode tambahan
  — tapi ini belum diverifikasi dengan unit scanner sungguhan.

## QRIS

- **Dynamic QRIS (otomatis terverifikasi) belum aktif** — butuh kredensial payment provider
  milik toko (Midtrans/Xendit/DOKU/dsb.) yang belum tersedia saat sistem ini dibangun. Sistem
  memakai QRIS statis (gambar QRIS tetap, diupload lewat **Pengaturan → Pembayaran**) dengan
  konfirmasi pembayaran MANUAL oleh staf setelah memeriksa mutasi. Lihat
  `docs/CONFIGURATION.md` bagian "Mengaktifkan Dynamic QRIS" untuk cara mengaktifkannya kapan
  pun kredensial provider sudah didapat toko.

## PWA & Offline

- **Transaksi TIDAK dapat diproses saat offline** (disengaja, demi integritas data). Service
  worker (`sw.js`) hanya meng-cache tampilan aplikasi (app-shell) agar cepat dibuka, TIDAK
  pernah meng-cache atau memfalback-kan panggilan API. Saat offline, halaman transaksi akan
  gagal dengan jelas, bukan berpura-pura berhasil.
- **"Tambahkan ke Layar Utama" untuk staf memakai halaman terpisah (`staff.html`) tanpa PWA
  manifest**, agar ikon yang dibuat selalu membuka langsung ke area staf, bukan ke beranda
  pembeli (yang punya manifest sendiri dengan `start_url` toko online). Konsekuensinya: ikon
  staf berupa bookmark biasa (bukan aplikasi "terinstal" penuh secara teknis PWA di sebagian
  browser), meski secara visual dan fungsional tampil serta berjalan sama seperti aplikasi.

## Regression Test

- Verifikasi otomatis yang dilakukan tim pengembang HANYA mencakup **validasi kode secara
  statis** (sintaks, kelengkapan action API, permission, referensi file/asset) — BUKAN pengujian
  langsung di browser/perangkat fisik. Uji manual di perangkat nyata (termasuk tampilan di layar
  390px/430px, tablet, desktop, dan interaksi sentuh) tetap perlu dilakukan oleh Pemilik/
  Pengelola sebelum go-live. Lihat `docs/REGRESSION_TEST_V2.md` untuk rincian apa yang sudah/
  belum terverifikasi.

## Performa

- Seluruh file JavaScript modul (±39 file) tetap dimuat di setiap halaman terlepas dari menu
  yang sedang dibuka (belum ada pemuatan lazy per-modul) — file dimuat dengan atribut `defer`
  (unduh paralel, tidak memblokir tampilan awal) tapi tetap seluruhnya diunduh di setiap kunjungan
  pertama. Untuk skala 1 toko dengan koneksi normal, dampaknya kecil; kalau aplikasi berkembang
  jauh lebih besar, lazy-loading per modul adalah kandidat optimasi lanjutan.

## Lainnya

- Nomor dokumen (`TRX-`, `PB-`, `AZQ-`, dst.) memakai format `PREFIX-YYYYMMDD-0001`, direset
  ke `0001` setiap hari per prefix — bukan berkelanjutan lintas hari.
- Kolom `02_ROLES.permissions` HANYA salinan informatif untuk ditampilkan di UI. Penegakan izin
  sesungguhnya SELALU dari `REQUIRED_ROLES` di `backend/42_Validation.gs`, bukan dari isi Sheet.
- **Field Email tidak tersedia di Profil Saya** karena memang tidak ada kolom email di data
  pengguna (`01_USERS`) — bukan bug, sengaja tidak dikarang datanya.
