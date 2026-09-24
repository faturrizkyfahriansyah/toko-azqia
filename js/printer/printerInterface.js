/**
 * js/printer/printerInterface.js
 * PrinterManager: satu titik pemanggilan cetak untuk seluruh aplikasi (Kasir, Riwayat
 * Transaksi/reprint, Test Print di Pengaturan). Mendaftarkan 3 adapter transport:
 *   1. 'serial'  - Web Serial (serialAdapter.js) - Windows COM (Bluetooth-paired/USB), ESC/POS asli
 *   2. 'thermal' - Web Bluetooth BLE (thermalAdapter.js) - hanya printer BLE asli, ESC/POS asli
 *   3. 'browser' - dialog print OS (browserAdapter.js) - universal, semua platform, fallback akhir
 * Prioritas dipilih pengguna lewat Pengaturan -> Printer. Jika metode pilihan gagal, JATUH KE
 * BROWSER PRINT secara otomatis (bukan diam saja) - kasir selalu punya jalur cetak yang jalan.
 * TIDAK PERNAH melaporkan "berhasil terhubung/tercetak" jika sebenarnya gagal - setiap error
 * dari adapter diteruskan apa adanya ke pemanggil.
 */
window.PrinterManager = (function () {
  var PREF_KEY = 'azqia_printer_pref';

  function getPreferredAdapterName() {
    return localStorage.getItem(PREF_KEY) || 'browser';
  }
  function setPreferredAdapterName(name) {
    localStorage.setItem(PREF_KEY, name);
  }

  function adapterFor(id) {
    if (id === 'serial') return window.PrinterSerialAdapter;
    if (id === 'thermal') return window.PrinterThermalAdapter;
    return window.PrinterBrowserAdapter;
  }

  function availableAdapters() {
    return [
      { id: 'serial', label: 'Windows - Bluetooth COM / USB (Serial)', available: window.PrinterSerialAdapter.isAvailable() },
      { id: 'thermal', label: 'Printer Bluetooth BLE (Web Bluetooth)', available: window.PrinterThermalAdapter.isAvailable() },
      { id: 'browser', label: 'Cetak via Browser (semua perangkat)', available: true }
    ];
  }

  function runWithFallback(action) {
    var args = Array.prototype.slice.call(arguments, 1);
    var pref = getPreferredAdapterName();
    var adapter = adapterFor(pref);
    if (pref === 'browser' || !adapter.isAvailable()) {
      return window.PrinterBrowserAdapter[action].apply(null, args);
    }
    return adapter[action].apply(null, args).catch(function (err) {
      Utils.toast('Cetak via ' + pref + ' gagal (' + err.message + '), beralih ke Cetak via Browser.', 'error');
      return window.PrinterBrowserAdapter[action].apply(null, args);
    });
  }

  function print(receiptData) { return runWithFallback('print', receiptData); }
  function testPrint() { return runWithFallback('testPrint'); }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildHtml(receiptData);
  }

  /** Status koneksi apa adanya untuk ditampilkan di UI Pengaturan - TIDAK pernah "Connected" palsu. */
  function statusLabel(id) {
    var a = adapterFor(id);
    if (id === 'browser') return 'Siap (selalu tersedia)';
    return a.isAvailable() ? 'Tersedia di perangkat ini - status koneksi baru diketahui saat Test Print' : 'Tidak tersedia di browser/perangkat ini';
  }

  return {
    print: print, testPrint: testPrint, preview: preview, availableAdapters: availableAdapters,
    getPreferredAdapterName: getPreferredAdapterName, setPreferredAdapterName: setPreferredAdapterName,
    statusLabel: statusLabel
  };
})();
