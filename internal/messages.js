/**
 * internal/messages.js - Pesan: pertanyaan pelanggan per pesanan online + pesan internal staf.
 */
window.Modules = window.Modules || {};
Modules.messages = (function () {
  var activeTab = 'customer';

  function render(container) {
    container.innerHTML = '<h1>Pesan</h1><div class="tabs">' +
      tabBtn('customer', 'Pesan Pelanggan') + tabBtn('internal', 'Internal Tim') + '</div><div id="tab-body"></div>';
    Utils.qsa('[data-tab]', container).forEach(function (b) { b.addEventListener('click', function () { activeTab = b.getAttribute('data-tab'); render(container); }); });
    return renderTab();
  }
  function tabBtn(id, label) { return '<button data-tab="' + id + '" class="' + (activeTab === id ? 'active' : '') + '">' + label + '</button>'; }
  function renderTab() {
    var body = document.getElementById('tab-body');
    return activeTab === 'customer' ? renderCustomerThreads(body) : renderInternal(body);
  }

  function renderCustomerThreads(body) {
    return Api.call('message.threads', {}).then(function (d) {
      if (d.threads.length === 0) { body.innerHTML = '<div class="empty-state">Belum ada pesan dari pelanggan.</div>'; return; }
      body.innerHTML = d.threads.map(function (t) {
        return '<div class="card row" style="cursor:pointer;" data-open="' + t.ref_id + '" data-order="' + Utils.escapeHtml(t.order_number) + '">' +
          '<div><strong>' + Utils.escapeHtml(t.order_number) + '</strong>' + (t.unread_count > 0 ? ' <span class="badge red">' + t.unread_count + '</span>' : '') +
          '<div class="muted">' + Utils.escapeHtml(t.last_message) + '</div></div><span class="muted">' + Utils.formatDate(t.last_at) + '</span></div>';
      }).join('');
      Utils.qsa('[data-open]', body).forEach(function (b) {
        b.addEventListener('click', function () { openThread(b.getAttribute('data-open'), b.getAttribute('data-order')); });
      });
    });
  }

  function openThread(refId, orderNumber) {
    Api.call('message.list', { ref_id: refId }).then(function (d) {
      Api.call('message.markRead', { ref_id: refId });
      var msgHtml = d.messages.map(function (m) {
        var mine = m.sender_type === 'STAFF';
        return '<div style="text-align:' + (mine ? 'right' : 'left') + ';margin-bottom:6px;"><div class="badge ' + (mine ? 'blue' : 'grey') + '">' + Utils.escapeHtml(m.sender_name) + '</div><div>' + Utils.escapeHtml(m.message) + '</div></div>';
      }).join('');
      var m2 = Utils.openModal('<h3>Pesanan ' + Utils.escapeHtml(orderNumber) + '</h3><div style="max-height:280px;overflow-y:auto;">' + msgHtml + '</div>' +
        '<div class="field-row" style="margin-top:10px;"><input id="reply-text" placeholder="Balas pesan..." style="flex:1;"><button class="btn btn-primary" id="reply-send">Kirim</button></div>');
      m2.querySelector('#reply-send').addEventListener('click', function () {
        var text = m2.querySelector('#reply-text').value.trim();
        if (!text) return;
        Api.call('message.send', { ref_id: refId, message: text }).then(function () {
          Utils.closeModal(); openThread(refId, orderNumber);
        });
      });
    });
  }

  function renderInternal(body) {
    return Api.call('message.list', { thread_type: 'INTERNAL' }).then(function (d) {
      body.innerHTML = '<div class="field-row"><input id="internal-text" placeholder="Tulis pesan untuk tim..." style="flex:1;"><button class="btn btn-primary" id="internal-send">Kirim</button></div>' +
        '<div id="internal-list" style="margin-top:12px;">' + d.messages.slice().reverse().map(function (m) {
          return '<div class="card"><div class="row"><strong>' + Utils.escapeHtml(m.sender_name) + '</strong><span class="muted">' + Utils.formatDate(m.created_at) + '</span></div><div>' + Utils.escapeHtml(m.message) + '</div></div>';
        }).join('') + '</div>';
      body.querySelector('#internal-send').addEventListener('click', function () {
        var text = body.querySelector('#internal-text').value.trim();
        if (!text) return;
        Api.call('message.internalSend', { message: text }).then(function () { Router.render(); });
      });
    });
  }

  return { render: render };
})();
