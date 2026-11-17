/**
 * js/printer/nativeAdapter.js
 * Cetak LANGSUNG dari dalam aplikasi TOKOQIA (APK Android / aplikasi iPhone hasil bungkus Capacitor).
 * Di browser biasa adapter ini tidak aktif (isAvailable() = false) dan tidak mengubah perilaku apa pun.
 *
 * Bagian asli (native) disediakan oleh native/app-native/src/bridge.js -> window.TokoqiaNative:
 *   { isNative, platform, methods:['ble','spp'|...],
 *     ble: { requestDevice(), connect(id,onDisconnect), disconnect(id), getServices(id), write(id,svc,chr,bytes,withoutResponse) },
 *     spp: { listBonded(), connect(address), write(address,bytes), disconnect(address) } }
 * Semua LOGIKA (pemilihan karakteristik tulis, pemotongan data, coba ulang, pesan galat) ada di file ini
 * supaya bisa diuji tanpa perangkat. Bagian tipis di bridge.js baru terbukti setelah dibangun & dicoba di HP.
 *
 * ATURAN: "berhasil" di sini hanya berarti DATA TERKIRIM ke printer (bukan bukti kertas keluar).
 * Tidak pernah beralih diam-diam ke dialog browser.
 *  - iPhone: hanya 'ble' (Bluetooth Classic/SPP tidak tersedia untuk printer non-MFi di iOS).
 *  - Android: 'ble' dan 'spp'.
 */
window.PrinterNativeAdapter = (function () {
  var SEL_KEY = 'azqia_native_printer';
  var CHUNK_KEY = 'azqia_native_chunk';
  var PREFER = ['ffe1', 'fff2', 'ae01', '2af1']; // karakteristik tulis printer thermal yang umum
  var CONNECT_TIMEOUT_MS = 15000;
  var WRITE_TIMEOUT_MS = 30000;

  var conn = { method: null, id: null, ble: null, connected: false };

  function nat() { return window.TokoqiaNative || null; }
  function isAvailable() { var n = nat(); return !!(n && n.isNative && n.methods && n.methods.length); }
  function methods() { var n = nat(); return n && n.methods ? n.methods.slice() : []; }
  function platform() { var n = nat(); return n ? n.platform : 'web'; }

  function getSelection() { try { return JSON.parse(localStorage.getItem(SEL_KEY) || 'null'); } catch (e) { return null; } }
  function setSelection(sel) { if (sel) localStorage.setItem(SEL_KEY, JSON.stringify(sel)); else localStorage.removeItem(SEL_KEY); }
  function chunkSize() { var n = Number(localStorage.getItem(CHUNK_KEY)); return n >= 20 && n <= 512 ? n : 20; }
  function setChunkSize(n) { localStorage.setItem(CHUNK_KEY, String(n)); }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function withTimeout(p, ms, msg) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error(msg)); }, ms);
      p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function friendly(err) {
    var s = (err && err.message) ? String(err.message) : String(err || 'galat tidak dikenal');
    return s.length > 160 ? s.substring(0, 160) : s;
  }

  // ---------- Pemilihan printer ----------
  /** BLE: memunculkan pemilih perangkat milik aplikasi. SPP: daftar printer yang sudah di-pair di Pengaturan Bluetooth Android. */
  function pickBle() {
    var n = nat();
    if (!isAvailable() || methods().indexOf('ble') < 0) return Promise.reject(new Error('Bluetooth LE tidak tersedia di perangkat ini.'));
    return n.ble.requestDevice().then(function (d) {
      if (!d || !d.deviceId) throw new Error('Tidak ada printer dipilih.');
      var sel = { method: 'ble', id: d.deviceId, name: d.name || '(tanpa nama)' };
      setSelection(sel); resetConn();
      return sel;
    });
  }
  function listBonded() {
    var n = nat();
    if (!isAvailable() || methods().indexOf('spp') < 0) return Promise.reject(new Error('Bluetooth Classic (SPP) hanya tersedia di aplikasi Android.'));
    return n.spp.listBonded();
  }
  function selectSpp(device) {
    var sel = { method: 'spp', id: device.address, name: device.name || device.address };
    setSelection(sel); resetConn();
    return sel;
  }
  function resetConn() { conn = { method: null, id: null, ble: null, connected: false }; }

  // ---------- Koneksi ----------
  function discoverWritable(deviceId) {
    return nat().ble.getServices(deviceId).then(function (services) {
      var best = null;
      (services || []).forEach(function (s) {
        (s.characteristics || []).forEach(function (c) {
          var p = c.properties || {};
          if (!(p.write || p.writeWithoutResponse)) return;
          var cand = { service: s.uuid, characteristic: c.uuid, noResp: !!p.writeWithoutResponse };
          if (!best) best = cand;
          var id = String(c.uuid).toLowerCase();
          if (PREFER.some(function (k) { return id.indexOf(k) >= 0; })) best = cand;
        });
      });
      if (!best) throw new Error('Perangkat ini tidak punya saluran tulis (bukan printer BLE?). Coba Bluetooth Classic (Android) atau printer lain.');
      return best;
    });
  }

  function connect() {
    var sel = getSelection();
    if (!isAvailable()) return Promise.reject(new Error('Fitur cetak langsung hanya ada di aplikasi TOKOQIA.'));
    if (!sel) return Promise.reject(new Error('Printer belum dipilih. Buka Pengaturan -> Printer -> pilih printer.'));
    if (conn.connected && conn.id === sel.id && conn.method === sel.method) return Promise.resolve(sel);
    var n = nat();
    var p;
    if (sel.method === 'spp') {
      p = n.spp.connect(sel.id).then(function () { conn = { method: 'spp', id: sel.id, ble: null, connected: true }; });
    } else {
      p = n.ble.connect(sel.id, function () { if (conn.id === sel.id) conn.connected = false; })
        .then(function () { return discoverWritable(sel.id); })
        .then(function (w) { conn = { method: 'ble', id: sel.id, ble: w, connected: true }; });
    }
    return withTimeout(p, CONNECT_TIMEOUT_MS, 'Waktu menyambung ke ' + sel.name + ' habis. Pastikan printer menyala, dekat, dan tidak dipakai perangkat lain.')
      .then(function () { return sel; })
      .catch(function (err) { resetConn(); throw err; });
  }

  function disconnect() {
    var sel = getSelection(), n = nat();
    var was = conn; resetConn();
    if (!sel || !n || !was.connected) return Promise.resolve();
    var p = sel.method === 'spp' ? n.spp.disconnect(sel.id) : n.ble.disconnect(sel.id);
    return Promise.resolve(p).catch(function () {});
  }

  // ---------- Pengiriman data ----------
  function writeBle(bytes) {
    var n = nat(), sel = getSelection(), w = conn.ble, size = chunkSize();
    var i = 0;
    function next() {
      if (i >= bytes.length) return Promise.resolve();
      var part = bytes.slice(i, i + size); i += size;
      return n.ble.write(sel.id, w.service, w.characteristic, part, w.noResp).then(function () { return sleep(w.noResp ? 15 : 0); }).then(next);
    }
    return next();
  }
  function writeSpp(bytes) { return nat().spp.write(getSelection().id, bytes); }

  /** Kirim byte ke printer; bila gagal, sambung ulang lalu coba sekali lagi. Galat terakhir diteruskan apa adanya. */
  function sendBytes(bytes) {
    function attempt() {
      return connect().then(function (sel) {
        return withTimeout(sel.method === 'spp' ? writeSpp(bytes) : writeBle(bytes), WRITE_TIMEOUT_MS,
          'Printer tidak merespons saat mengirim data. Periksa apakah printer menyala dan kertas ada.');
      });
    }
    return attempt().catch(function () {
      return disconnect().then(function () { return attempt(); });
    }).catch(function (err) { throw new Error(friendly(err)); });
  }

  function print(receiptData) {
    return window.ReceiptBuilder.buildEscPosBytes(receiptData).then(sendBytes);
  }
  function testPrint() {
    return window.ReceiptBuilder.buildTestPrintBytes().then(sendBytes);
  }
  function preview(receiptData) { return window.ReceiptBuilder.buildTextLines(receiptData).join('\n'); }

  function status() {
    var sel = getSelection();
    return { available: isAvailable(), platform: platform(), methods: methods(), selected: sel, connected: !!conn.connected && !!sel && conn.id === sel.id };
  }

  return {
    name: 'native', isAvailable: isAvailable, methods: methods, platform: platform,
    pickBle: pickBle, listBonded: listBonded, selectSpp: selectSpp,
    getSelection: getSelection, setSelection: setSelection, chunkSize: chunkSize, setChunkSize: setChunkSize,
    connect: connect, disconnect: disconnect, print: print, testPrint: testPrint, preview: preview, status: status
  };
})();
