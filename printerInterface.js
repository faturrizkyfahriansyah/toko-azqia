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
 * Prioritas: Web Serial > Web Bluetooth(BLE) > Local Bridge > Browser Print (fallback jujur,
 * bukan diam-diam). Pengguna tetap bisa memaksa satu metode tertentu lewat Pengaturan -> Printer.
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

  function adapterFor(id) {
    if (id === 'serial') return window.PrinterSerialAdapter;
    if (id === 'thermal') return window.PrinterThermalAdapter;
    if (id === 'localBridge') return window.PrinterLocalBridgeAdapter;
    return window.PrinterBrowserAdapter;
  }

  /** Deteksi capability browser/perangkat saat ini secara runtime (bukan asumsi/tebakan). */
  function detectCapabilities() {
    return window.PrinterLocalBridgeAdapter.checkAvailability().then(function (bridgeUp) {
      return {
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
      { id: 'serial', label: 'Windows - Bluetooth COM / USB (Serial)', available: window.PrinterSerialAdapter.isAvailable() },
      { id: 'thermal', label: 'Printer Bluetooth BLE (Web Bluetooth)', available: window.PrinterThermalAdapter.isAvailable() },
      { id: 'localBridge', label: 'TOKOQIA Local Print Bridge', available: window.PrinterLocalBridgeAdapter.isAvailable() },
      { id: 'browser', label: 'Cetak via Browser (semua perangkat)', available: true }
    ];
  }

  /** Mode 'auto': pilih metode terbaik yang TERSEDIA saat ini (bukan asumsi statis). */
  function resolveAdapterId() {
    var pref = getPreferredAdapterName();
    if (pref !== 'auto') return Promise.resolve(pref);
    if (window.PrinterSerialAdapter.isAvailable()) return Promise.resolve('serial');
    if (window.PrinterThermalAdapter.isAvailable()) return Promise.resolve('thermal');
    return window.PrinterLocalBridgeAdapter.checkAvailability().then(function (up) {
      return up ? 'localBridge' : 'browser';
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
    return resolveAdapterId().then(function (id) {
      var job = trackJob(id, action);
      if (id === 'browser') {
        job.status = 'PRINTING';
        return window.PrinterBrowserAdapter[action].apply(null, args).then(function (r) { job.status = 'SUCCESS'; return r; });
      }
      var adapter = adapterFor(id);
      job.status = 'PRINTING';
      return adapter[action].apply(null, args).then(function (r) { job.status = 'SUCCESS'; return r; }).catch(function (err) {
        job.status = 'FAILED'; job.error = err.message;
        Utils.toast('Cetak via ' + id + ' gagal (' + err.message + '), beralih ke Cetak via Browser.', 'error');
        var job2 = trackJob('browser', action);
        return window.PrinterBrowserAdapter[action].apply(null, args).then(function (r) { job2.status = 'SUCCESS'; return r; });
      });
    });
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
      Utils.toast('Struk berhasil dicetak.', 'success');
    }).catch(function (err) {
      button.disabled = false; button.innerHTML = originalHtml;
      showPrintFailureBanner(button, receiptData, action, err);
    });
  }

  function showPrintFailureBanner(button, receiptData, action, err) {
    var old = button.parentNode.querySelector('.print-fail-banner');
    if (old) old.remove();
    var banner = document.createElement('div');
    banner.className = 'card print-fail-banner';
    banner.style.marginTop = '8px';
    banner.innerHTML =
      '<div class="muted" style="color:var(--red);margin-bottom:8px;">Transaksi berhasil disimpan, tetapi struk belum tercetak (' + Utils.escapeHtml(err.message) + ').</div>' +
      '<div class="field-row"><button class="btn btn-primary btn-sm" id="__pf_retry">Coba Lagi</button><button class="btn btn-outline btn-sm" id="__pf_later">Nanti</button></div>';
    button.parentNode.insertBefore(banner, button.nextSibling);
    banner.querySelector('#__pf_retry').addEventListener('click', function () {
      banner.remove();
      printWithUI(button, receiptData, action);
    });
    banner.querySelector('#__pf_later').addEventListener('click', function () { banner.remove(); });
  }

  /** Status koneksi apa adanya untuk ditampilkan di UI Pengaturan - TIDAK pernah "Connected" palsu. */
  function statusLabel(id) {
    if (id === 'auto') return 'Sistem memilih metode terbaik otomatis setiap kali cetak';
    if (id === 'browser') return 'Siap (selalu tersedia)';
    var a = adapterFor(id);
    return a.isAvailable() ? 'Tersedia di perangkat ini - status koneksi baru diketahui saat Test Print' : 'Tidak tersedia di browser/perangkat ini';
  }

  return {
    print: print, testPrint: testPrint, preview: preview, printWithUI: printWithUI,
    availableAdapters: availableAdapters, detectCapabilities: detectCapabilities,
    getPreferredAdapterName: getPreferredAdapterName, setPreferredAdapterName: setPreferredAdapterName,
    statusLabel: statusLabel, getJobHistory: getJobHistory
  };
})();
