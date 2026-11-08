/**
 * internal/reports.js - Laporan (V3): menu dikelompokkan (Penjualan / Stok & Gudang / Keuangan),
 * ketuk satu laporan -> halaman detail dengan filter periode. Data tetap dari 11 laporan backend;
 * "Produk Terlaris" dan "Omzet Per Bulan" dihitung di layar dari data yang sama.
 */
window.Modules = window.Modules || {};
Modules.reports = (function () {
  var I = function () { return (window.Layout && window.Layout.ICONS) || {}; };
  var GROUPS = [
    { title: 'Penjualan', items: [
      { id: 'sales', label: 'Ringkasan Penjualan', desc: 'Total penjualan dan jumlah transaksi.', action: 'report.sales', icon: 'trend' },
      { id: 'omzetBulanan', label: 'Omzet Per Bulan', desc: 'Perkembangan omzet dari bulan ke bulan.', action: 'report.transactions', icon: 'trend', period: 'all' },
      { id: 'terlaris', label: 'Produk Terlaris', desc: 'Produk yang paling banyak terjual.', action: 'report.productsSold', icon: 'box' },
      { id: 'productsSold', label: 'Produk Terjual', desc: 'Jumlah dan nilai penjualan setiap produk.', action: 'report.productsSold', icon: 'clipboard' },
      { id: 'transactions', label: 'Daftar Transaksi', desc: 'Semua transaksi pada periode terpilih.', action: 'report.transactions', icon: 'receipt' },
      { id: 'grossProfit', label: 'Laba Kotor', desc: 'Pendapatan, perkiraan modal, dan laba kotor.', action: 'report.grossProfit', icon: 'coin' },
      { id: 'onlineOrders', label: 'Pesanan Online', desc: 'Pesanan dari toko online.', action: 'report.onlineOrders', icon: 'bag' }
    ] },
    { title: 'Stok & Gudang', items: [
      { id: 'stock', label: 'Stok Produk', desc: 'Stok produk yang dilacak (tanpa manajemen stok tidak ikut).', action: 'report.stock', icon: 'inbox', noPeriod: true },
      { id: 'lowStock', label: 'Stok Menipis', desc: 'Produk yang stoknya di batas minimum.', action: 'report.lowStock', icon: 'alert', noPeriod: true },
      { id: 'purchases', label: 'Barang Masuk', desc: 'Pembelian barang dari supplier.', action: 'report.purchases', icon: 'truck' },
      { id: 'returns', label: 'Retur', desc: 'Retur pelanggan dan supplier.', action: 'report.returns', icon: 'undo' }
    ] },
    { title: 'Keuangan', items: [
      { id: 'cash', label: 'Arus Kas', desc: 'Pemasukan dan pengeluaran kas.', action: 'report.cash', icon: 'wallet' },
      { id: 'expenses', label: 'Pengeluaran', desc: 'Biaya operasional toko.', action: 'report.expenses', icon: 'invoice' }
    ] }
  ];
  var current = null, period = 'month', from = '', to = '';

  function find(id) { var f = null; GROUPS.forEach(function (g) { g.items.forEach(function (it) { if (it.id === id) f = it; }); }); return f; }
  function ymd(d) { var z = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function rangeFor() {
    var now = new Date();
    if (period === 'today') return { from: ymd(now), to: ymd(now) };
    if (period === '7d') { var a = new Date(now); a.setDate(a.getDate() - 6); return { from: ymd(a), to: ymd(now) }; }
    if (period === 'month') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
    if (period === 'custom') return { from: from, to: to };
    return { from: '', to: '' };
  }

  function render(container) {
    if (!current) return renderMenu(container);
    return renderDetail(container, current);
  }

  function renderMenu(container) {
    var icons = I();
    container.innerHTML = '<h1 class="page-title">Laporan</h1>' + GROUPS.map(function (g) {
      return '<div class="menu-group-title">' + g.title + '</div><div class="menu-list">' + g.items.map(function (it) {
        return '<button class="menu-item" data-report="' + it.id + '"><span class="mi-ic">' + (icons[it.icon] || '') + '</span>' +
          '<span class="mi-tx"><div class="t">' + it.label + '</div><div class="d">' + it.desc + '</div></span></button>';
      }).join('') + '</div>';
    }).join('');
    Utils.qsa('[data-report]', container).forEach(function (b) {
      b.addEventListener('click', function () {
        current = b.getAttribute('data-report');
        period = find(current).period || 'month'; from = to = '';
        render(container);
      });
    });
  }

  function chip(id, label) { return '<button class="chip' + (period === id ? ' active' : '') + '" data-period="' + id + '">' + label + '</button>'; }

  function renderDetail(container, id) {
    var it = find(id), icons = I();
    container.innerHTML =
      '<div class="page-head"><button class="back-btn" id="rep-back" aria-label="Kembali">' + (icons.back || '&larr;') + '</button><h1>' + it.label + '</h1></div>' +
      (it.noPeriod ? '' :
        '<div class="period-row" id="rep-periods">' + chip('today', 'Hari ini') + chip('7d', '7 Hari') + chip('month', 'Bulan ini') + chip('all', 'Semua') + chip('custom', 'Atur tanggal') + '</div>' +
        (period === 'custom'
          ? '<div class="field-row"><div class="field"><label>Dari</label><input id="rep-from" type="date" value="' + Utils.escapeHtml(from) + '"></div><div class="field"><label>Sampai</label><input id="rep-to" type="date" value="' + Utils.escapeHtml(to) + '"></div></div>' +
            '<button class="btn btn-primary btn-block" id="rep-run" style="margin-bottom:12px;">Tampilkan</button>'
          : '')) +
      '<div id="rep-result"></div>';
    container.querySelector('#rep-back').addEventListener('click', function () { current = null; render(container); });
    Utils.qsa('#rep-periods [data-period]', container).forEach(function (b) {
      b.addEventListener('click', function () { period = b.getAttribute('data-period'); render(container); });
    });
    var runBtn = container.querySelector('#rep-run');
    if (runBtn) runBtn.addEventListener('click', function () {
      from = container.querySelector('#rep-from').value; to = container.querySelector('#rep-to').value; run(it);
    });
    return run(it);
  }

  function run(it) {
    var box = document.getElementById('rep-result');
    if (!box) return Promise.resolve();
    Utils.showLoading(box);
    var r = it.noPeriod ? { from: '', to: '' } : rangeFor();
    return Api.call(it.action, { date_from: r.from, date_to: r.to }).then(function (d) {
      var b = document.getElementById('rep-result'); if (b) b.innerHTML = renderers[it.id](d);
    }).catch(function (err) {
      var b = document.getElementById('rep-result'); if (b) b.innerHTML = '<div class="empty-state">' + Utils.escapeHtml(err.message) + '</div>';
    });
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


  renderers.terlaris = function (d) {
    var top = (d.products || []).slice(0, 10);
    return table(['#', 'Produk', 'Terjual', 'Pendapatan'], top.map(function (p, i) { return [i + 1, Utils.escapeHtml(p.product_name), p.qty, Utils.formatCurrency(p.revenue)]; }));
  };
  renderers.omzetBulanan = function (d) {
    var by = {};
    (d.transactions || []).forEach(function (t) {
      if (t.status !== 'COMPLETED') return;
      var k = String(t.sale_date).substring(0, 7);
      if (!by[k]) by[k] = { n: 0, total: 0 };
      by[k].n += 1; by[k].total += Number(t.total) || 0;
    });
    var keys = Object.keys(by).sort().reverse();
    var names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return table(['Bulan', 'Transaksi', 'Omzet'], keys.map(function (k) { var p = k.split('-'); return [names[Number(p[1]) - 1] + ' ' + p[0], by[k].n, Utils.formatCurrency(by[k].total)]; }));
  };

  // Dari menu samping selalu mulai di daftar laporan (bukan di laporan terakhir yang dibuka).
  return { render: function (container) { current = null; return render(container); } };
})();
