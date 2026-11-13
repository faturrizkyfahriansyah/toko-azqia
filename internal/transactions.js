/**
 * internal/transactions.js - Riwayat Transaksi (V3): tab Lunas / Belum Lunas / Dibatalkan,
 * filter periode, ringkasan periode (transaksi, omzet, produk terjual, profit), daftar kartu,
 * detail, cetak ulang, void.
 *  - "Belum Lunas" = penjualan dengan metode Hutang yang piutangnya belum lunas.
 *  - Ringkasan = seluruh penjualan SELESAI pada periode terpilih (tidak tergantung tab).
 */
window.Modules = window.Modules || {};
Modules.transactions = (function () {
  var tab = 'lunas', period = 'today', customDay = '', search = '';

  function ymd(d) { var z = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function range() {
    var now = new Date(), from = '', to = '';
    if (period === 'today') { from = to = ymd(now); }
    else if (period === '7d') { var a = new Date(now); a.setDate(a.getDate() - 6); from = ymd(a); to = ymd(now); }
    else if (period === 'month') { from = ymd(new Date(now.getFullYear(), now.getMonth(), 1)); to = ymd(now); }
    else if (period === 'day' && customDay) { from = to = customDay; }
    return { from: from, to: to };
  }
  function periodLabel() {
    return { today: 'Hari ini', '7d': '7 hari terakhir', month: 'Bulan ini', all: 'Semua waktu', day: customDay || 'Pilih tanggal' }[period];
  }
  function dateBadge(iso) {
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return '<div class="date-badge"><span class="d">-</span><span class="m">&nbsp;</span></div>';
    return '<div class="date-badge"><span class="d">' + dt.getDate() + '</span><span class="m">' + dt.toLocaleDateString('id-ID', { month: 'short' }) + '</span></div>';
  }
  function chip(id, label) { return '<button class="chip' + (period === id ? ' active' : '') + '" data-period="' + id + '">' + label + '</button>'; }

  function render(container) {
    container.innerHTML =
      '<h1 class="page-title">Riwayat Transaksi</h1>' +
      '<div class="search-box"><input id="tx-search" type="search" placeholder="Cari No. Transaksi" value="' + Utils.escapeHtml(search) + '"></div>' +
      '<div class="tabs" id="tx-tabs">' +
      ['lunas:Lunas', 'belum:Belum Lunas', 'void:Dibatalkan'].map(function (t) { var p = t.split(':'); return '<button data-tab="' + p[0] + '" class="' + (tab === p[0] ? 'active' : '') + '">' + p[1] + '</button>'; }).join('') +
      '</div>' +
      '<div class="period-row" id="tx-periods">' + chip('today', 'Hari ini') + chip('7d', '7 Hari') + chip('month', 'Bulan ini') + chip('all', 'Semua') +
      '<input id="tx-day" type="date" class="chip' + (period === 'day' ? ' active' : '') + '" value="' + Utils.escapeHtml(customDay) + '" aria-label="Pilih tanggal" style="min-height:36px;"></div>' +
      '<div id="tx-stats"></div>' +
      '<div id="tx-result"></div>';

    Utils.qsa('#tx-tabs [data-tab]', container).forEach(function (b) {
      b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); render(container); });
    });
    Utils.qsa('#tx-periods [data-period]', container).forEach(function (b) {
      b.addEventListener('click', function () { period = b.getAttribute('data-period'); render(container); });
    });
    container.querySelector('#tx-day').addEventListener('change', function (e) {
      if (!e.target.value) return;
      customDay = e.target.value; period = 'day'; render(container);
    });
    container.querySelector('#tx-search').addEventListener('input', Utils.debounce(function (e) { search = e.target.value.trim(); loadList(); }, 300));
    loadStats();
    return loadList();
  }

  function loadStats() {
    var box = document.getElementById('tx-stats');
    if (!box) return;
    var r = range(), p = { date_from: r.from, date_to: r.to };
    box.innerHTML = '<div class="stat-grid">' + ['Transaksi', 'Omzet', 'Produk Terjual', 'Profit'].map(function (l) { return '<div class="stat"><div class="l">' + l + '</div><div class="v">&hellip;</div></div>'; }).join('') + '</div>';
    Promise.all([Api.call('report.sales', p), Api.call('report.productsSold', p), Api.call('report.grossProfit', p)]).then(function (res) {
      var b = document.getElementById('tx-stats'); if (!b) return;
      var qty = (res[1].products || []).reduce(function (s, x) { return s + (Number(x.qty) || 0); }, 0);
      b.innerHTML = '<div class="stat-grid">' +
        '<div class="stat"><div class="l">Transaksi</div><div class="v">' + (Number(res[0].transaction_count) || 0) + '</div></div>' +
        '<div class="stat accent"><div class="l">Omzet</div><div class="v">' + Utils.formatCurrency(res[0].total_sales || 0) + '</div></div>' +
        '<div class="stat"><div class="l">Produk Terjual</div><div class="v">' + qty + '</div></div>' +
        '<div class="stat green"><div class="l">Profit</div><div class="v">' + Utils.formatCurrency(res[2].gross_profit || 0) + '</div></div>' +
        '</div><div class="hint" style="margin:-4px 2px 10px;">Ringkasan ' + periodLabel().toLowerCase() + ' (penjualan selesai).</div>';
    }).catch(function () { var b = document.getElementById('tx-stats'); if (b) b.innerHTML = ''; });
  }

  function loadList() {
    var box = document.getElementById('tx-result');
    if (!box) return Promise.resolve();
    Utils.showLoading(box);
    var r = range();
    var params = { search: search, date_from: r.from, date_to: r.to ? r.to + 'T23:59:59' : '' };
    return Promise.all([Api.call('sale.list', params), Api.call('receivable.list', {})]).then(function (res) {
      if (!document.getElementById('tx-result')) return;
      var unpaid = {};
      (res[1].receivables || []).forEach(function (x) { if (x.ref_type === 'SALE' && x.status !== 'LUNAS') unpaid[x.ref_id] = true; });
      var rows = (res[0].sales || []).filter(function (s) {
        if (tab === 'void') return s.status === 'VOID';
        if (s.status === 'VOID') return false;
        return tab === 'belum' ? !!unpaid[s.sale_id] : !unpaid[s.sale_id];
      });
      if (rows.length === 0) {
        box.innerHTML = '<div class="empty-state"><img src="assets/icons/tokoqia-empty-state.png" alt=""><div class="empty-title">Tidak ada transaksi</div><div class="empty-sub">Coba ganti periode atau kata kunci.</div></div>';
        return;
      }
      var shown = rows.slice(0, 100);
      box.innerHTML = shown.map(function (s) {
        var isVoid = s.status === 'VOID';
        return '<div class="tx-card' + (isVoid ? ' void' : '') + '" data-detail="' + s.sale_id + '">' + dateBadge(s.sale_date) +
          '<div class="main"><div class="no">' + Utils.escapeHtml(s.sale_number) + '</div><div class="amt">' + Utils.formatCurrency(s.total) + '</div>' +
          '<div class="by">' + Utils.formatDate(s.sale_date) + '</div></div>' +
          '<div class="end">' + (isVoid ? '<span class="badge red">Void</span>' : (unpaid[s.sale_id] ? '<span class="badge gold">Belum lunas</span>' : '<span class="badge green">Lunas</span>')) + '</div></div>';
      }).join('') + (rows.length > shown.length ? '<div class="hint" style="text-align:center;">Menampilkan ' + shown.length + ' dari ' + rows.length + ' transaksi. Persempit periode untuk melihat lainnya.</div>' : '');
      Utils.qsa('[data-detail]', box).forEach(function (b) {
        b.addEventListener('click', function () { openDetail(b.getAttribute('data-detail')); });
      });
    }).catch(function (err) {
      var b = document.getElementById('tx-result');
      if (b) b.innerHTML = '<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-sub">' + Utils.escapeHtml(err.message) + '</div></div>';
    });
  }

  function openDetail(saleId) {
    Api.call('sale.detail', { sale_id: saleId }).then(function (d) {
      var sale = d.sale;
      var itemsHtml = d.items.map(function (it) {
        return '<div class="row" style="padding:4px 0;"><span>' + Utils.escapeHtml(it.product_name_snapshot) + ' x' + it.qty + (it.unit_name ? ' ' + it.unit_name : '') + '</span><span>' + Utils.formatCurrency(it.subtotal) + '</span></div>';
      }).join('');
      var payMethods = d.payments.map(function (pay) { return pay.method; }).join(' + ');
      var m = Utils.openModal(
        '<h3>' + sale.sale_number + '</h3>' +
        '<p class="muted">' + Utils.formatDate(sale.sale_date) + ' &middot; ' + (sale.status === 'VOID' ? 'Void' : 'Selesai') + '</p>' +
        itemsHtml + '<div class="divider"></div>' +
        '<div class="row"><strong>Total</strong><strong>' + Utils.formatCurrency(sale.total) + '</strong></div>' +
        '<p class="muted">Bayar: ' + (payMethods || '-') + '</p>' +
        (sale.status === 'VOID' ? '<p class="hint">Alasan void: ' + Utils.escapeHtml(sale.void_reason || '-') + '</p>' : '') +
        '<div class="field-row" style="margin-top:12px;">' +
        '<button class="btn btn-secondary btn-block" id="tx-print">Cetak Ulang</button>' +
        (sale.status !== 'VOID' && Auth.role() !== 'KASIR' ? '<button class="btn btn-outline btn-block" id="tx-void" style="color:var(--red);">Void</button>' : '') +
        '</div>'
      );
      m.querySelector('#tx-print').addEventListener('click', function () {
        var btn = m.querySelector('#tx-print');
        Api.call('pos.reprintReceipt', { sale_id: saleId }).then(function (data) {
          window.PrinterManager.printWithUI(btn, data);
        });
      });
      var voidBtn = m.querySelector('#tx-void');
      if (voidBtn) voidBtn.addEventListener('click', function () {
        var reason = prompt('Alasan pembatalan transaksi ini (wajib diisi):');
        if (!reason) return;
        doVoid(saleId, reason, null);
      });
    });
  }

  function doVoid(saleId, reason, pin) {
    Api.call('pos.voidSale', { sale_id: saleId, void_reason: reason, pin: pin }).then(function () {
      Utils.toast('Transaksi dibatalkan (void). Stok dikembalikan.', 'success'); Utils.closeModal(); Router.render();
    }).catch(function (err) {
      if (err.code === 'PIN_REQUIRED') {
        var enteredPin = prompt('Masukkan PIN keamanan Anda untuk mengonfirmasi Void:');
        if (!enteredPin) return;
        doVoid(saleId, reason, enteredPin);
      } else {
        Utils.toast(err.message, 'error');
      }
    });
  }

  return { render: render };
})();
