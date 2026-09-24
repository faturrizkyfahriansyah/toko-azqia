/**
 * sw.js - Service Worker TOKO AZQIA.
 * HANYA meng-cache app-shell statis (HTML/CSS/JS/icon) agar aplikasi cepat dibuka & bisa
 * dibuka offline SECARA TAMPILAN. TIDAK PERNAH meng-cache atau memfalback-kan permintaan API
 * (POST ke Apps Script) - transaksi, stok, dan pembayaran WAJIB selalu berupa panggilan
 * jaringan langsung, tidak boleh terlihat "berhasil" saat offline. Lihat docs/KNOWN_LIMITATIONS.md.
 */
var CACHE_NAME = 'tokoqia-shell-v8';
var SHELL_FILES = [
  './', './index.html', './staff.html', './manifest.json', './offline.html',
  './css/style.css',
  './js/utils.js', './js/api.js', './js/auth.js', './js/config.js', './js/cart-state.js', './js/router.js', './js/layout.js', './js/barcode.js',
  './js/printer/receiptBuilder.js', './js/printer/browserAdapter.js', './js/printer/thermalAdapter.js', './js/printer/serialAdapter.js', './js/printer/localBridgeAdapter.js', './js/printer/printerInterface.js',
  './internal/login.js', './internal/dashboard.js', './internal/pos.js', './internal/transactions.js', './internal/products.js', './internal/inventory.js',
  './internal/purchases.js', './internal/suppliers.js', './internal/payables.js', './internal/customers.js', './internal/receivables.js',
  './internal/orders.js', './internal/cash.js', './internal/expenses.js', './internal/reports.js', './internal/users.js', './internal/settings.js',
  './internal/promos.js', './internal/messages.js', './internal/profile.js',
  './shop/home.js', './shop/catalog.js', './shop/cart.js', './shop/checkout.js', './shop/payment.js', './shop/order.js', './shop/tracking.js',
  './assets/icons/tokoqia-app-icon.png', './assets/icons/tokoqia-favicon.png',
  './assets/icons/tokoqia-horizontal.png', './assets/icons/tokoqia-icon.png', './assets/icons/tokoqia-white.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(SHELL_FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
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

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).catch(function () {
        if (req.mode === 'navigate') return caches.match('./offline.html');
        return new Response('', { status: 504 });
      });
    })
  );
});
