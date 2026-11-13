/**
 * sw.js - Service Worker TOKO AZQIA.
 * HANYA meng-cache app-shell statis (HTML/CSS/JS/icon) agar aplikasi cepat dibuka & bisa
 * dibuka offline SECARA TAMPILAN. TIDAK PERNAH meng-cache atau memfalback-kan permintaan API
 * (POST ke Apps Script) - transaksi, stok, dan pembayaran WAJIB selalu berupa panggilan
 * jaringan langsung, tidak boleh terlihat "berhasil" saat offline. Lihat docs/KNOWN_LIMITATIONS.md.
 */
var CACHE_NAME = 'tokoqia-shell-v14';
var IMG_CACHE = 'azqia-img-v1';
var SHELL_FILES = [
  './', './index.html', './staff.html', './kasir.html', './manifest.json', './manifest-kasir.json', './assets/icons/tokoqia-kasir-192.png', './assets/icons/tokoqia-kasir-512.png', './offline.html',
  './css/style.css',
  './js/utils.js', './js/api.js', './js/pricing.js', './js/offline.js', './js/notify.js', './js/auth.js', './js/config.js', './js/cart-state.js', './js/router.js', './js/layout.js', './js/barcode.js',
  './js/printer/receiptBuilder.js', './js/printer/browserAdapter.js', './js/printer/thermalAdapter.js', './js/printer/serialAdapter.js', './js/printer/localBridgeAdapter.js', './js/printer/printerInterface.js',
  './internal/login.js', './internal/dashboard.js', './internal/pos.js', './internal/transactions.js', './internal/products.js', './internal/inventory.js',
  './internal/purchases.js', './internal/suppliers.js', './internal/payables.js', './internal/customers.js', './internal/receivables.js',
  './internal/orders.js', './internal/cash.js', './internal/expenses.js', './internal/reports.js', './internal/wa.js', './internal/reconcile.js', './internal/prices.js', './internal/notifications.js', './internal/users.js', './internal/settings.js',
  './internal/promos.js', './internal/messages.js', './internal/profile.js',
  './shop/home.js', './shop/catalog.js', './shop/cart.js', './shop/checkout.js', './shop/ui.js', './shop/payment.js', './shop/order.js', './shop/tracking.js',
  './assets/icons/tokoqia-app-icon.png', './assets/icons/tokoqia-app-icon-192.png', './assets/icons/tokoqia-favicon.png',
  './assets/icons/tokoqia-horizontal.png', './assets/icons/tokoqia-icon.png', './assets/icons/tokoqia-white.png'
];

self.addEventListener('install', function (event) {
  // Satu per satu + abaikan yang gagal: cache.addAll() membatalkan SELURUH instalasi kalau satu saja file
  // tidak ditemukan (itulah yang membuat Service Worker lama tidak pernah terpasang).
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return Promise.all(SHELL_FILES.map(function (f) { return cache.add(f).catch(function () {}); }));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME && k !== IMG_CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Jangan PERNAH menyentuh permintaan API (POST ke Apps Script) - selalu network langsung,
  // tanpa cache, tanpa fallback offline. Ini mencegah transaksi terlihat sukses saat offline.
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.hostname.indexOf('script.google.com') !== -1 || url.hostname.indexOf('script.googleusercontent.com') !== -1) return;

  // V3: JARINGAN DULU, cache hanya cadangan offline. Dengan begini setiap update di GitHub langsung
  // terpakai saat aplikasi dibuka (tidak lagi "nyangkut" di versi lama). Cache-first sebelumnya
  // membuat file baru tidak kelihatan sampai Service Worker diganti manual.
  // Foto produk (Drive): CACHE DULU - cepat & tetap tampil saat offline; maksimal 300 gambar.
  if (req.destination === 'image' && (url.hostname === 'drive.google.com' || url.hostname.slice(-18) === 'googleusercontent.com')) {
    event.respondWith(caches.open(IMG_CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()); cache.keys().then(function (ks) { if (ks.length > 300) cache.delete(ks[0]); }); }
          return res;
        }).catch(function () { return new Response('', { status: 504 }); });
      });
    }));
    return;
  }
  var sameOrigin = url.origin === self.location.origin;
  event.respondWith(
    new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('timeout')); }, 5000); // jaringan macet -> pakai cache
      fetch(req, { cache: 'no-cache' }).then(function (res) { clearTimeout(timer); resolve(res); }, function (e) { clearTimeout(timer); reject(e); });
    }).then(function (res) {
      if (sameOrigin && res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./offline.html');
        return new Response('', { status: 504 });
      });
    })
  );
});
