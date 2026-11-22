/**
 * shop/tracking.js - Tab Pesanan: SEMUA pesanan langsung terlihat (tidak perlu hafal nomor pesanan).
 *  - Pesanan yang dibuat di perangkat ini tersimpan otomatis (MyOrders) dan statusnya diperbarui dari server.
 *  - Jika sudah masuk akun, riwayat akun (berdasarkan nomor WhatsApp) ikut ditampilkan di perangkat mana pun.
 *  - Ketuk pesanan untuk melihat rincian, riwayat status, dan tanya toko. Cek manual dengan nomor pesanan tetap tersedia.
 */
window.Modules = window.Modules || {};
Modules.tracking = (function () {
  var esc = function (s) { return Utils.escapeHtml(String(s === undefined || s === null ? '' : s)); };
  var root = null, rows = [], cur = { no: '', verify: '' };

  function summary(items) {
    var t = (items || []).map(function (i) { return esc(i.product_name) + ' x' + i.qty; }).join(', ');
    return t.length > 90 ? t.substring(0, 88) + '…' : t;
  }
  function card(o) {
    var date = o.order_date || o.date;
    return '<button type="button" class="ord-card" data-no="' + esc(o.order_number) + '" data-v="' + esc(o.verify || '') + '">' +
      '<span class="row"><strong>' + esc(o.order_number) + '</strong>' + (o.order_status ? Utils.orderStatusBadge(o.order_status) : '<span class="badge grey">Memuat…</span>') + '</span>' +
      '<span class="muted ord-sub">' + (date ? esc(Utils.formatDate(date)) + ' &middot; ' : '') + esc(o.fulfillment_type === 'DELIVERY' ? 'Diantar' : 'Ambil di toko') + '</span>' +
      '<span class="ord-items">' + summary(o.items) + '</span>' +
      '<span class="row"><span class="muted">Total</span><strong>' + Utils.formatCurrency(o.grand_total || o.total || 0) + '</strong></span>' +
      '<span class="ord-more">Lihat detail &rsaquo;</span></button>';
  }

  function drawList() {
    var box = root.querySelector('#ord-list'); if (!box) return;
    box.innerHTML = rows.length ? rows.map(card).join('') :
      '<div class="empty-state"><p>Belum ada pesanan di perangkat ini.</p><p class="muted">Pesanan yang Anda buat akan langsung muncul di sini. Sudah punya akun? Masuk lewat tab Akun untuk melihat semua pesanan Anda.</p><a class="btn btn-primary" href="#/shop/catalog">Mulai Belanja</a></div>';
  }

  function mergeLocal() {
    return window.MyOrders.list().map(function (o) {
      return { order_number: o.order_number, verify: o.verify, order_date: o.date, fulfillment_type: o.fulfillment_type, grand_total: o.total, items: o.items, order_status: '', payment_method: o.payment_method };
    });
  }
  function upsert(list) {
    list.forEach(function (n) {
      var i = rows.findIndex(function (r) { return r.order_number === n.order_number; });
      if (i === -1) rows.push(n); else rows[i] = Object.assign({}, rows[i], n, { verify: n.verify || rows[i].verify });
    });
    rows.sort(function (a, b) { return String(b.order_date || '').localeCompare(String(a.order_date || '')); });
  }

  function showList(container) {
    root = container; rows = mergeLocal(); cur = { no: '', verify: '' };
    container.innerHTML = '<h1 class="shop-title">Pesanan Saya</h1><div id="ord-list"></div>' +
      '<details class="ord-manual"><summary>Cek pesanan dengan nomor pesanan</summary>' +
      '<form id="track-form" class="card"><div class="field"><label>Nomor Pesanan</label><input name="order_number" placeholder="AZQ-20260101-0001" required></div>' +
      '<div class="field"><label>4 Digit Terakhir No. WhatsApp (khusus delivery)</label><input name="verify" maxlength="4" inputmode="numeric"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Lacak</button></form></details>';
    drawList();
    container.querySelector('#ord-list').addEventListener('click', function (e) {
      var b = e.target.closest('.ord-card'); if (b) showDetail(container, b.getAttribute('data-no'), b.getAttribute('data-v'));
    });
    container.querySelector('#track-form').addEventListener('submit', function (e) {
      e.preventDefault(); var fd = Object.fromEntries(new FormData(e.target).entries());
      showDetail(container, String(fd.order_number).trim(), String(fd.verify || '').trim());
    });
    // status terbaru: akun (server) + status pesanan perangkat ini
    var jobs = [];
    var tk = window.CustAuth.token();
    if (tk) jobs.push(Api.call('public.customer.orders', { token: tk }).then(function (d) { upsert(d.orders || []); }).catch(function (err) { if (err && err.code === 'AUTH_INVALID') window.CustAuth.clear(); }));
    var local = window.MyOrders.list().slice(0, 20).map(function (o) { return { order_number: o.order_number, verify: o.verify }; });
    if (local.length) jobs.push(Api.call('public.order.statusBatch', { orders: local }).then(function (d) { upsert((d.orders || []).map(function (o) { var l = rows.filter(function (r) { return r.order_number === o.order_number; })[0] || {}; return Object.assign({}, o, { verify: l.verify, order_date: l.order_date || o.order_date }); })); }).catch(function () {}));
    return Promise.all(jobs).then(function () { if (root === container) drawList(); });
  }

  function showDetail(container, no, verify) {
    cur = { no: no, verify: verify };
    container.innerHTML = '<button type="button" class="link-btn" id="ord-back">&lsaquo; Semua pesanan</button><div id="track-result" style="margin-top:10px;"></div>';
    container.querySelector('#ord-back').addEventListener('click', function () { showList(container); });
    var box = container.querySelector('#track-result');
    Utils.showLoading(box);
    Api.call('public.order.track', { order_number: no, verify: verify }).then(function (d) {
      box.innerHTML = '<div class="card"><div class="row"><strong>' + esc(d.order_number) + '</strong>' + Utils.orderStatusBadge(d.order_status) + '</div>' +
        '<p class="muted">' + esc(d.fulfillment_type) + ' &middot; Total ' + Utils.formatCurrency(d.grand_total) + '</p>' +
        '<div class="divider"></div><h3>Riwayat Status</h3>' +
        d.status_log.map(function (l) { return '<div class="row" style="padding:4px 0;"><span>' + esc(Utils.orderStatusInfo(l.to_status).label) + '</span><span class="muted">' + Utils.formatDate(l.changed_at) + '</span></div>'; }).join('') +
        '<div class="divider"></div><h3>Item</h3>' +
        d.items.map(function (it) { return '<div class="row"><span>' + esc(it.product_name) + ' x' + it.qty + '</span><span>' + Utils.formatCurrency(it.subtotal) + '</span></div>'; }).join('') + '</div>' +
        '<div class="card"><h3>Ada pertanyaan tentang pesanan ini?</h3><div id="msg-list"></div>' +
        '<div class="field-row" style="margin-top:8px;"><input id="msg-text" placeholder="Tulis pesan..." style="flex:1;"><button class="btn btn-secondary" id="msg-send">Kirim</button></div></div>';
      loadMessages();
      box.querySelector('#msg-send').addEventListener('click', function () {
        var text = box.querySelector('#msg-text').value.trim(); if (!text) return;
        Api.call('public.message.send', { order_number: cur.no, verify: cur.verify, message: text }).then(function () { box.querySelector('#msg-text').value = ''; loadMessages(); }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    }).catch(function (err) { box.innerHTML = '<div class="empty-state">' + esc(err.message) + '</div>'; });
  }

  function loadMessages() {
    var listBox = document.getElementById('msg-list'); if (!listBox) return;
    Api.call('public.message.list', { order_number: cur.no, verify: cur.verify }).then(function (d) {
      var lb = document.getElementById('msg-list'); if (!lb) return;
      lb.innerHTML = d.messages.length === 0 ? '<p class="muted">Belum ada pesan.</p>' :
        d.messages.map(function (m) {
          var fromStore = m.sender_type === 'STAFF';
          return '<div style="text-align:' + (fromStore ? 'left' : 'right') + ';margin-bottom:6px;"><span class="badge ' + (fromStore ? 'blue' : 'grey') + '">' + esc(fromStore ? 'Toko' : 'Anda') + '</span><div>' + esc(m.message) + '</div></div>';
        }).join('');
    }).catch(function () {});
  }

  function render(container) { return showList(container) || Promise.resolve(); }
  return { render: render };
})();
