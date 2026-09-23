/**
 * internal/receivables.js - Piutang Pelanggan (pelanggan berhutang ke TOKO AZQIA).
 */
window.Modules = window.Modules || {};
Modules.receivables = (function () {
  function render(container) {
    return Api.call('receivable.list', {}).then(function (d) {
      if (!container.isConnected) return;
      container.innerHTML = '<h1>Piutang Pelanggan</h1>' +
        '<div class="kpi accent"><div class="label">Total Piutang Belum Lunas</div><div class="value">' + Utils.formatCurrency(d.total_outstanding) + '</div></div>' +
        '<div class="table-wrap" style="margin-top:12px;"><table><thead><tr><th>No.</th><th>Pelanggan</th><th>Total</th><th>Sisa</th><th>Status</th><th></th></tr></thead><tbody>' +
        d.receivables.map(rowHtml).join('') + '</tbody></table></div>';
      wireButtons(container, d.receivables);
    });
  }

  function rowHtml(r) {
    var badge = r.status === 'LUNAS' ? '<span class="badge green">Lunas</span>' : r.is_overdue ? '<span class="badge red">Jatuh Tempo</span>' : (r.status === 'SEBAGIAN' ? '<span class="badge gold">Sebagian</span>' : '<span class="badge grey">Belum Lunas</span>');
    return '<tr><td>' + r.receivable_number + '</td><td>' + Utils.escapeHtml(r.customer_name || r.customer_id) + '</td><td>' + Utils.formatCurrency(r.total) + '</td><td>' + Utils.formatCurrency(r.remaining) + '</td><td>' + badge + '</td>' +
      '<td>' + (r.status !== 'LUNAS' ? '<button class="btn btn-secondary btn-sm" data-pay="' + r.receivable_id + '">Bayar</button>' : '-') + '</td></tr>';
  }

  function wireButtons(container, rows) {
    Utils.qsa('[data-pay]', container).forEach(function (b) {
      b.addEventListener('click', function () {
        var r = rows.filter(function (x) { return x.receivable_id === b.getAttribute('data-pay'); })[0];
        openPayForm(r);
      });
    });
  }

  function openPayForm(r) {
    var m = Utils.openModal('<h3>Bayar Piutang ' + r.receivable_number + '</h3>' +
      '<p class="muted">Sisa: ' + Utils.formatCurrency(r.remaining) + '</p><form id="f">' +
      '<div class="field"><label>Nominal Dibayar (Rp)</label><input name="amount" type="number" max="' + r.remaining + '" min="1" value="' + r.remaining + '" required></div>' +
      '<div class="field"><label>Metode</label><select name="method"><option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option><option value="QRIS">QRIS</option></select></div>' +
      '<div class="field"><label>Catatan</label><input name="notes"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan Pembayaran</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      Api.call('receivable.payment', { receivable_id: r.receivable_id, amount: fd.amount, method: fd.method, notes: fd.notes }).then(function () {
        Utils.toast('Pembayaran piutang dicatat.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
