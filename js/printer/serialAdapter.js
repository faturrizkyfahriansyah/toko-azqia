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
 *
 * REVISI (audit final): pairing dan cetak DIPISAH.
 * - pair('bluetooth' | 'usb') = satu-satunya yang memunculkan dialog pemilih port; dipanggil
 *   HANYA dari tombol di Pengaturan -> Printer (butuh klik langsung dari pengguna).
 * - print/testPrint memakai port yang SUDAH diizinkan (navigator.serial.getPorts()), tanpa
 *   dialog. Kalau belum ada port yang diizinkan, gagal dengan pesan jelas (tidak memunculkan
 *   dialog di tengah proses cetak).
 * - Bluetooth Classic: requestPort memakai allowedBluetoothServiceClassIds + filter UUID SPP
 *   (fitur Web Serial-over-Bluetooth Chrome). Dukungan di Chrome Android BELUM TERVERIFIKASI -
 *   kalau dialog tetap kosong ("Tidak ada perangkat yang kompatibel"), jalur ini butuh lapisan
 *   native yang tidak ada di source ini.
 * - USB: pair('usb') tanpa filter Bluetooth. Hanya berhasil kalau printer tampil sebagai
 *   USB-serial (CDC). Kalau tampil sebagai USB printer-class, Web Serial tidak bisa
 *   mengaksesnya (butuh WebUSB, belum ada). BELUM TERVERIFIKASI ke RPP02N.
 */
window.PrinterSerialAdapter = (function () {
  var CONNECT_TIMEOUT_MS = 15000;
  var WRITE_TIMEOUT_MS = 15000;
  var SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb'; // Serial Port Profile (Bluetooth Classic)
  var BAUD_KEY = 'azqia_serial_baud';
  var cachedPort = null;

  function isAvailable() {
    return !!(navigator.serial && navigator.serial.requestPort);
  }
  function baudRate() { return Number(localStorage.getItem(BAUD_KEY)) || 9600; }

  function withTimeout(promise, ms, timeoutMessage) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(timeoutMessage)); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  // Port putus (printer dimatikan / kabel dicabut) -> buang referensi supaya cetak berikutnya
  // tidak memakai port mati (status DISCONNECTED).
  if (navigator.serial && navigator.serial.addEventListener) {
    navigator.serial.addEventListener('disconnect', function (e) {
      if (cachedPort && (!e.target || e.target === cachedPort)) cachedPort = null;
    });
  }

  /** Ada port yang sudah pernah diizinkan pengguna (tanpa memunculkan dialog)? */
  function hasGrantedPort() {
    if (!isAvailable() || !navigator.serial.getPorts) return Promise.resolve(false);
    return navigator.serial.getPorts().then(function (ports) { return ports.length > 0; }).catch(function () { return false; });
  }
  function isConnected() { return !!(cachedPort && cachedPort.readable); }

  function openPort(port) {
    if (port.readable) { cachedPort = port; return Promise.resolve(port); } // sudah terbuka
    return port.open({ baudRate: baudRate() }).then(function () {
      cachedPort = port; return port;
    }).catch(function (err) {
      if (err && (err.name === 'InvalidStateError' || /already open/i.test(err.message || ''))) { cachedPort = port; return port; }
      cachedPort = null;
      throw err;
    });
  }

  /**
   * Memunculkan dialog pemilih port (HARUS dipanggil langsung dari klik pengguna) lalu membukanya.
   * kind: 'bluetooth' (filter SPP) atau 'usb' (tanpa filter Bluetooth).
   */
  function pair(kind) {
    if (!isAvailable()) {
      return Promise.reject(new Error('Web Serial tidak tersedia di browser/perangkat ini. Gunakan Cetak via Browser.'));
    }
    var request;
    if (kind === 'bluetooth') {
      request = navigator.serial.requestPort({
        allowedBluetoothServiceClassIds: [SPP_UUID],
        filters: [{ bluetoothServiceClassId: SPP_UUID }]
      }).catch(function (err) {
        // Browser lama yang belum mengenal opsi Bluetooth -> coba tanpa opsi (perilaku sebelumnya).
        if (err && err.name === 'TypeError') return navigator.serial.requestPort({});
        throw err;
      });
    } else {
      request = navigator.serial.requestPort({});
    }
    return withTimeout(
      request.then(openPort),
      60000, // pengguna butuh waktu memilih di dialog
      'Waktu memilih printer habis. Coba klik tombol Hubungkan lagi.'
    ).catch(function (err) {
      if (err && err.name === 'NotFoundError') {
        throw new Error('Tidak ada printer dipilih. Pastikan printer menyala' + (kind === 'bluetooth' ? ' dan sudah di-pair di Bluetooth perangkat ini (PIN 0000).' : ' dan kabel USB tersambung.'));
      }
      throw err;
    });
  }

  /** Dipakai print/testPrint: pakai port terbuka, atau buka port yang sudah diizinkan. TANPA dialog. */
  function connect() {
    if (!isAvailable()) {
      return Promise.reject(new Error('Web Serial tidak tersedia di browser/perangkat ini. Gunakan Cetak via Browser.'));
    }
    if (isConnected()) return Promise.resolve(cachedPort);
    return withTimeout(
      navigator.serial.getPorts().then(function (ports) {
        if (!ports.length) throw new Error('Printer belum dihubungkan. Buka Pengaturan -> Printer -> Hubungkan Printer (Bluetooth/USB) terlebih dahulu.');
        return openPort(ports[0]);
      }),
      CONNECT_TIMEOUT_MS,
      'Waktu koneksi ke printer habis. Pastikan printer menyala dan dalam jangkauan, lalu coba lagi.'
    );
  }

  function writeBytes(port, bytes) {
    var writer = port.writable.getWriter();
    return withTimeout(
      writer.write(bytes).then(function () { return writer.ready; }),
      WRITE_TIMEOUT_MS,
      'Printer tidak merespons saat mengirim data. Periksa apakah printer menyala/tidak kehabisan kertas.'
    ).then(function () {
      writer.releaseLock();
    }).catch(function (err) {
      try { writer.releaseLock(); } catch (e) {}
      if (port === cachedPort) cachedPort = null; // kemungkinan putus - jangan dipakai ulang
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
    preview: preview, disconnect: disconnect, pair: pair,
    hasGrantedPort: hasGrantedPort, isConnected: isConnected
  };
})();
