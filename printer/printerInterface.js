/**
 * js/printer/printerInterface.js
 * PrinterManager: mencoba thermal Bluetooth dulu (jika tersedia & dipilih user), lalu jatuh
 * ke browser print jika gagal/tidak tersedia. Kasir selalu punya jalur cetak yang berfungsi.
 */
window.PrinterManager = (function () {
  var PREF_KEY = 'azkia_printer_pref';

  function getPreferredAdapterName() {
    return localStorage.getItem(PREF_KEY) || 'browser';
  }
  function setPreferredAdapterName(name) {
    localStorage.setItem(PREF_KEY, name);
  }

  function availableAdapters() {
    var list = [{ id: 'browser', label: 'Cetak via Browser (semua perangkat)', available: true }];
    list.push({
      id: 'thermal', label: 'Printer Thermal Bluetooth (58mm)',
      available: window.PrinterThermalAdapter.isAvailable()
    });
    return list;
  }

  function print(receiptData) {
    var pref = getPreferredAdapterName();
    if (pref === 'thermal' && window.PrinterThermalAdapter.isAvailable()) {
      return window.PrinterThermalAdapter.print(receiptData).catch(function (err) {
        Utils.toast('Cetak thermal gagal (' + err.message + '), beralih ke cetak browser.', 'error');
        return window.PrinterBrowserAdapter.print(receiptData);
      });
    }
    return window.PrinterBrowserAdapter.print(receiptData);
  }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildHtml(receiptData);
  }

  return {
    print: print, preview: preview, availableAdapters: availableAdapters,
    getPreferredAdapterName: getPreferredAdapterName, setPreferredAdapterName: setPreferredAdapterName
  };
})();
