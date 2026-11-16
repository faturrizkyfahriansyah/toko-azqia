/**
 * internal/customers.js - Pelanggan: daftar ringkas + cari + filter tipe, ketuk untuk ubah.
 */
window.Modules = window.Modules || {};
Modules.customers = (function () {
  function render(container) {
    return Api.call('customer.list', {}).then(function (d) {
      if (!container.isConnected) return;
      var rows = d.customers || [], type = '';
      container.innerHTML = '<div class="row"><h1 class="page-title" style="margin:0;">Pelanggan</h1><button class="btn btn-primary" id="btn-add">+ Pelanggan</button></div>' +
        '<div class="search-box" style="margin-top:12px;"><input id="c-q" type="search" placeholder="Cari nama atau nomor" autocomplete="off"></div>' +
        '<div class="seg seg-full" id="c-type"><button type="button" class="on" data-t="">Semua</button><button type="button" data-t="REGULAR">Regular</button><button type="button" data-t="GROSIR">Grosir</button></div><div id="list" style="margin-top:12px;"></div>';
      function draw() {
        var q = container.querySelector('#c-q').value.trim().toLowerCase();
        var f = rows.filter(function (c) { return (!type || c.type === type) && (!q || String(c.name).toLowerCase().indexOf(q) !== -1 || String(c.whatsapp || '').indexOf(q) !== -1); });
        var box = container.querySelector('#list');
        if (!f.length) { box.innerHTML = '<div class="empty-state"><div class="empty-title">' + (rows.length ? 'Tidak ditemukan' : 'Belum ada pelanggan') + '</div></div>'; return; }
        box.innerHTML = '<div class="lcard">' + f.map(function (c) {
          return '<div class="lrow" data-c="' + c.customer_id + '" style="cursor:pointer;"><div class="lr-main"><div class="lr-name">' + Utils.escapeHtml(c.name) + '</div><div class="lr-sub">' + Utils.escapeHtml(c.whatsapp || 'Tanpa nomor') + '</div></div><span class="badge ' + (c.type === 'GROSIR' ? 'gold' : 'grey') + '">' + (c.type === 'GROSIR' ? 'Grosir' : 'Regular') + '</span></div>';
        }).join('') + '</div>';
        Utils.qsa('[data-c]', box).forEach(function (r) { r.addEventListener('click', function () { openForm(rows.filter(function (x) { return x.customer_id === r.getAttribute('data-c'); })[0]); }); });
      }
      container.querySelector('#c-q').addEventListener('input', Utils.debounce(draw, 140));
      Utils.qsa('#c-type [data-t]', container).forEach(function (b) { b.addEventListener('click', function () { type = b.getAttribute('data-t'); Utils.qsa('#c-type [data-t]', container).forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }); });
      container.querySelector('#btn-add').addEventListener('click', function () { openForm(); });
      draw();
    });
  }
  function openForm(c) {
    var isEdit = !!c; c = c || {};
    var m = Utils.openModal('<h3>' + (isEdit ? 'Ubah Pelanggan' : 'Pelanggan Baru') + '</h3><form id="f">' +
      '<div class="field"><label>Nama</label><input name="name" value="' + Utils.escapeHtml(c.name || '') + '" required></div>' +
      '<div class="field"><label>WhatsApp</label><input name="whatsapp" inputmode="tel" value="' + Utils.escapeHtml(c.whatsapp || '') + '"></div>' +
      '<div class="field"><label>Alamat</label><input name="address" value="' + Utils.escapeHtml(c.address || '') + '"></div>' +
      '<div class="field"><label>Tipe</label><select name="type"><option value="REGULAR"' + (c.type === 'REGULAR' ? ' selected' : '') + '>Regular</option><option value="GROSIR"' + (c.type === 'GROSIR' ? ' selected' : '') + '>Grosir (harga grosir)</option></select></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');
    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = Object.fromEntries(new FormData(e.target).entries());
      if (isEdit) payload.customer_id = c.customer_id;
      Api.call(isEdit ? 'customer.update' : 'customer.create', payload).then(function () { Utils.toast('Tersimpan.', 'success'); Utils.closeModal(); Router.render(); }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }
  return { render: render };
})();
