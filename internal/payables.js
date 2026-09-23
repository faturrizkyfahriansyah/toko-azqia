/**
 * internal/payables.js - Hutang Supplier (TOKO AZQIA berhutang ke supplier).
 */
window.Modules = window.Modules || {};
Modules.payables = (function () {
  function render(container) {
    return Api.call('payable.list', {}).then(function (d) {
      if (!container.isConnected) return;
      container.innerHTML = '<h1>Hutang Supplier</h1>' +
        '<div class="kpi accent"><div class="label">Total Hutang Belum Lunas</div><div class="value">' + Utils.formatCurrency(d.total_outstanding) + '</div></div>' +
        '<div class="table-wrap" style="margin-top:12px;"><table><thead><tr><th>No.</th><th>Supplier</th><th>Total</th><th>Sisa</th><th>Status</th><th></th></tr></thead><tbody>' +
        d.payables.map(rowHtml).join('') + '</tbody></table></div>';
      wireButtons(container, d.payables);
    });
  }

  function rowHtml(r) {
    var badge = r.status === 'LUNAS' ? '<span class="badge green">Lunas</span>' : r.is_overdue ? '<span class="badge red">Jatuh Tempo</span>' : (r.status === 'SEBAGIAN' ? '<span class="badge gold">Sebagian</span>' : '<span class="badge grey">Belum Lunas</span>');
    return '<tr><td>' + r.payable_number + '</td><td>' + Utils.escapeHtml(r.supplier_name || r.supplier_id) + '</td><td>' + Utils.formatCurrency(r.total) + '</td><td>' + Utils.formatCurrency(r.remaining) + '</td><td>' + badge + '</td>' +
      '<td>' + (r.status !== 'LUNAS' ? '<button class="btn btn-secondary btn-sm" data-pay="' + r.payable_id + '">Bayar</button>' : '-') + '</td></tr>';
  }

  function wireButtons(container, rows) {
    Utils.qsa('[data-pay]', container).forEach(function (b) {
      b.addEventListener('click', function () {
        var r = rows.filter(function (x) { return x.payable_id === b.getAttribute('data-pay'); })[0];
        openPayForm(r);
      });
    });
  }

  function openPayForm(r) {
    var m = Utils.openModal('<h3>Bayar Hutang ' + r.payable_number + '</h3>' +
      '<p class="muted">Sisa: ' + Utils.formatCurrency(r.remaining) + '</p><form id="f">' +
      '<div class="field"><label>Nominal Dibayar (Rp)</label><input name="amount" type="number" max="' + r.remaining + '" min="1" value="' + r.remaining + '" required></div>' +
      '<div class="field"><label>Metode</label><select name="method"><option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option></select></div>' +
      '<div class="field"><label>Catatan</label><input name="notes"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan Pembayaran</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      Api.call('payable.payment', { payable_id: r.payable_id, amount: fd.amount, method: fd.method, notes: fd.notes }).then(function () {
        Utils.toast('Pembayaran hutang dicatat.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
