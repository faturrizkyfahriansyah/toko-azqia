/**
 * internal/suppliers.js - Supplier: daftar ringkas + cari, ketuk untuk ubah, tombol WhatsApp/Telepon.
 */
window.Modules = window.Modules || {};
Modules.suppliers = (function () {
  function render(container) {
    return Api.call('supplier.list', {}).then(function (d) {
      if (!container.isConnected) return;
      var rows = d.suppliers || [];
      container.innerHTML = '<div class="row"><h1 class="page-title" style="margin:0;">Supplier</h1><button class="btn btn-primary" id="btn-add">+ Supplier</button></div>' +
        '<div class="search-box" style="margin-top:12px;"><input id="s-q" type="search" placeholder="Cari supplier" autocomplete="off"></div><div id="list"></div>';
      function draw() {
        var q = container.querySelector('#s-q').value.trim().toLowerCase();
        var f = rows.filter(function (s) { return !q || String(s.name).toLowerCase().indexOf(q) !== -1 || String(s.contact || '').toLowerCase().indexOf(q) !== -1; });
        var box = container.querySelector('#list');
        if (!f.length) { box.innerHTML = '<div class="empty-state"><div class="empty-title">' + (rows.length ? 'Tidak ditemukan' : 'Belum ada supplier') + '</div></div>'; return; }
        box.innerHTML = '<div class="lcard">' + f.map(function (s) {
          var wa = s.whatsapp && window.Utils.waLink ? Utils.waLink(s.whatsapp) : '';
          return '<div class="lrow" data-s="' + s.supplier_id + '" style="cursor:pointer;"><div class="lr-main"><div class="lr-name">' + Utils.escapeHtml(s.name) + '</div><div class="lr-sub">' + Utils.escapeHtml([s.contact, s.phone].filter(Boolean).join(' &middot; ') || 'Belum ada kontak') + '</div></div>' +
            (wa ? '<a class="btn btn-outline btn-sm" href="' + Utils.escapeHtml(wa) + '" target="_blank" rel="noopener" data-wa>WA</a>' : '') + '</div>';
        }).join('') + '</div>';
        Utils.qsa('[data-s]', box).forEach(function (r) { r.addEventListener('click', function (e) { if (e.target.closest('[data-wa]')) return; openForm(rows.filter(function (x) { return x.supplier_id === r.getAttribute('data-s'); })[0]); }); });
      }
      container.querySelector('#s-q').addEventListener('input', Utils.debounce(draw, 140));
      container.querySelector('#btn-add').addEventListener('click', function () { openForm(); });
      draw();
    });
  }
  function openForm(s) {
    var isEdit = !!s; s = s || {};
    var m = Utils.openModal('<h3>' + (isEdit ? 'Ubah Supplier' : 'Supplier Baru') + '</h3><form id="f">' +
      field('name', 'Nama', s.name, true) + field('contact', 'Nama kontak', s.contact) + field('phone', 'Telepon', s.phone, false, 'tel') + field('whatsapp', 'WhatsApp', s.whatsapp, false, 'tel') + field('address', 'Alamat', s.address) +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = Object.fromEntries(new FormData(e.target).entries());
      if (isEdit) payload.supplier_id = s.supplier_id;
      Api.call(isEdit ? 'supplier.update' : 'supplier.create', payload).then(function () { Utils.toast('Tersimpan.', 'success'); Utils.closeModal(); Router.render(); }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }
  function field(name, label, value, req, mode) {
    return '<div class="field"><label>' + label + '</label><input name="' + name + '" value="' + Utils.escapeHtml(value || '') + '"' + (req ? ' required' : '') + (mode ? ' inputmode="' + mode + '"' : '') + '></div>';
  }
  return { render: render };
})();
