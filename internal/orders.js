/**
 * internal/orders.js - Kelola Pesanan Online (konfirmasi pembayaran, ubah status).
 */
window.Modules = window.Modules || {};
Modules.orders = (function () {
  var NEXT_STATUS = {
    'MENUNGGU PEMBAYARAN': ['MENUNGGU KONFIRMASI', 'DIPROSES', 'DIBATALKAN'],
    'MENUNGGU KONFIRMASI': ['DIPROSES', 'DIBATALKAN'],
    'DIPROSES': ['DIPERSIAPKAN', 'DIBATALKAN'],
    'DIPERSIAPKAN': ['SIAP DIAMBIL', 'DALAM PENGANTARAN', 'DIBATALKAN'],
    'SIAP DIAMBIL': ['SELESAI', 'DIBATALKAN'],
    'DALAM PENGANTARAN': ['SELESAI', 'DIBATALKAN']
  };

  function render(container) {
    return Api.call('order.list', {}).then(function (d) {
      if (!container.isConnected) return;
      container.innerHTML = '<h1>Pesanan Online</h1><div id="list"></div>';
      renderList(d.orders);
    });
  }

  function renderList(orders) {
    var box = document.getElementById('list');
    if (orders.length === 0) { box.innerHTML = '<div class="empty-state">Belum ada pesanan online.</div>'; return; }
    box.innerHTML = orders.map(function (o) {
      var actions = '';
      if (o.payment_status !== 'PAID') actions += '<button class="btn btn-secondary btn-sm" data-confirm-pay="' + o.order_id + '">Konfirmasi Pembayaran</button> ';
      (NEXT_STATUS[o.order_status] || []).forEach(function (s) {
        actions += '<button class="btn btn-outline btn-sm" data-status="' + o.order_id + '" data-to="' + s + '">' + Utils.escapeHtml(Utils.orderStatusInfo(s).label) + '</button> ';
      });
      return '<div class="card"><div class="row"><strong>' + o.order_number + '</strong>' + Utils.orderStatusBadge(o.order_status) + '</div>' +
        '<div class="muted">' + o.fulfillment_type + ' &middot; ' + Utils.escapeHtml(o.customer_name || 'Pickup') + ' &middot; ' + Utils.formatCurrency(o.grand_total) + '</div>' +
        '<div style="margin-top:8px;">' + actions + '</div></div>';
    }).join('');

    Utils.qsa('[data-confirm-pay]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        Api.call('order.confirmPayment', { order_id: b.getAttribute('data-confirm-pay') }).then(function () {
          Utils.toast('Pembayaran dikonfirmasi.', 'success'); Router.render();
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
    Utils.qsa('[data-status]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var to = b.getAttribute('data-to');
        if (to === 'DIBATALKAN' && !confirm('Batalkan pesanan ini?')) return;
        Api.call('order.updateStatus', { order_id: b.getAttribute('data-status'), to_status: to }).then(function () {
          Utils.toast('Status diperbarui ke ' + Utils.orderStatusInfo(to).label + '.', 'success'); Router.render();
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }

  return { render: render };
})();
