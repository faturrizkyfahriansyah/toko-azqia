/**
 * js/printer/browserAdapter.js
 * Fallback UNIVERSAL - berfungsi di semua browser/perangkat termasuk iOS/Safari (yang tidak
 * punya Web Bluetooth sama sekali). Membuka jendela cetak terformat lebar 58mm lalu window.print().
 */
window.PrinterBrowserAdapter = (function () {
  var STYLE = (
    '<style>' +
    '@page { margin: 0; size: 58mm auto; }' +
    'body { margin:0; padding:6px; font-family: "Courier New", monospace; font-size:12px; width:58mm; }' +
    '.receipt-58 { width:100%; }' +
    '.r-center { text-align:center; }' +
    '.r-bold { font-weight:700; }' +
    '.r-small { font-size:10px; }' +
    '.r-hr { border-top:1px dashed #000; margin:4px 0; }' +
    '.r-row { display:flex; justify-content:space-between; }' +
    '.r-item { margin-bottom:2px; }' +
    '</style>'
  );

  function isAvailable() { return true; } // selalu tersedia di semua browser modern

  function print(receiptData) {
    return new Promise(function (resolve, reject) {
      try {
        var win = window.open('', 'PRINT', 'height=600,width=400');
        if (!win) { reject(new Error('Popup diblokir browser. Izinkan popup untuk mencetak struk.')); return; }
        win.document.write('<html><head><title>Struk ' + receiptData.sale_number + '</title>' + STYLE + '</head><body>');
        win.document.write(window.ReceiptBuilder.buildHtml(receiptData));
        win.document.write('</body></html>');
        win.document.close();
        win.focus();
        setTimeout(function () { win.print(); resolve(true); }, 350);
      } catch (e) { reject(e); }
    });
  }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildHtml(receiptData);
  }

  return { name: 'browser', isAvailable: isAvailable, print: print, preview: preview };
})();
