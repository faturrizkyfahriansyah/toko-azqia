/**
 * js/printer/browserAdapter.js
 * Fallback UNIVERSAL - berfungsi di semua browser/perangkat termasuk iOS/Safari (yang tidak
 * punya Web Bluetooth/Web Serial sama sekali). Membuka jendela cetak lalu window.print().
 *
 * LEBAR KERTAS BISA DIPILIH (58mm atau 80mm) - PENTING: jalur ini ("Cetak via Browser") bisa
 * dipakai ke printer FISIK APA PUN yang terdaftar di OS/browser, bukan cuma printer referensi
 * 58mm (BT-583/RPP02N) yang dipakai jalur ESC/POS langsung. Kalau printer sungguhan di komputer
 * ini pakai kertas 80mm tapi CSS dipaksa 58mm, driver bisa menskalakan/menabrakkan teks - itu
 * sebabnya lebar ini WAJIB bisa disesuaikan, bukan di-hardcode satu ukuran untuk semua orang.
 * Diatur lewat Pengaturan -> Printer -> "Lebar Kertas (Cetak via Browser)".
 */
window.PrinterBrowserAdapter = (function () {
  var PAPER_KEY = 'azqia_receipt_paper_mm';
  // content width mengikuti rekomendasi "area efektif" tiap ukuran kertas (bukan lebar penuh,
  // supaya ada margin aman kiri-kanan): 58mm kertas -> 48mm efektif; 80mm kertas -> 74mm efektif.
  var PAPER_PRESETS = {
    '58': { page: '58mm', content: '48mm' },
    '80': { page: '80mm', content: '74mm' }
  };

  function getPaperWidth() { return localStorage.getItem(PAPER_KEY) || '58'; }
  function setPaperWidth(mm) { localStorage.setItem(PAPER_KEY, String(mm)); }

  function styleFor(mm) {
    var preset = PAPER_PRESETS[mm] || PAPER_PRESETS['58'];
    return (
      '<style>' +
      '@page { margin: 0; size: ' + preset.page + ' auto; }' +
      'html, body { margin:0; padding:0; }' +
      'body { display:flex; justify-content:center; font-family:"Courier New", monospace; font-size:10px; color:#000; }' +
      '.receipt { width:' + preset.content + '; max-width:' + preset.content + '; padding:0; box-sizing:border-box; }' +
      '.r-logo { display:block; margin:0 auto 6px; max-width:60%; height:auto; object-fit:contain; }' +
      '.r-store-name { font-size:15px; font-weight:700; }' +
      '.r-center { text-align:center; }' +
      '.r-bold { font-weight:700; }' +
      '.r-small { font-size:9px; }' +
      '.r-hr { border-top:1px dashed #000; margin:5px 0; }' +
      '.r-info { display:flex; gap:6px; }' +
      '.r-info .lbl { flex-shrink:0; width:52px; }' +
      '.r-info .val { flex:1; word-break:break-word; }' +
      '.r-item { margin-bottom:4px; word-break:break-word; }' +
      '.r-row { display:flex; justify-content:space-between; gap:6px; }' +
      '.r-row .amt { flex-shrink:0; text-align:right; }' +
      '.r-total { font-size:12px; }' +
      '.r-footer { margin-top:8px; padding-bottom:6px; }' +
      '@media print { .no-print { display:none !important; } }' +
      '</style>'
    );
  }

  function isAvailable() { return true; } // selalu tersedia di semua browser modern

  /**
   * Buka jendela kosong SEKARANG JUGA (synchronous) - dipanggil oleh printerInterface.js
   * TEPAT saat tombol diklik, SEBELUM ada proses async apa pun (coba Serial/Bluetooth dulu,
   * dsb.). Ini WAJIB supaya browser (terutama Chrome Android) tetap menganggap window.open()
   * sebagai aksi langsung dari pengguna - kalau window.open() dipanggil SETELAH await/Promise
   * lain (mis. sesudah percobaan Serial gagal), browser sering MEMBLOKIRNYA sebagai popup,
   * walau sebenarnya berasal dari klik pengguna yang sah. Mengembalikan null kalau tetap
   * diblokir (jarang, tapi tetap ditangani).
   */
  function openBlankWindow() {
    try { return window.open('', 'PRINT', 'height=600,width=400'); } catch (e) { return null; }
  }

  function openPrintWindow(title, bodyHtml, preOpenedWin) {
    return new Promise(function (resolve, reject) {
      try {
        var win = preOpenedWin || openBlankWindow();
        if (!win) { reject(new Error('Popup diblokir browser. Izinkan popup untuk mencetak struk.')); return; }
        win.document.write('<html><head><title>' + title + '</title>' + styleFor(getPaperWidth()) + '</head><body>');
        win.document.write(bodyHtml);
        win.document.write('</body></html>');
        win.document.close();
        win.focus();
        setTimeout(function () { win.print(); resolve(true); }, 350);
      } catch (e) { reject(e); }
    });
  }

  function print(receiptData, preOpenedWin) {
    return openPrintWindow('Struk ' + receiptData.sale_number, window.ReceiptBuilder.buildHtml(receiptData), preOpenedWin);
  }

  function testPrint(preOpenedWin) {
    var mm = getPaperWidth();
    var html = '<div class="receipt r-center">' +
      '<img class="r-logo" src="assets/icons/tokoqia-receipt-icon-black.png" alt="">' +
      '<div class="r-store-name">TOKOQIA</div><div>TOKO AZQIA</div><div class="r-hr"></div>' +
      '<div>Printer Test</div><div class="r-hr"></div>' +
      '<div class="r-small">Kertas ' + mm + 'mm / area efektif ' + PAPER_PRESETS[mm].content + '</div>' +
      '<div class="r-small">ESC/POS &middot; PC850 &middot; 203dpi</div>' +
      '<div class="r-hr"></div>' +
      '<div style="text-align:left;">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>0123456789</div>' +
      '<div class="r-hr"></div>' +
      '<div class="r-small">(Test Print via Browser tidak memakai command ESC/POS - hanya mengecek lebar &amp; tampilan kertas.)</div>' +
      '</div>';
    return openPrintWindow('Test Print', html, preOpenedWin);
  }

  function preview(receiptData) {
    return window.ReceiptBuilder.buildHtml(receiptData);
  }

  return {
    name: 'browser', isAvailable: isAvailable, print: print, testPrint: testPrint, preview: preview,
    getPaperWidth: getPaperWidth, setPaperWidth: setPaperWidth, openBlankWindow: openBlankWindow
  };
})();
