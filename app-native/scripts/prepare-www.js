#!/usr/bin/env node
/**
 * prepare-www.js - menyiapkan isi aplikasi (www/) dari website yang sama (akar repo) dan menulis capacitor.config.json.
 *   APP=kasir (bawaan) -> "TOKOQIA Kasir", halaman awal = kasir.html
 *   APP=shop           -> "TOKO AZQIA", halaman awal = index.html (belanja pelanggan)
 * Env opsional: FRONTEND_DIR (bawaan: akar repo = satu tingkat di atas folder app-native), OUT_DIR (bawaan: ./www).
 * Hanya berkas yang dibutuhkan yang disalin (daftar putih); tidak ada rahasia yang disalin.
 */
const fs = require('fs');
const path = require('path');

const APP = (process.env.APP || 'kasir').toLowerCase();
if (APP !== 'kasir' && APP !== 'shop') { console.error('GAGAL: APP harus "kasir" atau "shop", bukan "' + APP + '".'); process.exit(1); }
const ROOT = path.resolve(process.env.FRONTEND_DIR || path.join(__dirname, '..', '..'));
const OUT = path.resolve(process.env.OUT_DIR || path.join(__dirname, '..', 'www'));
const CFG_OUT = path.resolve(process.env.CONFIG_OUT || path.join(__dirname, '..', 'capacitor.config.json'));

const FILES = ['version.json', 'index.html', 'staff.html', 'kasir.html', 'offline.html', 'manifest.json', 'manifest-kasir.json'];
const DIRS = ['css', 'js', 'internal', 'shop', 'assets'];
const REQUIRED = ['index.html', 'kasir.html', 'js/api.js', 'js/config.js', 'js/printer/nativeAdapter.js', 'internal/pos.js', 'css/style.css'];

REQUIRED.forEach(function (f) {
  if (!fs.existsSync(path.join(ROOT, f))) { console.error('GAGAL: berkas wajib tidak ada di ' + ROOT + ': ' + f + '. Jalankan deploy-frontend.sh dulu (rilis terbaru).'); process.exit(1); }
});

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
FILES.forEach(function (f) { var s = path.join(ROOT, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(OUT, f)); });
DIRS.forEach(function (d) { var s = path.join(ROOT, d); if (fs.existsSync(s)) fs.cpSync(s, path.join(OUT, d), { recursive: true }); });

// Halaman awal aplikasi.
if (APP === 'kasir') fs.copyFileSync(path.join(OUT, 'kasir.html'), path.join(OUT, 'index.html'));

// Pasang jembatan native di semua halaman, SEBELUM js/api.js (script defer berjalan sesuai urutan).
const TAG = '<script defer src="js/native/bridge.bundle.js"></script>\n';
const ANCHOR = '<script defer src="js/api.js"></script>';
let injected = 0;
['index.html', 'staff.html', 'kasir.html'].forEach(function (f) {
  const p = path.join(OUT, f);
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf(TAG.trim()) >= 0) return;
  if (s.indexOf(ANCHOR) < 0) { console.error('GAGAL: titik pasang tidak ditemukan di ' + f); process.exit(1); }
  s = s.replace(ANCHOR, TAG + ANCHOR);
  fs.writeFileSync(p, s);
  injected++;
});

const cfg = {
  appId: APP === 'kasir' ? 'id.tokoqia.kasir' : 'id.tokoqia.shop',
  appName: APP === 'kasir' ? 'TOKOQIA Kasir' : 'TOKO AZQIA',
  webDir: 'www',
  server: { androidScheme: 'https' }
};
// Mode "langsung dari internet" (BAWAAN): aplikasi membuka website yang sama dari GitHub Pages, jadi setiap pembaruan website
// langsung terpakai TANPA membangun/memasang APK baru. Salinan di www/ hanya cadangan (halaman offline). Jembatan cetak native
// dimuat dari website (js/native/bridge.bundle.js, dibuat oleh deploy-native.sh). Mode "bundled": semua berkas di dalam aplikasi.
const MODE = (process.env.APP_MODE || 'remote').toLowerCase();
if (MODE !== 'remote' && MODE !== 'bundled') { console.error('GAGAL: APP_MODE harus "remote" atau "bundled", bukan "' + MODE + '".'); process.exit(1); }
if (MODE === 'remote') {
  const base = (process.env.REMOTE_URL || 'https://faturrizkyfahriansyah.github.io/toko-azqia/').replace(/\/*$/, '/');
  if (!/^https:\/\//.test(base)) { console.error('GAGAL: REMOTE_URL harus diawali https://'); process.exit(1); }
  cfg.server.url = base + (APP === 'kasir' ? 'kasir.html' : 'index.html');
  cfg.server.cleartext = false;
  cfg.server.allowNavigation = [new URL(base).hostname, 'script.google.com', 'script.googleusercontent.com'];
  cfg.server.errorPath = 'offline.html';
}
fs.writeFileSync(CFG_OUT, JSON.stringify(cfg, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'native-build.json'), JSON.stringify({ app: APP, builtAt: new Date().toISOString() }) + '\n');
console.log('www siap: mode=' + MODE + (cfg.server.url ? ' (' + cfg.server.url + ')' : '') + ', app=' + APP + ', halaman dipasangi jembatan=' + injected + ', appId=' + cfg.appId);
