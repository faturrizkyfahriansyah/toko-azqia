/**
 * js/printer/thermalAdapter.js
 * Cetak lewat Web Bluetooth (BLE GATT) - HANYA berfungsi untuk printer yang benar-benar
 * memakai profil Bluetooth Low Energy (BLE), BUKAN Bluetooth Classic/SPP.
 *
 * KOREKSI PENTING (hasil audit fisik terhadap printer PUTIAN POS RPP02N / firmware YC-6002):
 * Pola pairing printer ini (nama device di-broadcast "RPP02N" + PIN manual "0000") adalah
 * pola KHAS Bluetooth Classic/SPP, BUKAN BLE. Web Bluetooth API browser TIDAK BISA melihat
 * atau menyambung ke perangkat Classic/SPP sama sekali - ini keterbatasan platform, bukan bug
 * di sini. Artinya adapter INI KEMUNGKINAN BESAR TIDAK AKAN MENEMUKAN RPP02N sama sekali saat
 * diklik. Adapter ini TETAP DIPERTAHANKAN (tidak dihapus) karena masih valid untuk printer BLE
 * lain di masa depan - tapi JANGAN diasumsikan sebagai jalur utama untuk RPP02N. Untuk RPP02N,
 * gunakan serialAdapter.js (Windows, via Web Serial/Bluetooth COM) atau browserAdapter.js
 * (fallback universal, semua platform) - lihat printerInterface.js untuk urutan prioritas.
 *
 * Keterbatasan lain yang tetap berlaku:
 * - Web Bluetooth TIDAK tersedia sama sekali di Safari/iOS (WebKit tidak mengimplementasikannya).
 * - SERVICE_UUID/CHARACTERISTIC_UUID di bawah adalah UUID umum BLE UART - HANYA relevan jika
 *   printer target benar-benar BLE dan UUID-nya kebetulan sama; PASTIKAN dulu lewat BLE scanner
 *   (mis. "nRF Connect") sebelum mengandalkan adapter ini untuk printer tertentu.
 * - TIDAK ADA command cutter (GS V) yang dikirim - struk diakhiri feed kertas untuk dirobek
 *   manual (lihat `docs/KNOWN_LIMITATIONS.md`).
 */
window.PrinterThermalAdapter = (function () {
  var SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // UMUM - VERIFIKASI dengan BLE scanner
  var CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb'; // UMUM - VERIFIKASI dengan BLE scanner
  var CONNECT_TIMEOUT_MS = 15000;

  function isAvailable() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  function withTimeout(promise, ms, timeoutMessage) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(timeoutMessage)); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function connect() {
    if (!isAvailable()) {
      return Promise.reject(new Error('Web Bluetooth tidak tersedia di browser/perangkat ini (mis. Safari/iOS). Gunakan koneksi Serial (Windows) atau Cetak via Browser.'));
    }
    return withTimeout(
      navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }], optionalServices: [SERVICE_UUID] })
        .then(function (device) { return device.gatt.connect(); })
        .then(function (server) { return server.getPrimaryService(SERVICE_UUID); })
        .then(function (service) { return service.getCharacteristic(CHARACTERISTIC_UUID); }),
      CONNECT_TIMEOUT_MS,
      'Printer tidak ditemukan atau waktu koneksi habis. Pastikan printer menyala dan berada dalam jangkauan. Jika printer tidak muncul di daftar perangkat sama sekali, printer ini kemungkinan memakai Bluetooth Classic/SPP (bukan BLE) - gunakan koneksi Serial (Windows) atau Cetak via Browser sebagai gantinya.'
    );
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
    return window.ReceiptBuilder.buildEscPosBytes(receiptData).then(function (bytes) {
      return connect().then(function (characteristic) { return writeInChunks(characteristic, bytes); });
    });
  }

  function testPrint() {
    return window.ReceiptBuilder.buildTestPrintBytes().then(function (bytes) {
      return connect().then(function (characteristic) { return writeInChunks(characteristic, bytes); });
    });
  }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildTextLines(receiptData).join('\n');
  }

  return { name: 'thermal-bluetooth', isAvailable: isAvailable, print: print, testPrint: testPrint, preview: preview };
})();
