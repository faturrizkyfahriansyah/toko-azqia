/**
 * TOKOQIA Local Print Bridge
 * =========================
 * Script Node.js sederhana (BUKAN aplikasi terinstal, BUKAN service, TANPA GUI) yang berjalan
 * di komputer yang sama dengan printer thermal (BT-583/RPP02N) terhubung, dan menjembatani
 * antara halaman web TOKOQIA (di browser mana pun, termasuk yang tidak punya Web Bluetooth/
 * Web Serial) dengan port COM/serial tempat printer terpasang.
 *
 * KENAPA INI DIBUTUHKAN:
 * BT-583/RPP02N kemungkinan besar memakai Bluetooth Classic/SPP (bukan BLE) - Web Bluetooth API
 * browser TIDAK BISA mengakses perangkat jenis ini sama sekali. Tapi setelah di-pair di Windows,
 * perangkat itu muncul sebagai "port COM" biasa - dan Node.js BISA bicara ke situ lewat paket
 * `serialport`, terlepas dari batasan Web Bluetooth di browser.
 *
 * CARA PAKAI:
 *   1. Install Node.js (https://nodejs.org) jika belum ada, versi 18 ke atas.
 *   2. Di folder ini, jalankan sekali: npm install
 *   3. Jalankan setiap kali mau mencetak: npm start   (atau: node bridge.js)
 *   4. Biarkan jendela terminal itu tetap terbuka selama mencetak dari TOKOQIA.
 *   5. Di TOKOQIA (Pengaturan -> Printer), pilih "TOKOQIA Local Print Bridge", pilih port COM
 *      printer Anda dari daftar yang muncul, klik Hubungkan, lalu Test Print.
 *
 * KEAMANAN:
 * - HANYA bind ke 127.0.0.1 (localhost) - TIDAK bisa diakses dari perangkat/jaringan lain.
 * - Validasi Origin: hanya menerima permintaan dari domain TOKOQIA yang terdaftar di bawah
 *   (ubah ALLOWED_ORIGINS jika Anda memakai domain kustom sendiri).
 * - Batas ukuran payload 2MB, hanya menerima endpoint yang benar-benar didefinisikan di sini.
 */

const http = require('http');
const { SerialPort } = require('serialport');

const PORT = 8765;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB

// Tambahkan domain lain di sini jika Anda memakai domain kustom (bukan GitHub Pages default).
// Origin kosong (mis. permintaan lewat curl/Postman langsung dari komputer ini) tetap diizinkan.
const ALLOWED_ORIGINS = [
  'https://faturrizkyfahriansyah.github.io'
];

let activePort = null;
let activePortPath = null;

function isOriginAllowed(origin) {
  if (!origin) return true; // permintaan lokal tanpa header Origin (curl, dsb.)
  return ALLOWED_ORIGINS.indexOf(origin) !== -1;
}

function setCors(res, origin) {
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload melebihi batas 2MB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Body bukan JSON valid'));
      }
    });
    req.on('error', reject);
  });
}

function closeActivePort() {
  return new Promise((resolve) => {
    if (!activePort || !activePort.isOpen) {
      activePort = null; activePortPath = null; resolve();
      return;
    }
    activePort.close(() => { activePort = null; activePortPath = null; resolve(); });
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (origin && !isOriginAllowed(origin)) {
    sendJson(res, 403, { ok: false, error: 'Origin tidak diizinkan' });
    return;
  }
  setCors(res, origin);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // GET /status - status koneksi apa adanya, tidak pernah mengarang "connected: true"
    if (req.method === 'GET' && req.url === '/status') {
      return sendJson(res, 200, {
        ok: true,
        connected: !!(activePort && activePort.isOpen),
        port: activePortPath
      });
    }

    // GET /printers - daftar port COM/serial yang terdeteksi OS saat ini (discovery nyata)
    if (req.method === 'GET' && req.url === '/printers') {
      const ports = await SerialPort.list();
      return sendJson(res, 200, {
        ok: true,
        ports: ports.map((p) => ({
          path: p.path,
          manufacturer: p.manufacturer || '',
          serialNumber: p.serialNumber || '',
          pnpId: p.pnpId || ''
        }))
      });
    }

    // POST /connect {path, baudRate?}
    if (req.method === 'POST' && req.url === '/connect') {
      const body = await readJsonBody(req);
      if (!body.path) return sendJson(res, 400, { ok: false, error: 'Field "path" wajib diisi (contoh: COM5)' });

      await closeActivePort();
      const sp = new SerialPort({ path: body.path, baudRate: body.baudRate || 9600, autoOpen: false });

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout membuka port ' + body.path)), 8000);
        sp.open((err) => {
          clearTimeout(timer);
          if (err) { reject(new Error('Gagal membuka port: ' + err.message)); return; }
          resolve();
        });
      });

      activePort = sp;
      activePortPath = body.path;
      return sendJson(res, 200, { ok: true, connected: true, port: activePortPath });
    }

    // POST /disconnect
    if (req.method === 'POST' && req.url === '/disconnect') {
      await closeActivePort();
      return sendJson(res, 200, { ok: true, connected: false });
    }

    // POST /print dan /test-print - body: {bytes: number[], jobId?}
    if (req.method === 'POST' && (req.url === '/print' || req.url === '/test-print')) {
      if (!activePort || !activePort.isOpen) {
        return sendJson(res, 409, { ok: false, error: 'Belum terhubung ke printer. Panggil /connect dulu (pilih port di Pengaturan TOKOQIA).' });
      }
      const body = await readJsonBody(req);
      if (!body.bytes || !Array.isArray(body.bytes)) {
        return sendJson(res, 400, { ok: false, error: 'Field "bytes" (array angka) wajib diisi' });
      }
      const buf = Buffer.from(body.bytes);

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout mengirim data ke printer')), 15000);
        activePort.write(buf, (err) => {
          if (err) { clearTimeout(timer); reject(new Error('Gagal menulis ke port: ' + err.message)); return; }
          activePort.drain((err2) => {
            clearTimeout(timer);
            if (err2) reject(new Error('Gagal flush data ke port: ' + err2.message));
            else resolve();
          });
        });
      });

      return sendJson(res, 200, { ok: true, jobId: body.jobId || null, status: 'SUCCESS' });
    }

    sendJson(res, 404, { ok: false, error: 'Endpoint tidak dikenal: ' + req.method + ' ' + req.url });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' sudah dipakai proses lain. Tutup jendela bridge yang sebelumnya (jika ada) lalu coba lagi.');
  } else {
    console.error('Bridge error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('==================================================');
  console.log('  TOKOQIA Local Print Bridge');
  console.log('  Berjalan di http://127.0.0.1:' + PORT);
  console.log('  Biarkan jendela ini tetap terbuka selama mencetak.');
  console.log('  Tekan Ctrl+C untuk menghentikan.');
  console.log('==================================================');
});

process.on('SIGINT', async () => {
  await closeActivePort();
  server.close(() => process.exit(0));
});
