/**
 * js/printer/thermalAdapter.js
 * Cetak langsung ke printer thermal 58mm (target: PUTIAN POS 583-01) lewat Web Bluetooth (ESC/POS).
 *
 * KETERBATASAN JUJUR YANG WAJIB DIBACA (lihat juga docs/KNOWN_LIMITATIONS.md):
 * 1. Web Bluetooth API browser HANYA mendukung Bluetooth Low Energy (BLE GATT), TIDAK
 *    mendukung Bluetooth Classic/SPP. Banyak printer thermal murah (kemungkinan termasuk
 *    PUTIAN 583-01, tergantung revisi hardware) menggunakan Classic SPP, BUKAN BLE.
 *    Kami TIDAK BISA memastikan kompatibilitas tanpa menguji unit fisiknya langsung.
 *    Jika printer Anda ternyata SPP, adapter ini TIDAK akan menemukan device sama sekali -
 *    gunakan browserAdapter.js (fallback cetak lewat dialog print browser) sebagai gantinya.
 * 2. Web Bluetooth TIDAK tersedia sama sekali di Safari/iOS (semua browser iOS memakai
 *    WebKit yang tidak mengimplementasikan Web Bluetooth). Di iPhone/iPad, browserAdapter.js
 *    adalah SATU-SATUNYA jalur cetak yang berfungsi.
 * 3. SERVICE_UUID/CHARACTERISTIC_UUID di bawah adalah UUID umum yang dipakai banyak printer
 *    BLE UART murah (mis. chip BLE serial generik). PASTIKAN dulu UUID printer Anda yang
 *    sesungguhnya lewat aplikasi BLE scanner (mis. "nRF Connect") sebelum mengandalkan ini -
 *    lihat docs/PRINTER (bagian troubleshooting di docs/USER_GUIDE.md).
 */
window.PrinterThermalAdapter = (function () {
  var SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // UMUM - VERIFIKASI dengan BLE scanner
  var CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb'; // UMUM - VERIFIKASI dengan BLE scanner
  var cachedDevice = null;

  function isAvailable() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  function textToEscPos(lines) {
    var ESC = '\x1b', GS = '\x1d';
    var body = lines.join('\n') + '\n\n\n';
    var init = ESC + '@';
    var cut = GS + 'V' + '\x00';
    var full = init + body + cut;
    var bytes = new Uint8Array(full.length);
    for (var i = 0; i < full.length; i++) bytes[i] = full.charCodeAt(i) & 0xff;
    return bytes;
  }

  function connect() {
    if (!isAvailable()) {
      return Promise.reject(new Error('Web Bluetooth tidak tersedia di browser ini (mis. Safari/iOS). Gunakan cetak browser sebagai gantinya.'));
    }
    return navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID]
    }).then(function (device) {
      cachedDevice = device;
      return device.gatt.connect();
    }).then(function (server) {
      return server.getPrimaryService(SERVICE_UUID);
    }).then(function (service) {
      return service.getCharacteristic(CHARACTERISTIC_UUID);
    });
  }

  function writeInChunks(characteristic, bytes) {
    var CHUNK = 180; // batas aman payload BLE per write
    var i = 0;
    function next() {
      if (i >= bytes.length) return Promise.resolve();
      var chunk = bytes.slice(i, i + CHUNK);
      i += CHUNK;
      return characteristic.writeValue(chunk).then(next);
    }
    return next();
  }

  function print(receiptData) {
    var lines = window.ReceiptBuilder.buildTextLines(receiptData);
    var bytes = textToEscPos(lines);
    return connect().then(function (characteristic) {
      return writeInChunks(characteristic, bytes);
    });
  }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildTextLines(receiptData).join('\n');
  }

  return { name: 'thermal-bluetooth', isAvailable: isAvailable, print: print, preview: preview };
})();
