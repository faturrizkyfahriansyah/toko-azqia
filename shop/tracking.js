/**
 * shop/tracking.js - Lacak pesanan TANPA login, hanya dengan nomor pesanan (+ verifikasi
 * 4 digit terakhir WA untuk delivery). Termasuk Pesan (tanya jawab dengan toko) per pesanan.
 */
window.Modules = window.Modules || {};
Modules.tracking = (function () {
  var lastOrderNumber = '', lastVerify = '';

  function render(container) {
    container.innerHTML = '<h1>Lacak Pesanan</h1>' +
      '<form id="track-form" class="card">' +
      '<div class="field"><label>Nomor Pesanan</label><input name="order_number" placeholder="AZQ-20260101-0001" required></div>' +
      '<div class="field"><label>4 Digit Terakhir No. WhatsApp (khusus delivery)</label><input name="verify" maxlength="4"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Lacak</button>' +
      '</form><div id="track-result" style="margin-top:14px;"></div>';

    document.getElementById('track-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      lastOrderNumber = fd.order_number; lastVerify = fd.verify;
      var box = document.getElementById('track-result');
      Utils.showLoading(box);
      Api.call('public.order.track', fd).then(function (d) {
        box.innerHTML = '<div class="card"><div class="row"><strong>' + d.order_number + '</strong>' + Utils.orderStatusBadge(d.order_status) + '</div>' +
          '<p class="muted">' + d.fulfillment_type + ' &middot; Total ' + Utils.formatCurrency(d.grand_total) + '</p>' +
          '<div class="divider"></div><h3>Riwayat Status</h3>' +
          d.status_log.map(function (l) { return '<div class="row" style="padding:4px 0;"><span>' + Utils.escapeHtml(Utils.orderStatusInfo(l.to_status).label) + '</span><span class="muted">' + Utils.formatDate(l.changed_at) + '</span></div>'; }).join('') +
          '<div class="divider"></div><h3>Item</h3>' +
          d.items.map(function (it) { return '<div class="row"><span>' + Utils.escapeHtml(it.product_name) + ' x' + it.qty + '</span><span>' + Utils.formatCurrency(it.subtotal) + '</span></div>'; }).join('') +
          '</div>' +
          '<div class="card"><h3>Ada pertanyaan tentang pesanan ini?</h3><div id="msg-list"></div>' +
          '<div class="field-row" style="margin-top:8px;"><input id="msg-text" placeholder="Tulis pesan..." style="flex:1;"><button class="btn btn-secondary" id="msg-send">Kirim</button></div></div>';
        loadMessages();
        box.querySelector('#msg-send').addEventListener('click', function () {
          var text = box.querySelector('#msg-text').value.trim();
          if (!text) return;
          Api.call('public.message.send', { order_number: lastOrderNumber, verify: lastVerify, message: text }).then(function () {
            box.querySelector('#msg-text').value = ''; loadMessages();
          }).catch(function (err) { Utils.toast(err.message, 'error'); });
        });
      }).catch(function (err) { box.innerHTML = '<div class="empty-state">' + Utils.escapeHtml(err.message) + '</div>'; });
    });
    return Promise.resolve();
  }

  function loadMessages() {
    var listBox = document.getElementById('msg-list');
    if (!listBox) return;
    Api.call('public.message.list', { order_number: lastOrderNumber, verify: lastVerify }).then(function (d) {
      if (!document.getElementById('msg-list')) return;
      document.getElementById('msg-list').innerHTML = d.messages.length === 0 ? '<p class="muted">Belum ada pesan.</p>' :
        d.messages.map(function (m) {
          var fromStore = m.sender_type === 'STAFF';
          return '<div style="text-align:' + (fromStore ? 'left' : 'right') + ';margin-bottom:6px;"><span class="badge ' + (fromStore ? 'blue' : 'grey') + '">' + Utils.escapeHtml(fromStore ? 'Toko' : 'Anda') + '</span><div>' + Utils.escapeHtml(m.message) + '</div></div>';
        }).join('');
    }).catch(function () {});
  }

  return { render: render };
})();
