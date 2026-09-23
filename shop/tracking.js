/**
 * shop/tracking.js - Lacak pesanan TANPA login, hanya dengan nomor pesanan (+ verifikasi
 * 4 digit terakhir WA untuk delivery).
 */
window.Modules = window.Modules || {};
Modules.tracking = (function () {
  function render(container) {
    container.innerHTML = '<h1>Lacak Pesanan</h1>' +
      '<form id="track-form" class="card">' +
      '<div class="field"><label>Nomor Pesanan</label><input name="order_number" placeholder="AZK-20260101-0001" required></div>' +
      '<div class="field"><label>4 Digit Terakhir No. WhatsApp (khusus delivery)</label><input name="verify" maxlength="4"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Lacak</button>' +
      '</form><div id="track-result" style="margin-top:14px;"></div>';

    document.getElementById('track-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      var box = document.getElementById('track-result');
      Utils.showLoading(box);
      Api.call('public.order.track', fd).then(function (d) {
        box.innerHTML = '<div class="card"><div class="row"><strong>' + d.order_number + '</strong><span class="badge blue">' + d.order_status + '</span></div>' +
          '<p class="muted">' + d.fulfillment_type + ' &middot; Total ' + Utils.formatCurrency(d.grand_total) + '</p>' +
          '<div class="divider"></div><h3>Riwayat Status</h3>' +
          d.status_log.map(function (l) { return '<div class="row" style="padding:4px 0;"><span>' + l.to_status + '</span><span class="muted">' + Utils.formatDate(l.changed_at) + '</span></div>'; }).join('') +
          '<div class="divider"></div><h3>Item</h3>' +
          d.items.map(function (it) { return '<div class="row"><span>' + Utils.escapeHtml(it.product_name) + ' x' + it.qty + '</span><span>' + Utils.formatCurrency(it.subtotal) + '</span></div>'; }).join('') +
          '</div>';
      }).catch(function (err) { box.innerHTML = '<div class="empty-state">' + Utils.escapeHtml(err.message) + '</div>'; });
    });
    return Promise.resolve();
  }
  return { render: render };
})();
