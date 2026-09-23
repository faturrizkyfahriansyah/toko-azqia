/**
 * internal/dashboard.js - Ringkasan Toko.
 */
window.Modules = window.Modules || {};
Modules.dashboard = {
  render: function (container) {
    return Api.call('dashboard.summary', {}).then(function (d) {
      container.innerHTML =
        '<h1>Ringkasan Hari Ini</h1>' +
        '<div class="kpi-grid">' +
        kpi('Penjualan', Utils.formatCurrency(d.penjualan_hari_ini), true) +
        kpi('Transaksi', d.jumlah_transaksi) +
        kpi('Produk Terjual', d.produk_terjual) +
        kpi('Laba Kotor', Utils.formatCurrency(d.laba_kotor), true) +
        kpi('Barang Masuk', Utils.formatCurrency(d.barang_masuk)) +
        kpi('Pengeluaran', Utils.formatCurrency(d.pengeluaran)) +
        kpi('Kas Saat Ini', Utils.formatCurrency(d.kas), true) +
        kpi('Pesanan Online', d.pesanan_online) +
        '</div>' +
        '<div class="field-row" style="margin:16px 0;flex-wrap:wrap;">' +
        '<a href="#/internal/pos" class="btn btn-primary">+ Transaksi Baru</a>' +
        '<a href="#/internal/orders" class="btn btn-outline">Pesanan Menunggu (' + d.pesanan_menunggu_diproses + ')</a>' +
        '<a href="#/internal/inventory" class="btn btn-outline">Stok Menipis (' + d.produk_stok_menipis + ')</a>' +
        '</div>' +
        '<h2>Transaksi Terbaru</h2>' +
        renderTable(['No. Transaksi', 'Total', 'Waktu'], d.recent_transactions.map(function (t) {
          return [t.sale_number, Utils.formatCurrency(t.total), Utils.formatDate(t.sale_date)];
        })) +
        '<h2 style="margin-top:18px;">Stok Menipis</h2>' +
        renderTable(['Produk', 'Stok', 'Minimum'], d.low_stock_products.map(function (p) {
          return [p.product_name, p.current_stock, p.minimum_stock];
        })) +
        '<h2 style="margin-top:18px;">Pesanan Online Terbaru</h2>' +
        renderTable(['No. Pesanan', 'Status', 'Total'], d.recent_online_orders.map(function (o) {
          return [o.order_number, o.order_status, Utils.formatCurrency(o.grand_total)];
        }));
    });

    function kpi(label, value, accent) {
      return '<div class="kpi' + (accent ? ' accent' : '') + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
    }
    function renderTable(headers, rows) {
      if (rows.length === 0) return '<div class="empty-state">Belum ada data.</div>';
      return '<div class="table-wrap"><table><thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + Utils.escapeHtml(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div>';
    }
  }
};
