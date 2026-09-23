/**
 * js/printer/receiptBuilder.js
 * Mengubah receiptData (dari backend 51_Printer.gs buildReceiptData) menjadi:
 *  - baris teks polos 32 kolom (kertas 58mm, printable ~32 karakter font default) untuk thermal
 *  - HTML untuk preview/fallback browser print
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
    while (text.length > width) { out.push(text.substring(0, width)); text = text.substring(width); }
    out.push(text);
    return out;
  }

  function buildTextLines(data) {
    var L = [];
    L.push(padCenter(data.store_name));
    wrap(data.store_tagline, WIDTH).forEach(function (l) { L.push(padCenter(l)); });
    if (data.store_address) wrap(data.store_address, WIDTH).forEach(function (l) { L.push(padCenter(l)); });
    if (data.store_contact) L.push(padCenter(data.store_contact));
    L.push(line('='));
    L.push('No: ' + data.sale_number);
    L.push(Utils.formatDate(data.date));
    L.push(line('-'));
    data.items.forEach(function (it) {
      wrap(it.name, WIDTH).forEach(function (l) { L.push(l); });
      L.push(twoCol(it.qty + ' x ' + Math.round(it.unit_price).toLocaleString('id-ID'), Math.round(it.subtotal).toLocaleString('id-ID')));
    });
    L.push(line('-'));
    L.push(twoCol('Subtotal', Math.round(data.subtotal).toLocaleString('id-ID')));
    if (data.discount) L.push(twoCol('Diskon', '-' + Math.round(data.discount).toLocaleString('id-ID')));
    L.push(twoCol('TOTAL', Math.round(data.total).toLocaleString('id-ID')));
    L.push(line('-'));
    L.push(twoCol('Bayar (' + data.payment_method + ')', Math.round(data.amount_received).toLocaleString('id-ID')));
    if (data.payment_method === 'CASH') L.push(twoCol('Kembali', Math.round(data.change_amount).toLocaleString('id-ID')));
    L.push(line('='));
    wrap(data.footer, WIDTH).forEach(function (l) { L.push(padCenter(l)); });
    L.push('');
    wrap(data.copyright, WIDTH).forEach(function (l) { L.push(padCenter(l)); });
    return L;
  }

  function buildHtml(data) {
    var itemsHtml = data.items.map(function (it) {
      return '<div class="r-item"><div>' + Utils.escapeHtml(it.name) + '</div>' +
        '<div class="r-row"><span>' + it.qty + ' x ' + Utils.formatCurrency(it.unit_price) + '</span><span>' + Utils.formatCurrency(it.subtotal) + '</span></div></div>';
    }).join('');
    return (
      '<div class="receipt-58">' +
      '<div class="r-center r-bold">' + Utils.escapeHtml(data.store_name) + '</div>' +
      '<div class="r-center">' + Utils.escapeHtml(data.store_tagline) + '</div>' +
      (data.store_address ? '<div class="r-center">' + Utils.escapeHtml(data.store_address) + '</div>' : '') +
      '<div class="r-hr"></div>' +
      '<div>No: ' + Utils.escapeHtml(data.sale_number) + '</div>' +
      '<div>' + Utils.formatDate(data.date) + '</div>' +
      '<div class="r-hr"></div>' +
      itemsHtml +
      '<div class="r-hr"></div>' +
      '<div class="r-row"><span>Subtotal</span><span>' + Utils.formatCurrency(data.subtotal) + '</span></div>' +
      (data.discount ? '<div class="r-row"><span>Diskon</span><span>-' + Utils.formatCurrency(data.discount) + '</span></div>' : '') +
      '<div class="r-row r-bold"><span>TOTAL</span><span>' + Utils.formatCurrency(data.total) + '</span></div>' +
      '<div class="r-hr"></div>' +
      '<div class="r-row"><span>Bayar (' + Utils.escapeHtml(data.payment_method) + ')</span><span>' + Utils.formatCurrency(data.amount_received) + '</span></div>' +
      (data.payment_method === 'CASH' ? '<div class="r-row"><span>Kembali</span><span>' + Utils.formatCurrency(data.change_amount) + '</span></div>' : '') +
      '<div class="r-hr"></div>' +
      '<div class="r-center">' + Utils.escapeHtml(data.footer) + '</div>' +
      '<div class="r-center r-small">' + Utils.escapeHtml(data.copyright) + '</div>' +
      '</div>'
    );
  }

  return { buildTextLines: buildTextLines, buildHtml: buildHtml, WIDTH: WIDTH };
})();
