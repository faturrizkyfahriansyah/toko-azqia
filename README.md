# TOKOQIA Local Print Bridge

Script Node.js sederhana yang menjembatani halaman web TOKOQIA dengan printer thermal lewat
port COM/serial — dibutuhkan khusus untuk printer Bluetooth Classic/SPP (seperti **BT-583** /
**PUTIAN POS RPP02N**) yang **tidak bisa** diakses langsung oleh Web Bluetooth API browser.

**Ini BUKAN aplikasi yang diinstal** — hanya script yang dijalankan lewat command line, tanpa
GUI, tanpa installer, tanpa service background. Cukup buka sekali saat mau mencetak.

## Kapan Bridge Ini Dibutuhkan

- Metode "Windows - Bluetooth COM / USB (Serial)" di Pengaturan TOKOQIA **gagal** menemukan
  printer (Web Serial API browser tidak bisa membuka port tsb, atau driver resmi vendor sudah
  mengklaimnya duluan).
- Anda memakai browser/OS yang **tidak** mendukung Web Serial maupun Web Bluetooth sama sekali.
- Anda ingin jalur cetak yang **konsisten** terlepas dari browser yang dipakai kasir.

Jika metode "Windows - Bluetooth COM / USB (Serial)" bawaan browser sudah berhasil, **Anda
TIDAK perlu bridge ini** — itu lebih sederhana (tidak perlu jendela terminal terbuka).

## Instalasi (Sekali Saja)

1. Install **Node.js** versi 18 ke atas dari https://nodejs.org (pilih versi LTS).
2. Pair printer BT-583/RPP02N ke Windows lewat **Settings → Bluetooth & devices → Add device**,
   masukkan PIN `0000` saat diminta. Setelah berhasil, catat nomor COM port yang muncul (cek di
   **Device Manager → Ports (COM & LPT)**, biasanya bernama "Standard Serial over Bluetooth link").
3. Buka Command Prompt/PowerShell, masuk ke folder `bridge/node-bridge/` ini, jalankan:
   ```
   npm install
   ```
   (Ini mengunduh paket `serialport` yang dibutuhkan — hanya perlu dilakukan sekali.)

## Menjalankan Bridge (Setiap Kali Mau Mencetak)

Di folder yang sama, jalankan:
```
npm start
```
atau
```
node bridge.js
```

Jendela terminal akan menampilkan:
```
TOKOQIA Local Print Bridge
Berjalan di http://127.0.0.1:8765
Biarkan jendela ini tetap terbuka selama mencetak.
```

**Biarkan jendela ini tetap terbuka** selama Anda memakai Kasir. Tutup dengan `Ctrl+C` kalau
sudah selesai (atau tutup saja jendela terminalnya).

## Menghubungkan di TOKOQIA

1. Buka TOKOQIA di browser → **Pengaturan → Printer**.
2. Pilih metode **"TOKOQIA Local Print Bridge"**.
3. Klik **Cari Printer** — akan muncul daftar port COM yang terdeteksi Windows.
4. Pilih port yang sesuai dengan printer Anda (yang dicatat di langkah instalasi No. 2).
5. Klik **Hubungkan**, lalu **Test Print** untuk memastikan berhasil.

## Keamanan

- Bridge **hanya** menerima koneksi dari komputer yang sama (`127.0.0.1`) — tidak bisa diakses
  dari perangkat lain di jaringan, apalagi dari internet.
- Bridge **menolak** permintaan dari domain web yang tidak dikenal (lihat `ALLOWED_ORIGINS` di
  `bridge.js` — edit daftar itu kalau Anda memakai domain kustom, bukan alamat GitHub Pages
  default).
- Ukuran data yang diterima dibatasi 2MB per permintaan.

## Troubleshooting

| Masalah | Kemungkinan Penyebab |
|---|---|
| `npm install` gagal | Pastikan Node.js versi 18+ terinstal (`node --version` untuk cek) |
| "Port 8765 sudah dipakai" | Ada jendela bridge lain yang masih terbuka — tutup dulu, baru jalankan lagi |
| TOKOQIA bilang "Bridge tidak aktif" | Pastikan jendela terminal `node bridge.js` masih terbuka & tidak error |
| Port COM tidak muncul di "Cari Printer" | Pastikan printer sudah di-pair lewat Bluetooth Windows (PIN 0000) terlebih dahulu |
| "Gagal membuka port" | Port sedang dipakai aplikasi lain (tutup app printer vendor lain jika ada), atau printer mati/di luar jangkauan |
