/**
 * js/printer/receiptBuilder.js
 * Mengubah receiptData (dari backend 51_Printer.gs buildReceiptData) menjadi:
 *  - baris teks polos 32 kolom (kertas 58mm) untuk thermal
 *  - HTML untuk preview/fallback browser print
 * Format mengikuti Bagian 11 Master Specification PERSIS (header toko+alamat, No/Tanggal/Kasir,
 * item, TOTAL menonjol, blok pembayaran per metode termasuk Mixed, footer tanpa nama developer).
 * Tidak tahu apa pun soal printer fisik - itu tugas adapter (thermalAdapter.js / browserAdapter.js).
 */
window.ReceiptBuilder = (function () {
  var WIDTH = 32;

  function padCenter(text) {
    text = String(text);
    if (text.length >= WIDTH) return text.substring(0, WIDTH);
    var left = Math.floor((WIDTH - text.length) / 2);
    return ' '.repeat(left) + text;
  }
  function line(char) { return (char || '-').repeat(WIDTH); }
  function twoCol(left, right) {
    left = String(left); right = String(right);
    var space = WIDTH - left.length - right.length;
    if (space < 1) { left = left.substring(0, WIDTH - right.length - 1); space = 1; }
    return left + ' '.repeat(space) + right;
  }
  function wrap(text, width) {
    text = String(text);
    var out = [];
    while (text.length > width) {
      var cut = text.lastIndexOf(' ', width);
      if (cut <= 0) cut = width;
      out.push(text.substring(0, cut));
      text = text.substring(cut).replace(/^\s+/, '');
    }
    out.push(text);
    return out;
  }
  function rupiah(n) { return 'Rp' + Math.round(n).toLocaleString('id-ID'); }

  function paymentLines(data) {
    var L = [];
    if (data.payments.length > 1) {
      data.payments.forEach(function (pay) { L.push(twoCol(methodLabel(pay.method), rupiah(pay.amount))); });
      L.push(line('-'));
      L.push(twoCol('Status', data.status === 'VOID' ? 'DIBATALKAN' : 'LUNAS'));
      return L;
    }
    var pay = data.payments[0] || {};
    if (pay.method === 'CASH') {
      L.push(twoCol('Tunai', rupiah(pay.amount)));
      L.push(twoCol('Kembali', rupiah(pay.change || 0)));
    } else if (pay.method === 'HUTANG') {
      L.push(twoCol('Hutang', rupiah(pay.amount)));
      if (data.customer_name) L.push('Pelanggan: ' + data.customer_name);
      L.push(twoCol('Sisa Piutang', rupiah(pay.amount)));
    } else {
      L.push(twoCol(methodLabel(pay.method), rupiah(pay.amount)));
      L.push(twoCol('Status', pay.status === 'PENDING' ? 'MENUNGGU' : 'LUNAS'));
    }
    return L;
  }
  function methodLabel(method) {
    return { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', HUTANG: 'Hutang' }[method] || method;
  }

  function buildTextLines(data) {
    var L = [];
    L.push(padCenter(data.store_name));
    wrap(data.store_tagline, WIDTH).forEach(function (l) { L.push(padCenter(l)); });
    L.push('');
    if (data.store_address) wrap(data.store_address, WIDTH).forEach(function (l) { L.push(padCenter(l)); });
    L.push(line('-'));
    L.push('No. ' + data.sale_number);
    L.push(Utils.formatDate(data.date));
    if (data.cashier_name) L.push('Kasir: ' + data.cashier_name);
    L.push(line('-'));
    data.items.forEach(function (it) {
      wrap(it.name, WIDTH).forEach(function (l) { L.push(l); });
      L.push(twoCol(it.qty + ' ' + (it.unit || '') + ' x ' + rupiah(it.unit_price), rupiah(it.subtotal)));
    });
    L.push(line('-'));
    L.push(twoCol('Subtotal', rupiah(data.subtotal)));
    if (data.discount) L.push(twoCol('Diskon', '-' + rupiah(data.discount)));
    L.push(line('-'));
    L.push(twoCol('TOTAL', rupiah(data.total)));
    L.push(line('-'));
    paymentLines(data).forEach(function (l) { L.push(l); });
    L.push(line('-'));
    L.push('');
    L.push(padCenter(data.footer_line1));
    L.push(padCenter(data.footer_line2));
    L.push(padCenter(data.store_name));
    L.push('');
    L.push(padCenter(data.copyright));
    return L;
  }

  function buildHtml(data) {
    var itemsHtml = data.items.map(function (it) {
      return '<div class="r-item"><div>' + Utils.escapeHtml(it.name) + '</div>' +
        '<div class="r-row"><span>' + it.qty + ' ' + Utils.escapeHtml(it.unit || '') + ' x ' + Utils.formatCurrency(it.unit_price) + '</span><span>' + Utils.formatCurrency(it.subtotal) + '</span></div></div>';
    }).join('');
    var paymentHtml = data.payments.length > 1
      ? data.payments.map(function (pay) { return '<div class="r-row"><span>' + methodLabel(pay.method) + '</span><span>' + Utils.formatCurrency(pay.amount) + '</span></div>'; }).join('') +
        '<div class="r-row r-bold"><span>Status</span><span>LUNAS</span></div>'
      : (function () {
          var pay = data.payments[0] || {};
          if (pay.method === 'CASH') return '<div class="r-row"><span>Tunai</span><span>' + Utils.formatCurrency(pay.amount) + '</span></div><div class="r-row"><span>Kembali</span><span>' + Utils.formatCurrency(pay.change || 0) + '</span></div>';
          if (pay.method === 'HUTANG') return '<div class="r-row"><span>Hutang</span><span>' + Utils.formatCurrency(pay.amount) + '</span></div>' + (data.customer_name ? '<div>Pelanggan: ' + Utils.escapeHtml(data.customer_name) + '</div>' : '') + '<div class="r-row"><span>Sisa Piutang</span><span>' + Utils.formatCurrency(pay.amount) + '</span></div>';
          return '<div class="r-row"><span>' + methodLabel(pay.method) + '</span><span>' + Utils.formatCurrency(pay.amount) + '</span></div><div class="r-row"><span>Status</span><span>' + (pay.status === 'PENDING' ? 'MENUNGGU' : 'LUNAS') + '</span></div>';
        })();
    return (
      '<div class="receipt-58">' +
      '<div class="r-center r-bold">' + Utils.escapeHtml(data.store_name) + '</div>' +
      '<div class="r-center">' + Utils.escapeHtml(data.store_tagline) + '</div>' +
      (data.store_address ? '<div class="r-center r-small">' + Utils.escapeHtml(data.store_address) + '</div>' : '') +
      '<div class="r-hr"></div>' +
      '<div>No. ' + Utils.escapeHtml(data.sale_number) + '</div>' +
      '<div>' + Utils.formatDate(data.date) + '</div>' +
      (data.cashier_name ? '<div>Kasir: ' + Utils.escapeHtml(data.cashier_name) + '</div>' : '') +
      '<div class="r-hr"></div>' +
      itemsHtml +
      '<div class="r-hr"></div>' +
      '<div class="r-row"><span>Subtotal</span><span>' + Utils.formatCurrency(data.subtotal) + '</span></div>' +
      (data.discount ? '<div class="r-row"><span>Diskon</span><span>-' + Utils.formatCurrency(data.discount) + '</span></div>' : '') +
      '<div class="r-hr"></div>' +
      '<div class="r-row r-bold" style="font-size:1.1em;"><span>TOTAL</span><span>' + Utils.formatCurrency(data.total) + '</span></div>' +
      '<div class="r-hr"></div>' +
      paymentHtml +
      '<div class="r-hr"></div>' +
      '<div class="r-center">' + Utils.escapeHtml(data.footer_line1) + '</div>' +
      '<div class="r-center">' + Utils.escapeHtml(data.footer_line2) + '</div>' +
      '<div class="r-center r-bold">' + Utils.escapeHtml(data.store_name) + '</div>' +
      '<div class="r-center r-small" style="margin-top:6px;">' + Utils.escapeHtml(data.copyright) + '</div>' +
      '</div>'
    );
  }

  // ================================================================================
  // ESC/POS RAW BYTES (dipakai thermalAdapter.js / serialAdapter.js - transport nyata
  // ke printer, BUKAN dialog print browser). Target referensi: PUTIAN POS RPP02N,
  // firmware YC-6002, codepage default PC850, lebar cetak 384 dot (48mm @ 203dpi).
  //
  // PENTING - kejujuran command: ESC @ (init), ESC t 2 (pilih PC850), ESC a (align),
  // ESC E (bold), dan GS v 0 (raster bitmap) adalah command ESC/POS standar Epson yang
  // dipakai luas oleh printer kompatibel termasuk klon murah - risiko tidak-didukung
  // RENDAH. Command native barcode (GS k) dan QR (GS ( k) TIDAK dipakai di sini karena
  // sintaksnya berbeda-beda antar firmware dan BELUM terverifikasi ke YC-6002 - barcode/
  // QR karena itu dikirim sebagai BITMAP (GS v 0), bukan command native, sesuai fallback
  // yang diminta. TIDAK ADA command cutter (GS V) dikirim - printer ini tidak terkonfirmasi
  // punya auto-cutter; struk diakhiri feed kertas untuk dirobek manual.
  // ================================================================================
  var ESC_CODEPAGE_PC850 = [0x1B, 0x74, 0x02]; // ESC t 2 - umum untuk PC850 di printer kompatibel Epson, PERLU VERIFIKASI fisik ke RPP02N

  /** Normalisasi karakter yang TIDAK aman dikirim mentah ke codepage PC850 (mis. simbol Unicode/emoji). */
  function ascSafe(str) {
    if (str === null || str === undefined) return '';
    var map = { '\u00A9': '(c)', '\u2713': 'OK', '\u2192': '->', '\u2013': '-', '\u2014': '-', '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"' };
    str = String(str).replace(/[\u00A9\u2713\u2192\u2013\u2014\u2018\u2019\u201C\u201D]/g, function (c) { return map[c] || ''; });
    return str.replace(/[^\x20-\x7E]/g, ''); // buang sisa non-ASCII/emoji yang tidak dipetakan
  }

  function ByteBuf() {
    var arr = [];
    return {
      raw: function () { var a = Array.prototype.slice.call(arguments); arr = arr.concat(a); },
      text: function (s) { s = ascSafe(s); for (var i = 0; i < s.length; i++) arr.push(s.charCodeAt(i) & 0xFF); },
      bytes: function (u8) { for (var i = 0; i < u8.length; i++) arr.push(u8[i]); },
      toUint8Array: function () { return new Uint8Array(arr); }
    };
  }

  /**
   * Membangun struk transaksi sebagai RAW ESC/POS bytes dengan formatting sesungguhnya
   * (bold pada nama toko & TOTAL, rata tengah header/footer, tanpa command cutter).
   * Mengembalikan Promise<Uint8Array> (async karena logo perlu dimuat & dikonversi dulu).
   * includeLogo: default true - set false jika ingin lebih cepat/tanpa logo.
   */
  function buildEscPosBytes(data, includeLogo) {
    if (includeLogo === undefined) includeLogo = true;
    var buf = ByteBuf();
    function align(n) { buf.raw(0x1B, 0x61, n); }
    function bold(on) { buf.raw(0x1B, 0x45, on ? 1 : 0); }
    function feed(n) { for (var i = 0; i < n; i++) buf.text('\n'); }

    buf.raw(0x1B, 0x40); // ESC @ init
    buf.raw.apply(null, ESC_CODEPAGE_PC850);

    var logoPromise = includeLogo ? loadLogoRaster().catch(function () { return null; }) : Promise.resolve(null);

    return logoPromise.then(function (logoRaster) {
      align(1);
      if (logoRaster) buf.bytes(logoRaster);
      bold(true); buf.text(padCenter(data.store_name) + '\n'); bold(false);
      wrap(data.store_tagline, WIDTH).forEach(function (l) { buf.text(padCenter(l) + '\n'); });
      if (data.store_address) wrap(data.store_address, WIDTH).forEach(function (l) { buf.text(padCenter(l) + '\n'); });
      align(0);
      buf.text(line('-') + '\n');
      buf.text('No. ' + data.sale_number + '\n');
      buf.text(ascSafe(Utils.formatDate(data.date)) + '\n');
      if (data.cashier_name) buf.text('Kasir: ' + data.cashier_name + '\n');
      buf.text(line('-') + '\n');
      data.items.forEach(function (it) {
        wrap(it.name, WIDTH).forEach(function (l) { buf.text(l + '\n'); });
        buf.text(twoCol(it.qty + ' ' + (it.unit || '') + ' x ' + rupiah(it.unit_price), rupiah(it.subtotal)) + '\n');
      });
      buf.text(line('-') + '\n');
      buf.text(twoCol('Subtotal', rupiah(data.subtotal)) + '\n');
      if (data.discount) buf.text(twoCol('Diskon', '-' + rupiah(data.discount)) + '\n');
      buf.text(line('-') + '\n');
      bold(true); buf.text(twoCol('TOTAL', rupiah(data.total)) + '\n'); bold(false);
      buf.text(line('-') + '\n');
      paymentLines(data).forEach(function (l) { buf.text(l + '\n'); });
      buf.text(line('-') + '\n');
      align(1);
      feed(1);
      buf.text(padCenter(data.footer_line1) + '\n');
      buf.text(padCenter(data.footer_line2) + '\n');
      bold(true); buf.text(padCenter(data.store_name) + '\n'); bold(false);
      feed(1);
      buf.text(padCenter(data.copyright) + '\n');
      align(0);
      feed(4); // TIDAK ADA command cutter - feed untuk robek manual (lihat KNOWN_LIMITATIONS.md)
      return buf.toUint8Array();
    });
  }

  /**
   * Konversi <canvas> menjadi bytes raster ESC/POS (GS v 0), monokrom 1-bit, diresize agar
   * lebar tidak melebihi maxWidthDots (default 384 dot = lebar cetak RPP02N pada 203dpi/48mm).
   */
  function canvasToEscPosRaster(canvas, maxWidthDots) {
    maxWidthDots = maxWidthDots || 384;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    if (w > maxWidthDots) {
      var ratio = maxWidthDots / w;
      var newW = maxWidthDots, newH = Math.max(1, Math.round(h * ratio));
      var tmp = document.createElement('canvas');
      tmp.width = newW; tmp.height = newH;
      tmp.getContext('2d').drawImage(canvas, 0, 0, newW, newH);
      canvas = tmp; ctx = canvas.getContext('2d'); w = newW; h = newH;
    }
    var widthBytes = Math.ceil(w / 8);
    var img = ctx.getImageData(0, 0, w, h).data;
    var raster = new Uint8Array(widthBytes * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        var r = img[idx], g = img[idx + 1], b = img[idx + 2], a = img[idx + 3];
        var lum = r * 0.299 + g * 0.587 + b * 0.114;
        var dark = a > 40 && lum < 150;
        if (dark) raster[y * widthBytes + (x >> 3)] |= (0x80 >> (x % 8));
      }
    }
    var xL = widthBytes & 0xFF, xH = (widthBytes >> 8) & 0xFF;
    var yL = h & 0xFF, yH = (h >> 8) & 0xFF;
    var out = new Uint8Array(8 + raster.length);
    out.set([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH], 0);
    out.set(raster, 8);
    return out;
  }

  var logoRasterCache = null;
  /** Muat logo TOKOQIA yang SUDAH ADA di project (tidak membuat/generate logo baru) dan konversi ke raster. */
  function loadLogoRaster() {
    if (logoRasterCache) return Promise.resolve(logoRasterCache);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        logoRasterCache = canvasToEscPosRaster(canvas, 200); // logo dibuat lebih kecil dari lebar penuh agar struk tidak didominasi logo
        resolve(logoRasterCache);
      };
      img.onerror = function () { reject(new Error('Logo tidak ditemukan')); };
      img.src = 'assets/icons/icon-192.png';
    });
  }

  /** Bangun test print lengkap (dipakai tombol "Test Print" di Pengaturan → Printer). */
  function buildTestPrintBytes() {
    var buf = ByteBuf();
    function align(n) { buf.raw(0x1B, 0x61, n); }
    function bold(on) { buf.raw(0x1B, 0x45, on ? 1 : 0); }
    buf.raw(0x1B, 0x40);
    buf.raw.apply(null, ESC_CODEPAGE_PC850);

    return loadLogoRaster().catch(function () { return null; }).then(function (logoRaster) {
      align(1);
      if (logoRaster) buf.bytes(logoRaster);
      bold(true); buf.text('TOKOQIA\n'); bold(false);
      buf.text('TOKO AZQIA\n\n');
      buf.text('Printer Test\n\n');
      align(0);
      buf.text(line('-') + '\n');
      buf.text(padCenter('58mm / 48mm printable') + '\n');
      buf.text(padCenter('384 dots') + '\n');
      buf.text(padCenter('PC850') + '\n');
      buf.text(padCenter('ESC/POS') + '\n');
      buf.text(line('-') + '\n\n');
      buf.text('ABCDEFGHIJKLMNOPQRSTUVWXYZ\n');
      buf.text('0123456789\n\n');

      return BarcodeTools.renderBarcodeToCanvas('CODE128TEST', 50).then(function (canvas) {
        align(1);
        buf.text('CODE128 TEST\n');
        buf.bytes(canvasToEscPosRaster(canvas, 384));
        buf.text('\n');
        return BarcodeTools.renderQrToCanvas('TOKOQIA-TEST-' + Date.now(), 160);
      }).then(function (qrCanvas) {
        buf.text('QR TEST\n');
        buf.bytes(canvasToEscPosRaster(qrCanvas, 200));
        buf.text('\n');
        align(0);
        buf.text(line('-') + '\n');
        buf.text('\n\n\n\n'); // feed - tanpa command cutter
        return buf.toUint8Array();
      });
    });
  }

  return {
    buildTextLines: buildTextLines, buildHtml: buildHtml, WIDTH: WIDTH,
    buildEscPosBytes: buildEscPosBytes, buildTestPrintBytes: buildTestPrintBytes,
    canvasToEscPosRaster: canvasToEscPosRaster, ascSafe: ascSafe
  };
})();
