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

  return { buildTextLines: buildTextLines, buildHtml: buildHtml, WIDTH: WIDTH };
})();
