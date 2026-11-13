/**
 * js/offline.js - Kasir offline: snapshot katalog (IndexedDB), antrean penjualan (outbox), sinkron otomatis, struk lokal.
 * Prinsip: penjualan offline DICATAT di perangkat (kunci idempotensi + harga yang dibayar + waktu kejadian), lalu dikirim saat online.
 * Server mencegah duplikat (kunci disimpan permanen), mencatat stok negatif bila perlu, dan melaporkannya ke pemilik.
 */
window.Offline = (function () {
  var DB = 'azqia_offline', STORE = 'kv', dbp = null, listeners = [], outbox = [], done = [], loaded = null, syncing = false, timer = null;
  var lastFail = 0, lastOk = 0, snapshotMem = null;

  // ---------- penyimpanan: IndexedDB, cadangan localStorage ----------
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  function kvGet(k) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) { var q = db.transaction(STORE, 'readonly').objectStore(STORE).get(k); q.onsuccess = function () { res(q.result === undefined ? null : q.result); }; q.onerror = function () { rej(q.error); }; });
    }).catch(function () { try { var v = localStorage.getItem('azqia_kv_' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } });
  }
  function kvSet(k, v) {
    return openDb().then(function (db) {
      return new Promise(function (res, rej) { var q = db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k); q.onsuccess = function () { res(); }; q.onerror = function () { rej(q.error); }; });
    }).catch(function () { try { localStorage.setItem('azqia_kv_' + k, JSON.stringify(v)); } catch (e) {} });
  }
  function emit() { listeners.slice().forEach(function (fn) { try { fn(counts()); } catch (e) {} }); }
  function on(fn) { listeners.push(fn); }
  function counts() {
    var failed = outbox.filter(function (x) { return x.status === 'failed'; }).length;
    return { pending: outbox.length - failed, failed: failed, total: outbox.length, online: isOnline(), syncing: syncing };
  }
  function load() {
    if (loaded) return loaded;
    loaded = Promise.all([kvGet('outbox'), kvGet('done')]).then(function (r) { outbox = r[0] || []; done = r[1] || []; emit(); });
    return loaded;
  }
  function saveBox() { return kvSet('outbox', outbox).then(function () { return kvSet('done', done); }); }

  // ---------- status jaringan ----------
  function isOnline() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return !(lastFail > lastOk && Date.now() - lastFail < 15000);      // "terhubung Wi-Fi tapi tanpa internet": gagal baru-baru ini
  }
  function noteFail() { lastFail = Date.now(); emit(); }
  function noteOk() { lastOk = Date.now(); }

  // ---------- snapshot katalog ----------
  function pendingQtyBase(productId, snap) {
    var units = {}; (snap.product_units || []).forEach(function (u) { if (u.product_id === productId) units[u.unit_id] = Number(u.conversion_to_base) || 1; });
    var q = 0;
    outbox.forEach(function (o) { (o.payload.items || []).forEach(function (it) { if (it.product_id === productId) q += Number(it.qty) * (units[it.unit_id] || 1); }); });
    return q;
  }
  /** Kurangi stok lokal sebesar penjualan yang masih menunggu kirim (agar angka stok di layar tidak "kembali" setelah menyegarkan). */
  function adjustStock(snap) {
    (snap.products || []).forEach(function (p) { var q = pendingQtyBase(p.product_id, snap); if (q) p.current_stock = Number(p.current_stock) - q; });
    return snap;
  }
  function loadSnapshot() { return load().then(function () { if (snapshotMem) return snapshotMem; return kvGet('snapshot').then(function (s) { snapshotMem = s ? adjustStock(s) : null; return snapshotMem; }); }); }
  function refreshSnapshot() {
    return load().then(function () { return Api.call('pos.snapshot', {}, { timeoutMs: 30000 }); }).then(function (sn) {
      sn.saved_at = new Date().toISOString();
      return kvSet('snapshot', JSON.parse(JSON.stringify(sn))).then(function () { snapshotMem = adjustStock(sn); return snapshotMem; });
    });
  }

  // ---------- antrean ----------
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function isoLocal(d) {
    var off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-'; off = Math.abs(off);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + sign + pad(Math.floor(off / 60)) + ':' + pad(off % 60);
  }
  function nextLocalNumber() {
    var d = new Date(), key = 'counter_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    return kvGet(key).then(function (n) { n = (n || 0) + 1; return kvSet(key, n).then(function () { return 'OFF-' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(n, 3); }); });
  }
  /** Struk lokal: bentuk SAMA dengan pos.reprintReceipt agar ReceiptBuilder & printer bekerja tanpa perubahan. */
  function buildReceipt(num, createdAt, cart, discount, payments, customerName, snap) {
    var st = (snap && snap.store) || {}, subtotal = cart.reduce(function (s, l) { return s + l.qty * l.unit_price - l.discount; }, 0), total = Math.max(0, subtotal - discount);
    return {
      store_name: st.store_name || 'TOKO AZQIA', store_tagline: st.store_tagline || '', store_address: st.store_address || '', sale_number: num, date: createdAt,
      cashier_name: (snap && snap.user && snap.user.full_name) || '', customer_name: customerName || '',
      items: cart.map(function (l) { return { name: l.product_name, qty: l.qty, unit: l.unit_name || '', unit_price: l.unit_price, subtotal: l.qty * l.unit_price - l.discount }; }),
      subtotal: subtotal, discount: discount, total: total,
      payments: payments.map(function (p) { var rec = p.method === 'CASH' ? Number(p.received || p.amount) : Number(p.amount); return { method: p.method, amount: rec, change: p.method === 'CASH' ? Math.max(0, rec - Number(p.amount)) : 0, status: 'PAID' }; }),
      status: 'COMPLETED', footer_line1: 'TERIMA KASIH', footer_line2: 'TELAH BERBELANJA', copyright: '\u00A9 ' + (st.store_year || '2026') + ' ' + (st.store_name || 'TOKO AZQIA')
    };
  }
  /** Simpan penjualan ke antrean. base = payload online (items, discount, payments, customer_id, idempotency_key). */
  function enqueue(base, cart, customerName) {
    return load().then(function () { return Promise.all([nextLocalNumber(), loadSnapshot()]); }).then(function (r) {
      var now = new Date(), payload = JSON.parse(JSON.stringify(base));
      payload.offline = true; payload.client_created_at = isoLocal(now);
      payload.items = payload.items.map(function (it, i) { return Object.assign({}, it, { unit_price: cart[i].unit_price }); });   // harga yang DIBAYAR pelanggan
      var receipt = buildReceipt(r[0], payload.client_created_at, cart, payload.discount || 0, payload.payments, customerName, r[1]);
      var item = { local_id: payload.idempotency_key, local_number: r[0], created_at: payload.client_created_at, total: receipt.total, payload: payload, receipt: receipt, status: 'pending', attempts: 0, error: '' };
      outbox.push(item);
      return saveBox().then(function () { emit(); return item; });
    });
  }
  /** Kurangi stok lokal untuk item yang baru masuk antrean (satu kali; refresh berikutnya memakai adjustStock). */
  function decrementLocal(cart) {
    if (!snapshotMem) return;
    cart.forEach(function (l) { var p = snapshotMem.products.filter(function (x) { return x.product_id === l.product_id; })[0]; if (p) p.current_stock = Number(p.current_stock) - l.qty * (Number(l.conversion_to_base) || 1); });
  }

  // ---------- sinkron ----------
  function classify(err) {
    var c = err && err.code;
    if (c === 'NETWORK_ERROR' || c === 'TIMEOUT') return 'retry';
    if (c === 'SESSION_EXPIRED' || c === 'AUTH_REQUIRED' || c === 'AUTH_INVALID' || c === 'FORBIDDEN') return 'auth';
    return 'failed';
  }
  function sync() {
    if (syncing) return Promise.resolve({ busy: true });
    return load().then(function () {
      var todo = outbox.filter(function (x) { return x.status !== 'failed'; });
      if (!todo.length) return { sent: 0 };
      if (!isOnline()) return { sent: 0, offline: true };
      syncing = true; emit();
      var sent = 0, negatives = [], stop = false, chain = Promise.resolve();
      todo.forEach(function (item) {
        chain = chain.then(function () {
          if (stop) return;
          return Api.call('pos.createSale', item.payload, { timeoutMs: 30000 }).then(function (res) {
            noteOk(); sent++;
            outbox = outbox.filter(function (x) { return x.local_id !== item.local_id; });
            done.unshift({ local_number: item.local_number, server_number: res.sale_number, total: item.total, at: new Date().toISOString(), negative_stock: res.negative_stock || [] });
            done = done.slice(0, 20);
            if (res.negative_stock && res.negative_stock.length) negatives = negatives.concat(res.negative_stock);
            if (window.Notify && res.sale_number) Notify.rememberSale(res.sale_number);
            return saveBox();
          }, function (err) {
            var k = classify(err);
            if (k === 'retry') { noteFail(); stop = true; return; }
            if (k === 'auth') { stop = true; return; }
            item.status = 'failed'; item.error = (err && err.message) || 'Ditolak server'; item.attempts++;
            return saveBox();
          });
        });
      });
      return chain.then(function () { syncing = false; emit(); return { sent: sent, negatives: negatives }; }, function (e) { syncing = false; emit(); throw e; });
    });
  }
  function retryFailed(localId) { return load().then(function () { outbox.forEach(function (x) { if (x.local_id === localId) { x.status = 'pending'; x.error = ''; } }); return saveBox().then(function () { emit(); return sync(); }); }); }
  function discard(localId) { return load().then(function () { outbox = outbox.filter(function (x) { return x.local_id !== localId; }); return saveBox().then(emit); }); }
  function list() { return load().then(function () { return { outbox: outbox.slice(), done: done.slice() }; }); }
  function pendingCount() { return outbox.length; }

  /** Dipanggil sekali saat aplikasi staf dibuka. */
  function start() {
    if (timer) return; timer = setInterval(function () { if (outbox.length && isOnline() && !syncing) sync().then(announce); }, 20000);
    window.addEventListener('online', function () { emit(); sync().then(announce); });
    window.addEventListener('offline', emit);
    load().then(function () { if (outbox.length && isOnline()) sync().then(announce); });
  }
  function announce(r) {
    if (!r || !r.sent) return;
    if (window.Utils && Utils.toast) Utils.toast(r.sent + ' transaksi offline terkirim ke server.', 'success');
    if (r.negatives && r.negatives.length && window.Utils) Utils.toast('Perhatian: stok negatif untuk ' + r.negatives.join(', ') + '. Periksa stok.', 'error');
    refreshSnapshot().catch(function () {});
    Api.call('notify.flush', {}).catch(function () {});
  }
  return { on: on, counts: counts, isOnline: isOnline, noteFail: noteFail, noteOk: noteOk, loadSnapshot: loadSnapshot, refreshSnapshot: refreshSnapshot, enqueue: enqueue, decrementLocal: decrementLocal,
    sync: sync, retryFailed: retryFailed, discard: discard, list: list, pendingCount: pendingCount, start: start, announce: announce, buildReceipt: buildReceipt, isoLocal: isoLocal };
})();
