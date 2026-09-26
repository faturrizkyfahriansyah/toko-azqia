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

  function call(action, payload) {
    var token = (window.Auth && window.Auth.getToken()) || '';
    // Promise.resolve().then(...) memastikan call() SELALU mengembalikan Promise, termasuk saat
    // baseUrl() throw (belum dikonfigurasi) - supaya pemanggil yang pakai .catch() selalu bisa
    // menangkap errornya dan menampilkan pesan yang jelas, bukan membuat UI macet diam-diam
    // (mis. tombol tetap tertulis "Memproses..." selamanya karena exception tidak pernah ditangkap).
    return Promise.resolve().then(function () {
      return fetch(baseUrl(), {
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
  }

  return { call: call, ApiClientError: ApiClientError };
})();
