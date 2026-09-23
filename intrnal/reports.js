/**
 * internal/reports.js - 11 jenis laporan.
 */
window.Modules = window.Modules || {};
Modules.reports = (function () {
  var REPORT_TYPES = [
    { id: 'sales', label: 'Penjualan', action: 'report.sales' },
    { id: 'transactions', label: 'Transaksi', action: 'report.transactions' },
    { id: 'productsSold', label: 'Produk Terjual', action: 'report.productsSold' },
    { id: 'purchases', label: 'Pembelian', action: 'report.purchases' },
    { id: 'stock', label: 'Stok', action: 'report.stock' },
    { id: 'lowStock', label: 'Stok Menipis', action: 'report.lowStock' },
    { id: 'returns', label: 'Retur', action: 'report.returns' },
    { id: 'expenses', label: 'Pengeluaran', action: 'report.expenses' },
    { id: 'cash', label: 'Kas', action: 'report.cash' },
    { id: 'grossProfit', label: 'Laba Kotor', action: 'report.grossProfit' },
    { id: 'onlineOrders', label: 'Pesanan Online', action: 'report.onlineOrders' }
  ];

  function render(container) {
    container.innerHTML =
      '<h1>Laporan</h1>' +
      '<div class="field"><label>Jenis Laporan</label><select id="rep-type">' +
      REPORT_TYPES.map(function (t) { return '<option value="' + t.id + '">' + t.label + '</option>'; }).join('') + '</select></div>' +
      '<div class="field-row"><div class="field"><label>Dari Tanggal</label><input id="rep-from" type="date"></div>' +
      '<div class="field"><label>Sampai Tanggal</label><input id="rep-to" type="date"></div></div>' +
      '<button class="btn btn-primary btn-block" id="rep-run">Tampilkan Laporan</button>' +
      '<div id="rep-result" style="margin-top:16px;"></div>';
    document.getElementById('rep-run').addEventListener('click', run);
    return run();
  }

  function run() {
    var typeId = document.getElementById('rep-type').value;
    var type = REPORT_TYPES.filter(function (t) { return t.id === typeId; })[0];
    var from = document.getElementById('rep-from').value;
    var to = document.getElementById('rep-to').value;
    var resultBox = document.getElementById('rep-result');
    Utils.showLoading(resultBox);
    return Api.call(type.action, { date_from: from, date_to: to }).then(function (d) {
      resultBox.innerHTML = renderers[typeId](d);
    }).catch(function (err) { resultBox.innerHTML = '<div class="empty-state">' + Utils.escapeHtml(err.message) + '</div>'; });
  }

  function table(headers, rows) {
    if (rows.length === 0) return '<div class="empty-state">Tidak ada data pada rentang ini.</div>';
    return '<div class="table-wrap"><table><thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function summaryRow(label, value) { return '<div class="kpi"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>'; }

  var renderers = {
    sales: function (d) { return '<div class="kpi-grid">' + summaryRow('Total Penjualan', Utils.formatCurrency(d.total_sales)) + summaryRow('Jumlah Transaksi', d.transaction_count) + '</div>'; },
    transactions: function (d) { return table(['No.', 'Tanggal', 'Total', 'Status'], d.transactions.map(function (t) { return [t.sale_number, Utils.formatDate(t.sale_date), Utils.formatCurrency(t.total), t.status]; })); },
    productsSold: function (d) { return table(['Produk', 'Qty Terjual', 'Pendapatan'], d.products.map(function (p) { return [Utils.escapeHtml(p.product_name), p.qty, Utils.formatCurrency(p.revenue)]; })); },
    purchases: function (d) { return '<div class="kpi-grid">' + summaryRow('Total Pembelian', Utils.formatCurrency(d.total_purchases)) + '</div>' + table(['No.', 'Tanggal', 'Total', 'Status'], d.purchases.map(function (p) { return [p.purchase_number, Utils.formatDateOnly(p.date), Utils.formatCurrency(p.total), p.status]; })); },
    stock: function (d) { return table(['Produk', 'Stok Saat Ini', 'Direservasi', 'Tersedia', 'Minimum'], d.products.map(function (p) { return [Utils.escapeHtml(p.product_name), p.current_stock, p.reserved_stock, p.available_stock, p.minimum_stock]; })); },
    lowStock: function (d) { return table(['Produk', 'Stok', 'Minimum'], d.products.map(function (p) { return [Utils.escapeHtml(p.product_name), p.current_stock, p.minimum_stock]; })); },
    returns: function (d) { return '<h3>Retur Pelanggan</h3>' + table(['No.', 'Tanggal', 'Qty', 'Kondisi'], d.returns_customer.map(function (r) { return [r.return_number, Utils.formatDate(r.created_at), r.qty, r.condition]; })) + '<h3 style="margin-top:14px;">Retur Supplier</h3>' + table(['No.', 'Tanggal', 'Qty', 'Kondisi'], d.returns_supplier.map(function (r) { return [r.return_number, Utils.formatDate(r.created_at), r.qty, r.condition]; })); },
    expenses: function (d) { return '<div class="kpi-grid">' + summaryRow('Total Pengeluaran', Utils.formatCurrency(d.total_expenses)) + '</div>' + table(['No.', 'Tanggal', 'Kategori', 'Nominal'], d.expenses.map(function (e) { return [e.expense_number, Utils.formatDateOnly(e.date), Utils.escapeHtml(e.category), Utils.formatCurrency(e.amount)]; })); },
    cash: function (d) { return '<div class="kpi-grid">' + summaryRow('Kas Masuk', Utils.formatCurrency(d.total_in)) + summaryRow('Kas Keluar', Utils.formatCurrency(d.total_out)) + summaryRow('Saldo Saat Ini', Utils.formatCurrency(d.current_balance)) + '</div>' + table(['Waktu', 'Tipe', 'Sumber', 'Nominal'], d.movements.map(function (m) { return [Utils.formatDate(m.created_at), m.type, m.source, Utils.formatCurrency(m.amount)]; })); },
    grossProfit: function (d) { return '<div class="kpi-grid">' + summaryRow('Pendapatan', Utils.formatCurrency(d.revenue)) + summaryRow('Estimasi HPP', Utils.formatCurrency(d.estimated_cogs)) + summaryRow('Laba Kotor', Utils.formatCurrency(d.gross_profit)) + '</div><p class="hint">' + d.note + '</p>'; },
    onlineOrders: function (d) { return '<div class="kpi-grid">' + summaryRow('Total Nilai Terbayar', Utils.formatCurrency(d.total_paid_value)) + '</div>' + table(['No.', 'Status', 'Total'], d.orders.map(function (o) { return [o.order_number, o.order_status, Utils.formatCurrency(o.grand_total)]; })); }
  };

  return { render: render };
})();
