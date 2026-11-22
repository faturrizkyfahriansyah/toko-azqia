/**
 * js/printer/printerInterface.js
 * PrinterManager: satu titik pemanggilan cetak untuk seluruh aplikasi (Kasir, Riwayat
 * Transaksi/reprint, Test Print di Pengaturan). Mendaftarkan 4 adapter transport:
 *   1. 'serial'      - Web Serial (serialAdapter.js) - Windows COM (Bluetooth-paired/USB), ESC/POS asli
 *   2. 'thermal'     - Web Bluetooth BLE (thermalAdapter.js) - hanya printer BLE asli, ESC/POS asli
 *   3. 'localBridge' - TOKOQIA Local Print Bridge (localBridgeAdapter.js) - script Node.js lokal,
 *                       ESC/POS asli, jalur untuk Bluetooth Classic/SPP yang tak terjangkau browser
 *   4. 'browser'     - dialog print OS (browserAdapter.js) - universal, semua platform, fallback akhir
 *
 * MODE 'auto' (DEFAULT): PrinterManager mendeteksi capability browser secara runtime saat tombol
 * cetak ditekan, dan memilih metode TERBAIK yang tersedia - bukan langsung ke Browser Print/A4.
 * Prioritas: Serial (hanya bila port sudah dihubungkan) > Local Bridge (bila aktif) > Browser Print
 * (fallback jujur, bukan diam-diam). Web Bluetooth BLE tidak ikut mode otomatis. Pengguna tetap bisa memaksa satu metode tertentu lewat Pengaturan -> Printer.
 *
 * TIDAK PERNAH melaporkan "berhasil terhubung/tercetak" jika sebenarnya gagal - setiap error
 * dari adapter diteruskan apa adanya ke pemanggil. Transaksi TIDAK PERNAH gagal karena printer -
 * lihat printWithUI() yang menyediakan tombol "Coba Lagi"/"Nanti" tanpa mengulang transaksi.
 */
window.PrinterManager = (function () {
  var PREF_KEY = 'azqia_printer_pref';
  var jobCounter = 0;
  var jobHistory = [];

  function getPreferredAdapterName() {
    return localStorage.getItem(PREF_KEY) || 'auto';
  }
  function setPreferredAdapterName(name) {
    localStorage.setItem(PREF_KEY, name);
  }

  /** Di dalam aplikasi TOKOQIA (APK/iPhone) cetak selalu langsung lewat Bluetooth aplikasi - tanpa dialog browser. */
  function inApp() { return !!(window.PrinterNativeAdapter && window.PrinterNativeAdapter.isAvailable()); }

  function adapterFor(id) {
    if (id === 'native') return window.PrinterNativeAdapter;
    if (id === 'serial') return window.PrinterSerialAdapter;
    if (id === 'thermal') return window.PrinterThermalAdapter;
    if (id === 'localBridge') return window.PrinterLocalBridgeAdapter;
    return window.PrinterBrowserAdapter;
  }

  /** Deteksi capability browser/perangkat saat ini secara runtime (bukan asumsi/tebakan). */
  function detectCapabilities() {
    return window.PrinterLocalBridgeAdapter.checkAvailability().then(function (bridgeUp) {
      return {
        nativeApp: inApp(),
        webBluetooth: window.PrinterThermalAdapter.isAvailable(),
        webUSB: false, // belum diimplementasikan di TOKOQIA
        webSerial: window.PrinterSerialAdapter.isAvailable(),
        localBridge: bridgeUp,
        browserPrint: true
      };
    });
  }

  function availableAdapters() {
    return [
      { id: 'auto', label: 'Otomatis (disarankan)', available: true },
      { id: 'native', label: 'Aplikasi TOKOQIA - Bluetooth langsung', available: inApp() },
      { id: 'serial', label: 'Serial - Bluetooth SPP / USB (setelah Hubungkan Printer)', available: window.PrinterSerialAdapter.isAvailable() },
      { id: 'thermal', label: 'Printer Bluetooth BLE (Web Bluetooth)', available: window.PrinterThermalAdapter.isAvailable() },
      { id: 'localBridge', label: 'TOKOQIA Local Print Bridge', available: window.PrinterLocalBridgeAdapter.isAvailable() },
      { id: 'browser', label: 'Cetak via Browser (semua perangkat)', available: true }
    ];
  }

  /**
   * Mode 'auto': pilih metode terbaik yang benar-benar SIAP saat ini, TANPA memunculkan dialog:
   *   1. Serial (Bluetooth SPP / USB) - hanya kalau sudah ada port yang diizinkan (Pengaturan -> Hubungkan Printer)
   *   2. Local Bridge - hanya kalau bridge sedang aktif
   *   3. Cetak via Browser - jalur terakhir
   * Web Bluetooth (BLE) SENGAJA tidak ikut mode otomatis: RPP02N adalah Bluetooth Classic/SPP,
   * dan jalur BLE memunculkan dialog pemilih perangkat setiap cetak tanpa pernah cocok.
   * Tetap bisa dipilih manual di Pengaturan bila suatu saat memakai printer BLE asli.
   */
  function resolveAdapterId() {
    var pref = getPreferredAdapterName();
    if (inApp()) return Promise.resolve('native'); // di dalam aplikasi: tidak ada jalur browser/serial
    if (pref === 'native') pref = 'auto'; // preferensi 'native' tersisa dari aplikasi, tetapi ini browser biasa
    if (pref !== 'auto') return Promise.resolve(pref);
    return window.PrinterSerialAdapter.hasGrantedPort().then(function (has) {
      if (has) return 'serial';
      return window.PrinterLocalBridgeAdapter.checkAvailability().then(function (up) {
        return up ? 'localBridge' : 'browser';
      });
    });
  }

  function trackJob(adapterId, action) {
    jobCounter++;
    var job = { jobId: 'JOB-' + Date.now() + '-' + jobCounter, adapterId: adapterId, action: action, status: 'CONNECTING', createdAt: new Date().toISOString() };
    jobHistory.unshift(job);
    if (jobHistory.length > 20) jobHistory.pop();
    return job;
  }
  function getJobHistory() { return jobHistory.slice(); }

  function runWithFallback(action) {
    var args = Array.prototype.slice.call(arguments, 1);
    // Buka jendela print KOSONG SEKARANG JUGA (synchronous, dalam call stack klik tombol yang
    // sama) - HANYA untuk action print/testPrint. Ini mencegah "Popup diblokir" yang terjadi
    // kalau window.open() baru dipanggil NANTI setelah percobaan Serial/Bluetooth gagal
    // (proses async membuat browser tidak lagi menganggapnya aksi langsung dari klik).
    // Kalau ternyata metode lain (bukan Browser Print) berhasil, jendela ini ditutup lagi.
    var preOpenedWin = ((action === 'print' || action === 'testPrint') && !inApp()) ? window.PrinterBrowserAdapter.openBlankWindow() : null;

    return resolveAdapterId().then(function (id) {
      var job = trackJob(id, action);
      if (id === 'native') {
        // Aplikasi: TIDAK ada pengalihan ke browser. Galat diteruskan agar UI menampilkan "Coba Lagi" (transaksi tidak diulang).
        job.status = 'PRINTING';
        return window.PrinterNativeAdapter[action].apply(null, args).then(function (r) { job.status = 'SENT'; return r; })
          .catch(function (err) { job.status = 'FAILED'; job.error = err.message; throw err; });
      }
      if (id === 'browser') {
        job.status = 'PRINTING';
        return window.PrinterBrowserAdapter[action].apply(null, args.concat([preOpenedWin])).then(function (r) { job.status = 'SUCCESS'; return r; });
      }
      var adapter = adapterFor(id);
      job.status = 'PRINTING';
      return adapter[action].apply(null, args).then(function (r) {
        job.status = 'SUCCESS';
        if (preOpenedWin && !preOpenedWin.closed) preOpenedWin.close(); // berhasil lewat non-browser - jendela cadangan tidak dipakai
        return r;
      }).catch(function (err) {
        job.status = 'FAILED'; job.error = err.message;
        Utils.toast('Cetak via ' + id + ' gagal (' + err.message + '), beralih ke Cetak via Browser.', 'error');
        var job2 = trackJob('browser', action);
        return window.PrinterBrowserAdapter[action].apply(null, args.concat([preOpenedWin])).then(function (r) { job2.status = 'SUCCESS'; return r; });
      });
    });
  }

  /** Cetak otomatis setelah bayar: bawaan AKTIF di aplikasi (printer sudah dipilih), MATI di browser (dialog cetak mengganggu). */
  var AUTO_KEY = 'azqia_autoprint';
  function getAutoPrint() {
    var v = localStorage.getItem(AUTO_KEY);
    if (v === '1') return true; if (v === '0') return false;
    return inApp();
  }
  function setAutoPrint(on) { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); }
  function shouldAutoPrint() {
    if (!getAutoPrint()) return false;
    if (inApp()) return !!window.PrinterNativeAdapter.getSelection(); // di aplikasi hanya bila printer sudah dipilih
    return true;
  }

  function print(receiptData) { return runWithFallback('print', receiptData); }
  function testPrint() { return runWithFallback('testPrint'); }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildHtml(receiptData);
  }

  /**
   * Dipakai UI (Kasir/Riwayat Transaksi): mengelola state tombol cetak sendiri (loading/disabled),
   * dan kalau gagal menampilkan banner "Transaksi berhasil disimpan, tetapi struk belum tercetak"
   * dengan tombol Coba Lagi/Nanti - TIDAK PERNAH mengulang transaksi, hanya PrintJob baru.
   */
  function printWithUI(button, receiptData, action) {
    action = action || 'print';
    var originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-inline"></span> Mencetak...';
    return runWithFallback(action, receiptData).then(function () {
      button.disabled = false; button.innerHTML = originalHtml;
      Utils.toast(inApp() ? 'Struk terkirim ke printer. Periksa kertasnya.' : 'Struk berhasil dicetak.', 'success');
    }).catch(function (err) {
      button.disabled = false; button.innerHTML = originalHtml;
      showPrintFailureBanner(button, receiptData, action, err);
    });
  }

  function showPrintFailureBanner(button, receiptData, action, err) {
    // Sisipkan SETELAH baris tombol (bukan di dalam baris flex), supaya tombol tidak terjepit seperti di Riwayat.
    var host = (button.closest && button.closest('.field-row')) || button;
    var old = host.parentNode.querySelector('.print-fail-banner');
    if (old) old.remove();
    var banner = document.createElement('div');
    banner.className = 'card print-fail-banner';
    banner.style.marginTop = '8px'; banner.style.width = '100%'; banner.style.boxSizing = 'border-box';
    banner.innerHTML =
      '<div class="muted" style="color:var(--red);margin-bottom:8px;">Transaksi berhasil disimpan, tetapi struk belum tercetak (' + Utils.escapeHtml(err.message) + ').</div>' +
      '<div class="field-row"><button class="btn btn-primary btn-sm" id="__pf_retry">Coba Lagi</button><button class="btn btn-outline btn-sm" id="__pf_later">Nanti</button></div>';
    host.parentNode.insertBefore(banner, host.nextSibling);
    banner.querySelector('#__pf_retry').addEventListener('click', function () {
      banner.remove();
      printWithUI(button, receiptData, action);
    });
    banner.querySelector('#__pf_later').addEventListener('click', function () { banner.remove(); });
  }

  /** Status koneksi apa adanya untuk ditampilkan di UI Pengaturan - TIDAK pernah "Connected" palsu. */
  function statusLabel(id) {
    if (id === 'native') return inApp() ? 'Aktif di aplikasi ini (Bluetooth langsung, tanpa dialog browser)' : 'Hanya ada di aplikasi TOKOQIA (APK/iPhone)';
    if (id === 'auto') return 'Serial jika printer sudah dihubungkan, lalu Local Bridge jika aktif, lalu Browser';
    if (id === 'browser') return 'Siap (selalu tersedia)';
    var a = adapterFor(id);
    return a.isAvailable() ? 'Tersedia di perangkat ini - status koneksi baru diketahui saat Test Print' : 'Tidak tersedia di browser/perangkat ini';
  }

  return {
    print: print, testPrint: testPrint, preview: preview, printWithUI: printWithUI,
    availableAdapters: availableAdapters, detectCapabilities: detectCapabilities,
    getPreferredAdapterName: getPreferredAdapterName, setPreferredAdapterName: setPreferredAdapterName,
    statusLabel: statusLabel, getJobHistory: getJobHistory,
    getAutoPrint: getAutoPrint, setAutoPrint: setAutoPrint, shouldAutoPrint: shouldAutoPrint
  };
})();
