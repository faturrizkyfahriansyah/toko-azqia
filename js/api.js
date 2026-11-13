/**
 * js/api.js - satu titik komunikasi ke backend Apps Script Web App.
 * BASE URL diisi di config.js setelah deploy (docs/DEPLOYMENT.md TAHAP 11).
 */
window.Api = (function () {
  function baseUrl() {
    var url = (window.TOKO_AZQIA_CONFIG && window.TOKO_AZQIA_CONFIG.apiBaseUrl) || '';
    if (!url) throw new Error('API belum dikonfigurasi. Isi apiBaseUrl di js/config.js (lihat docs/DEPLOYMENT.md TAHAP 11).');
    return url;
  }

  function ApiClientError(code, message) {
    this.code = code; this.message = message; this.name = 'ApiClientError';
  }
  ApiClientError.prototype = Object.create(Error.prototype);

  // ---- Pengukuran performa (di memori, tanpa data pribadi) ----
  var perfLog = [], perfFail = 0, perfTimeout = 0;
  function record(action, ms, ok, code) {
    perfLog.push({ a: action, ms: ms, ok: ok });
    if (perfLog.length > 200) perfLog.shift();
    if (!ok) { perfFail++; if (code === 'TIMEOUT') perfTimeout++; }
  }
  function perf() {
    var ms = perfLog.map(function (x) { return x.ms; }).sort(function (x, y) { return x - y; });
    var pick = function (q) { return ms.length ? ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] : 0; };
    return { calls: perfLog.length, p50: pick(0.5), p95: pick(0.95), failures: perfFail, timeouts: perfTimeout };
  }
  /** Batas waktu permintaan (bawaan 25 dtk; dapat diubah lewat config apiTimeoutMs atau opts.timeoutMs). Tidak ada loading tanpa akhir. */
  function timeoutMs(opts) { return (opts && opts.timeoutMs) || (window.TOKO_AZQIA_CONFIG && window.TOKO_AZQIA_CONFIG.apiTimeoutMs) || 25000; }

  function rawCall(action, payload, opts) {
    var token = (window.Auth && window.Auth.getToken()) || '';
    var started = Date.now(), timer = null, ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    // Promise.resolve().then(...) memastikan call() SELALU mengembalikan Promise, termasuk saat
    // baseUrl() throw (belum dikonfigurasi) - supaya pemanggil yang pakai .catch() selalu bisa
    // menangkap errornya dan menampilkan pesan yang jelas, bukan membuat UI macet diam-diam
    // (mis. tombol tetap tertulis "Memproses..." selamanya karena exception tidak pernah ditangkap).
    var work = Promise.resolve().then(function () {
      return fetch(baseUrl(), {
        signal: ctl ? ctl.signal : undefined,
        method: 'POST',
        // text/plain menghindari CORS preflight OPTIONS yang tidak didukung Apps Script Web App.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: token, payload: payload || {} })
      });
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success) {
          if (json.errorCode === 'SESSION_EXPIRED' && window.Auth) {
            window.Auth.clearSession();
            location.hash = '#/internal/login';
          }
          throw new ApiClientError(json.errorCode, json.message);
        }
        return json.data;
      })
      .catch(function (err) {
        if (err instanceof ApiClientError) throw err;
        // Pertahankan pesan asli untuk error konfigurasi (bukan masalah jaringan) supaya tidak
        // menyesatkan - hanya error fetch/network sungguhan yang dijadikan pesan generik di bawah.
        if (err && /apiBaseUrl belum diisi|API belum dikonfigurasi/.test(err.message || '')) {
          throw new ApiClientError('CONFIG_ERROR', err.message);
        }
        throw new ApiClientError('NETWORK_ERROR', 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
      });
    var limit = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (ctl) { try { ctl.abort(); } catch (e) {} }
        reject(new ApiClientError('TIMEOUT', 'Server terlalu lama menjawab. Periksa koneksi lalu coba lagi.'));
      }, timeoutMs(opts));
    });
    return Promise.race([work, limit]).then(function (v) {
      clearTimeout(timer); record(action, Date.now() - started, true); if (window.Offline) Offline.noteOk(); return v;
    }, function (err) {
      clearTimeout(timer); record(action, Date.now() - started, false, err && err.code);
      if (window.Offline && err && (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT')) Offline.noteFail();
      throw err;
    });
  }

  // ---- Cache data yang jarang berubah (stale maksimal TTL) + pencegahan permintaan ganda ----
  var CACHE_TTL = { 'public.categories': 120, 'public.storeInfo': 300, 'category.list': 120, 'unit.list': 300, 'bankAccount.list': 120, 'delivery.get': 120, 'productUnit.list': 60 };
  var INVALIDATE = { 'category.': 'category.list', 'unit.': 'unit.list', 'bankAccount.': 'bankAccount.list', 'delivery.': 'delivery.get', 'productUnit.': 'productUnit.list' };
  var READ_RE = /\.(list|get|detail|summary|threads|messages|stats|status|preview|ledger|info)$/;
  var cache = {}, inflight = {}, cacheHits = 0, dedupHits = 0;
  function keyOf(action, payload) { return action + '|' + JSON.stringify(payload || {}); }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function dropCache(listAction) { Object.keys(cache).forEach(function (k) { if (k.indexOf(listAction + '|') === 0) delete cache[k]; }); }

  /**
   * call(): (1) data jarang berubah diambil dari cache; (2) permintaan IDENTIK yang masih berjalan dipakai bersama
   * (tekan dua kali = satu permintaan); (3) tulis yang sukses membersihkan cache terkait. Batas waktu ada di rawCall.
   */
  function call(action, payload, opts) {
    var k = keyOf(action, payload), ttl = CACHE_TTL[action];
    if (ttl && cache[k] && cache[k].exp > Date.now()) { cacheHits++; return Promise.resolve(clone(cache[k].v)); }
    if (inflight[k]) { dedupHits++; return inflight[k].then(clone); }
    var p = rawCall(action, payload, opts).then(function (data) {
      if (ttl) cache[k] = { v: clone(data), exp: Date.now() + ttl * 1000 };
      if (!READ_RE.test(action)) {
        Object.keys(INVALIDATE).forEach(function (pre) { if (action.indexOf(pre) === 0) dropCache(INVALIDATE[pre]); });
        if (action === 'auth.login' || action === 'auth.logout') cache = {};
      }
      return data;
    });
    inflight[k] = p;
    var done = function () { if (inflight[k] === p) delete inflight[k]; };
    p.then(done, done);
    return p;
  }

  return { call: call, ApiClientError: ApiClientError, perf: function () { var r = perf(); r.cacheHits = cacheHits; r.dedupHits = dedupHits; return r; } };
})();
