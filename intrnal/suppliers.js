/**
 * internal/suppliers.js
 */
window.Modules = window.Modules || {};
Modules.suppliers = (function () {
  function render(container) {
    return Api.call('supplier.list', {}).then(function (d) {
      container.innerHTML = '<div class="row"><h1>Supplier</h1><button class="btn btn-primary" id="btn-add">+ Supplier</button></div><div id="list"></div>';
      renderList(d.suppliers);
      document.getElementById('btn-add').addEventListener('click', function () { openForm(); });
    });
  }
  function renderList(rows) {
    var box = document.getElementById('list');
    if (rows.length === 0) { box.innerHTML = '<div class="empty-state">Belum ada supplier.</div>'; return; }
    box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kontak</th><th>Telepon</th><th></th></tr></thead><tbody>' +
      rows.map(function (s) { return '<tr><td>' + Utils.escapeHtml(s.name) + '</td><td>' + Utils.escapeHtml(s.contact || '-') + '</td><td>' + Utils.escapeHtml(s.phone || '-') + '</td><td><button class="btn btn-outline btn-sm" data-edit="' + s.supplier_id + '">Edit</button></td></tr>'; }).join('') +
      '</tbody></table></div>';
    Utils.qsa('[data-edit]', box).forEach(function (b) { b.addEventListener('click', function () { openForm(rows.filter(function (r) { return r.supplier_id === b.getAttribute('data-edit'); })[0]); }); });
  }
  function openForm(s) {
    var isEdit = !!s; s = s || {};
    var m = Utils.openModal('<h3>' + (isEdit ? 'Edit Supplier' : 'Supplier Baru') + '</h3><form id="f">' +
      field('name', 'Nama', s.name) + field('contact', 'Nama Kontak', s.contact) + field('phone', 'Telepon', s.phone) +
      field('whatsapp', 'WhatsApp', s.whatsapp) + field('address', 'Alamat', s.address) +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = Object.fromEntries(new FormData(e.target).entries());
      if (isEdit) payload.supplier_id = s.supplier_id;
      Api.call(isEdit ? 'supplier.update' : 'supplier.create', payload).then(function () {
        Utils.toast('Tersimpan.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }
  function field(name, label, value) {
    return '<div class="field"><label>' + label + '</label><input name="' + name + '" value="' + Utils.escapeHtml(value || '') + '"></div>';
  }
  return { render: render };
})();
