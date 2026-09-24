/**
 * js/printer/localBridgeAdapter.js
 * Client untuk TOKOQIA Local Print Bridge - script Node.js sederhana yang dijalankan manual
 * (`node bridge.js`) di komputer yang sama dengan printer terhubung (lihat folder
 * bridge/node-bridge/ di paket ini). Jalur ini dibutuhkan untuk printer Bluetooth Classic/SPP
 * (seperti BT-583/RPP02N) yang TIDAK bisa diakses Web Bluetooth API browser sama sekali.
 *
 * Bridge berjalan di http://127.0.0.1:8765 dan HANYA bisa diakses dari komputer yang sama
 * (bind ke 127.0.0.1, bukan jaringan) - lihat bridge/node-bridge/bridge.js untuk detail keamanan.
 *
 * TIDAK PERNAH mengklaim bridge aktif tanpa benar-benar berhasil ping /status terlebih dahulu.
 */
window.PrinterLocalBridgeAdapter = (function () {
  var BASE = 'http://127.0.0.1:8765';
  var PORT_KEY = 'azqia_bridge_port';
  var lastKnownUp = false;

  function ping(timeoutMs) {
    return new Promise(function (resolve) {
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); resolve(false); }, timeoutMs || 700);
      fetch(BASE + '/status', { signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
        clearTimeout(timer);
        lastKnownUp = r.ok;
        resolve(r.ok);
      }).catch(function () { clearTimeout(timer); lastKnownUp = false; resolve(false); });
    });
  }

  /** Status TERAKHIR yang diketahui (sinkron, untuk daftar cepat di UI) - panggil checkAvailability() untuk cek ulang yang benar-benar fresh. */
  function isAvailable() { return lastKnownUp; }
  function checkAvailability() { return ping(700); }

  function listPrinters() {
    return fetch(BASE + '/printers').then(function (r) { return r.json(); }).then(function (d) { return d.ports || []; });
  }

  function connect(path) {
    return fetch(BASE + '/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) throw new Error(d.error || 'Gagal menghubungkan ke printer lewat bridge.');
      localStorage.setItem(PORT_KEY, path);
      return d;
    });
  }

  function disconnect() {
    return fetch(BASE + '/disconnect', { method: 'POST' }).then(function (r) { return r.json(); });
  }

  function sendBytes(bytes, jobId) {
    return fetch(BASE + '/print', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bytes: Array.prototype.slice.call(bytes), jobId: jobId || null })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) throw new Error(d.error || 'Bridge gagal mencetak.');
      return d;
    }).catch(function (err) {
      if (err instanceof TypeError) throw new Error('TOKOQIA Print Bridge tidak aktif. Jalankan "node bridge.js" di komputer ini, lalu coba lagi.');
      throw err;
    });
  }

  function ensureConnected() {
    return ping(700).then(function (up) {
      if (!up) throw new Error('TOKOQIA Print Bridge tidak aktif. Jalankan "node bridge.js" di komputer ini terlebih dahulu.');
      return fetch(BASE + '/status').then(function (r) { return r.json(); });
    }).then(function (status) {
      if (status.connected) return status;
      var savedPath = localStorage.getItem(PORT_KEY);
      if (!savedPath) throw new Error('Belum ada printer dipilih untuk Bridge. Buka Pengaturan -> Printer -> Local Bridge -> pilih port.');
      return connect(savedPath);
    });
  }

  function print(receiptData) {
    return window.ReceiptBuilder.buildEscPosBytes(receiptData).then(function (bytes) {
      return ensureConnected().then(function () { return sendBytes(bytes); });
    });
  }

  function testPrint() {
    return window.ReceiptBuilder.buildTestPrintBytes().then(function (bytes) {
      return ensureConnected().then(function () { return sendBytes(bytes); });
    });
  }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildTextLines(receiptData).join('\n');
  }

  return {
    name: 'local-bridge', isAvailable: isAvailable, checkAvailability: checkAvailability,
    print: print, testPrint: testPrint, preview: preview,
    listPrinters: listPrinters, connect: connect, disconnect: disconnect
  };
})();
