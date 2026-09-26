/**
 * js/printer/serialAdapter.js
 * Cetak lewat Web Serial API (`navigator.serial`) - mengirim raw ESC/POS bytes langsung ke
 * port serial. Ini jalur yang RELEVAN untuk printer Bluetooth Classic/SPP seperti PUTIAN POS
 * RPP02N, KARENA Windows (dan hanya Windows/desktop) mengekspos perangkat yang sudah di-pair
 * lewat Bluetooth Classic sebagai "virtual COM port" biasa - dan port itu BISA diakses via
 * Web Serial API dari Chrome/Edge desktop. Ini BUKAN Web Bluetooth (yang cuma bisa BLE) -
 * ini benar-benar transport berbeda, sesuai kebutuhan arsitektur PrinterAdapter yang diminta.
 *
 * CAKUPAN PLATFORM YANG JUJUR (WAJIB DIBACA):
 * - **Windows (Chrome/Edge desktop)**: BISA, dengan syarat. Pair printer dulu lewat Windows
 *   Settings > Bluetooth (PIN 0000), Windows akan membuatkan port COM virtual otomatis.
 *   ATAU sambungkan lewat kabel USB Type-C langsung (jika printer muncul sebagai perangkat
 *   serial/COM, bukan diklaim eksklusif oleh driver resmi vendor yang mungkin sudah terinstal -
 *   jika driver resmi terinstal, OS bisa mengklaim port itu duluan sehingga Web Serial tidak
 *   bisa memakainya bersamaan; dalam kasus itu gunakan "Cetak via Browser" yang justru
 *   memanfaatkan driver tsb).
 * - **macOS/Linux/ChromeOS (Chrome/Edge desktop)**: secara teknis Web Serial API tersedia,
 *   TAPI belum diuji ke printer ini - perlakukan sebagai "coba dulu, tidak dijamin".
 * - **Android**: Web Serial API di Chrome Android HANYA untuk perangkat USB (lewat kabel/OTG),
 *   TIDAK BISA mengakses pairing Bluetooth Classic seperti di Windows. Jadi di Android, adapter
 *   ini HANYA mungkin berfungsi jika printer disambung via kabel USB Type-C ke HP (perlu
 *   adaptor OTG jika HP tidak punya port USB-C), BUKAN lewat Bluetooth sama sekali.
 * - **iOS/Safari**: TIDAK TERSEDIA SAMA SEKALI. WebKit tidak mengimplementasikan Web Serial API,
 *   sama seperti Web Bluetooth. Di iOS, satu-satunya jalur yang mungkin berfungsi adalah
 *   "Cetak via Browser" (browserAdapter.js), itu pun tergantung dukungan AirPrint printer ini
 *   (belum dipastikan dari spesifikasi manual).
 *
 * TIDAK ADA bridge/aplikasi native Android di project ini. Jika suatu saat toko punya aplikasi
 * Android native (di luar TOKOQIA, dikembangkan terpisah) yang menjembatani ke Bluetooth Classic
 * SPP, adapter TERPISAH akan dibutuhkan untuk itu - BUKAN bagian dari file ini. File ini HANYA
 * mencakup apa yang benar-benar bisa dilakukan browser lewat Web Serial API asli, tanpa
 * berpura-pura ada koneksi yang sebenarnya tidak ada.
 */
window.PrinterSerialAdapter = (function () {
  var CONNECT_TIMEOUT_MS = 15000;
  var cachedPort = null;

  function isAvailable() {
    return !!(navigator.serial && navigator.serial.requestPort);
  }

  function withTimeout(promise, ms, timeoutMessage) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(timeoutMessage)); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function connect() {
    if (!isAvailable()) {
      return Promise.reject(new Error('Web Serial tidak tersedia di browser/perangkat ini. Fitur ini hanya berfungsi di Chrome/Edge versi desktop (Windows/macOS/Linux/ChromeOS), atau Android khusus untuk printer yang disambung kabel USB. Gunakan Cetak via Browser sebagai gantinya.'));
    }
    // Kalau port dari koneksi SEBELUMNYA masih terbuka (mis. Test Print lalu lanjut cetak
    // struk), PAKAI ULANG langsung - jangan panggil .open() lagi di port yang sama, itu
    // penyebab error "The port is already open."
    if (cachedPort && cachedPort.readable) {
      return Promise.resolve(cachedPort);
    }
    return withTimeout(
      navigator.serial.requestPort({}).then(function (port) {
        if (port.readable) { cachedPort = port; return port; } // sudah terbuka dari sesi lain
        return port.open({ baudRate: 9600 }).then(function () { cachedPort = port; return port; });
      }),
      CONNECT_TIMEOUT_MS,
      'Printer tidak ditemukan atau waktu koneksi habis. Pastikan printer RPP02N sudah di-pair lewat Bluetooth Windows (PIN 0000) sehingga muncul sebagai port COM, atau tersambung via kabel USB Type-C, lalu coba lagi.'
    ).catch(function (err) {
      if (err && err.name === 'NotFoundError') {
        throw new Error('Tidak ada port dipilih. Pastikan printer sudah di-pair (Windows Bluetooth Settings, PIN 0000) atau tersambung via USB sebelum mencoba lagi.');
      }
      if (err && /already open/i.test(err.message || '')) {
        // Port ternyata sudah terbuka (race dengan percobaan sebelumnya) - anggap sudah siap pakai.
        if (cachedPort) return cachedPort;
      }
      throw err;
    });
  }

  function writeBytes(port, bytes) {
    var writer = port.writable.getWriter();
    return writer.write(bytes).then(function () {
      writer.releaseLock();
    }).catch(function (err) {
      try { writer.releaseLock(); } catch (e) {}
      if (port === cachedPort) cachedPort = null; // port kemungkinan sudah putus - jangan dipakai ulang
      throw err;
    });
  }

  function disconnect() {
    if (!cachedPort) return Promise.resolve();
    var p = cachedPort; cachedPort = null;
    return p.close().catch(function () {});
  }

  function print(receiptData) {
    return window.ReceiptBuilder.buildEscPosBytes(receiptData).then(function (bytes) {
      return connect().then(function (port) { return writeBytes(port, bytes); });
    });
  }

  function testPrint() {
    return window.ReceiptBuilder.buildTestPrintBytes().then(function (bytes) {
      return connect().then(function (port) { return writeBytes(port, bytes); });
    });
  }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildTextLines(receiptData).join('\n');
  }

  return {
    name: 'serial-com', isAvailable: isAvailable, print: print, testPrint: testPrint,
    preview: preview, disconnect: disconnect
  };
})();
