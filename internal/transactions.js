/**
 * internal/transactions.js - Riwayat Transaksi: cari, lihat detail, cetak ulang, void.
 */
window.Modules = window.Modules || {};
Modules.transactions = (function () {
  function render(container) {
    container.innerHTML =
      '<h1>Riwayat Transaksi</h1>' +
      '<div class="field-row">' +
      '<div class="field" style="flex:2;"><label>Cari No. Transaksi</label><input id="tx-search" placeholder="TRX-..."></div>' +
      '<div class="field"><label>Status</label><select id="tx-status"><option value="">Semua</option><option value="COMPLETED">Selesai</option><option value="VOID">Void</option></select></div>' +
      '</div>' +
      '<div class="field-row">' +
      '<div class="field"><label>Dari Tanggal</label><input id="tx-from" type="date"></div>' +
      '<div class="field"><label>Sampai Tanggal</label><input id="tx-to" type="date"></div>' +
      '</div>' +
      '<button class="btn btn-primary" id="tx-run">Cari</button>' +
      '<div id="tx-result" style="margin-top:14px;"></div>';
    document.getElementById('tx-run').addEventListener('click', run);
    return run();
  }

  function run() {
    var box = document.getElementById('tx-result');
    Utils.showLoading(box);
    var params = {
      search: document.getElementById('tx-search').value,
      status: document.getElementById('tx-status').value,
      date_from: document.getElementById('tx-from').value,
      date_to: document.getElementById('tx-to').value
    };
    return Api.call('sale.list', params).then(function (d) {
      if (d.sales.length === 0) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Tidak ada transaksi ditemukan</div><div class="empty-sub">Coba ubah kata kunci atau rentang tanggal.</div></div>'; return; }
      var statusBadge = function (s) { return s.status === 'VOID' ? '<span class="badge red">Void</span>' : '<span class="badge green">Selesai</span>'; };
      var tableHtml = '<div class="table-wrap"><table><thead><tr><th>No.</th><th>Waktu</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>' +
        d.sales.map(function (s) {
          return '<tr><td>' + s.sale_number + '</td><td>' + Utils.formatDate(s.sale_date) + '</td><td>' + Utils.formatCurrency(s.total) + '</td>' +
            '<td>' + statusBadge(s) + '</td>' +
            '<td><button class="btn btn-outline btn-sm" data-detail="' + s.sale_id + '">Detail</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      var listHtml = '<div class="mobile-list">' + d.sales.map(function (s) {
        return '<div class="data-row" data-detail="' + s.sale_id + '" style="cursor:pointer;">' +
          '<div class="main"><div class="title">' + s.sale_number + '</div><div class="sub">' + Utils.formatDate(s.sale_date) + '</div></div>' +
          '<div class="end"><div class="amount">' + Utils.formatCurrency(s.total) + '</div>' + statusBadge(s) + '</div></div>';
      }).join('') + '</div>';
      box.className = 'responsive-data';
      box.innerHTML = tableHtml + listHtml;
      Utils.qsa('[data-detail]', box).forEach(function (b) {
        b.addEventListener('click', function () { openDetail(b.getAttribute('data-detail')); });
      });
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
        (sale.status !== 'VOID' ? '<button class="btn btn-outline btn-block" id="tx-void" style="color:var(--red);">Void</button>' : '') +
        '</div>'
      );
      m.querySelector('#tx-print').addEventListener('click', function () {
        Api.call('pos.reprintReceipt', { sale_id: saleId }).then(function (data) {
          window.PrinterManager.print(data).catch(function (e) { Utils.toast(e.message, 'error'); });
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
