/**
 * internal/customers.js
 */
window.Modules = window.Modules || {};
Modules.customers = (function () {
  function render(container) {
    return Api.call('customer.list', {}).then(function (d) {
      if (!container.isConnected) return; // pengguna sudah pindah halaman sebelum data ini selesai dimuat
      container.innerHTML = '<div class="row"><h1>Pelanggan</h1><button class="btn btn-primary" id="btn-add">+ Pelanggan</button></div><div id="list"></div>';
      renderList(d.customers);
      document.getElementById('btn-add').addEventListener('click', function () { openForm(); });
    });
  }
  function renderList(rows) {
    var box = document.getElementById('list');
    if (rows.length === 0) { box.innerHTML = '<div class="empty-state">Belum ada pelanggan tercatat.</div>'; return; }
    box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>WhatsApp</th><th>Tipe</th><th></th></tr></thead><tbody>' +
      rows.map(function (c) { return '<tr><td>' + Utils.escapeHtml(c.name) + '</td><td>' + Utils.escapeHtml(c.whatsapp || '-') + '</td><td>' + Utils.escapeHtml(c.type) + '</td><td><button class="btn btn-outline btn-sm" data-edit="' + c.customer_id + '">Edit</button></td></tr>'; }).join('') +
      '</tbody></table></div>';
    Utils.qsa('[data-edit]', box).forEach(function (b) { b.addEventListener('click', function () { openForm(rows.filter(function (r) { return r.customer_id === b.getAttribute('data-edit'); })[0]); }); });
  }
  function openForm(c) {
    var isEdit = !!c; c = c || {};
    var m = Utils.openModal('<h3>' + (isEdit ? 'Edit Pelanggan' : 'Pelanggan Baru') + '</h3><form id="f">' +
      '<div class="field"><label>Nama</label><input name="name" value="' + Utils.escapeHtml(c.name || '') + '" required></div>' +
      '<div class="field"><label>WhatsApp</label><input name="whatsapp" value="' + Utils.escapeHtml(c.whatsapp || '') + '"></div>' +
      '<div class="field"><label>Alamat</label><input name="address" value="' + Utils.escapeHtml(c.address || '') + '"></div>' +
      '<div class="field"><label>Tipe</label><select name="type"><option value="REGULAR"' + (c.type === 'REGULAR' ? ' selected' : '') + '>Regular</option><option value="GROSIR"' + (c.type === 'GROSIR' ? ' selected' : '') + '>Grosir</option></select></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = Object.fromEntries(new FormData(e.target).entries());
      if (isEdit) payload.customer_id = c.customer_id;
      Api.call(isEdit ? 'customer.update' : 'customer.create', payload).then(function () {
        Utils.toast('Tersimpan.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }
  return { render: render };
})();
