/**
 * js/printer/browserAdapter.js
 * Fallback UNIVERSAL - berfungsi di semua browser/perangkat termasuk iOS/Safari (yang tidak
 * punya Web Bluetooth/Web Serial sama sekali). Membuka jendela cetak lalu window.print().
 *
 * PATCH: lebar konten diperbaiki dari 58mm (lebar KERTAS penuh) menjadi ~48mm (lebar cetak
 * EFEKTIF PUTIAN POS RPP02N) - sebelumnya konten bisa terpotong di kedua tepi karena
 * menganggap seluruh kertas sebagai area cetak. @page tetap 58mm (ukuran kertas fisik),
 * tapi konten di dalamnya sekarang dibatasi ke area yang benar-benar bisa dicetak.
 */
window.PrinterBrowserAdapter = (function () {
  var STYLE = (
    '<style>' +
    '@page { margin: 0; size: 58mm auto; }' +
    'html, body { margin:0; padding:0; }' +
    'body { display:flex; justify-content:center; font-family:"Courier New", monospace; font-size:11px; }' +
    '.receipt-58 { width:48mm; padding:0; box-sizing:border-box; }' +
    '.r-center { text-align:center; }' +
    '.r-bold { font-weight:700; }' +
    '.r-small { font-size:9px; }' +
    '.r-hr { border-top:1px dashed #000; margin:4px 0; }' +
    '.r-row { display:flex; justify-content:space-between; gap:4px; }' +
    '.r-item { margin-bottom:2px; word-break:break-word; }' +
    '@media print { .no-print { display:none !important; } }' +
    '</style>'
  );

  function isAvailable() { return true; } // selalu tersedia di semua browser modern

  function openPrintWindow(title, bodyHtml) {
    return new Promise(function (resolve, reject) {
      try {
        var win = window.open('', 'PRINT', 'height=600,width=400');
        if (!win) { reject(new Error('Popup diblokir browser. Izinkan popup untuk mencetak struk.')); return; }
        win.document.write('<html><head><title>' + title + '</title>' + STYLE + '</head><body>');
        win.document.write(bodyHtml);
        win.document.write('</body></html>');
        win.document.close();
        win.focus();
        setTimeout(function () { win.print(); resolve(true); }, 350);
      } catch (e) { reject(e); }
    });
  }

  function print(receiptData) {
    return openPrintWindow('Struk ' + receiptData.sale_number, window.ReceiptBuilder.buildHtml(receiptData));
  }

  function testPrint() {
    var html = '<div class="receipt-58 r-center">' +
      '<div class="r-bold">TOKOQIA</div><div>TOKO AZQIA</div><div class="r-hr"></div>' +
      '<div>Printer Test</div><div class="r-hr"></div>' +
      '<div class="r-small">58mm / 48mm printable</div>' +
      '<div class="r-small">384 dots &middot; PC850 &middot; ESC/POS</div>' +
      '<div class="r-hr"></div>' +
      '<div style="text-align:left;">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>0123456789</div>' +
      '<div class="r-hr"></div>' +
      '<div>(Test Print via Browser tidak memakai command ESC/POS - hanya mengecek lebar & tampilan kertas. Untuk uji CODE128/QR asli, gunakan koneksi Serial/Bluetooth Thermal.)</div>' +
      '</div>';
    return openPrintWindow('Test Print', html);
  }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildHtml(receiptData);
  }

  return { name: 'browser', isAvailable: isAvailable, print: print, testPrint: testPrint, preview: preview };
})();
