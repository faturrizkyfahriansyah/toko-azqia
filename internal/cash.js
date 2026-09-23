/**
 * internal/cash.js - Kas: saldo & riwayat kas masuk/keluar, penyesuaian manual, modal awal.
 */
window.Modules = window.Modules || {};
Modules.cash = (function () {
  function render(container) {
    return Api.call('cash.list', {}).then(function (d) {
      if (!container.isConnected) return;
      container.innerHTML =
        '<h1>Kas</h1>' +
        '<div class="kpi"><div class="label">Saldo Kas Saat Ini</div><div class="value">' + Utils.formatCurrency(d.balance) + '</div></div>' +
        '<div class="field-row" style="margin:14px 0;">' +
        '<button class="btn btn-secondary" id="btn-cash-in">+ Kas Masuk</button>' +
        '<button class="btn btn-outline" id="btn-cash-out">- Kas Keluar</button>' +
        '<button class="btn btn-outline" id="btn-modal-awal">Modal Awal</button>' +
        '</div>' +
        '<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Tipe</th><th>Sumber</th><th>Nominal</th><th>Catatan</th></tr></thead><tbody>' +
        d.movements.slice(0, 150).map(function (m) {
          return '<tr><td>' + Utils.formatDate(m.created_at) + '</td><td><span class="badge ' + (m.type === 'IN' ? 'green' : 'red') + '">' + m.type + '</span></td><td>' + m.source + '</td><td>' + Utils.formatCurrency(m.amount) + '</td><td>' + Utils.escapeHtml(m.notes || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';

      document.getElementById('btn-cash-in').addEventListener('click', function () { openForm('IN', 'ADJUSTMENT'); });
      document.getElementById('btn-cash-out').addEventListener('click', function () { openForm('OUT', 'ADJUSTMENT'); });
      document.getElementById('btn-modal-awal').addEventListener('click', function () { openForm('IN', 'OPENING_CAPITAL'); });
    });
  }

  function openForm(type, source) {
    var title = source === 'OPENING_CAPITAL' ? 'Catat Modal Awal' : (type === 'IN' ? 'Kas Masuk' : 'Kas Keluar');
    var m = Utils.openModal('<h3>' + title + '</h3><form id="f">' +
      '<div class="field"><label>Nominal (Rp)</label><input name="amount" type="number" min="1" required></div>' +
      '<div class="field"><label>Catatan</label><input name="notes" placeholder="' + (source === 'OPENING_CAPITAL' ? 'Modal awal toko' : 'Alasan penyesuaian') + '"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      Api.call('cash.adjustment', { type: type, amount: fd.amount, notes: fd.notes || (source === 'OPENING_CAPITAL' ? 'Modal awal toko' : '') }).then(function () {
        Utils.toast('Kas dicatat.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
