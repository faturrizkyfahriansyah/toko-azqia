/**
 * internal/promos.js - Promo: persentase, nominal, harga khusus, atau berbasis qty.
 * Otomatis diterapkan di Kasir & Toko Online (dihitung backend, bukan frontend).
 */
window.Modules = window.Modules || {};
Modules.promos = (function () {
  var categories = [], products = [];

  function render(container) {
    return Promise.all([Api.call('promo.list', {}), Api.call('category.list', {}), Api.call('product.list', { activeOnly: true })]).then(function (r) {
      if (!container.isConnected) return;
      categories = r[1].categories; products = r[2].products;
      container.innerHTML = '<div class="row"><h1>Promo</h1><button class="btn btn-primary" id="btn-add">+ Promo Baru</button></div><div id="list"></div>';
      renderList(r[0].promos);
      document.getElementById('btn-add').addEventListener('click', openForm);
    });
  }

  function renderList(rows) {
    var box = document.getElementById('list');
    if (rows.length === 0) { box.innerHTML = '<div class="empty-state">Belum ada promo.</div>'; return; }
    box.innerHTML = rows.map(function (p) {
      var typeLabel = { PERCENTAGE: p.value + '%', NOMINAL: Utils.formatCurrency(p.value) + ' off', SPECIAL_PRICE: 'Harga ' + Utils.formatCurrency(p.value), QTY_BASED: 'Min ' + p.min_qty + ' pcs' }[p.type] || p.type;
      var active = String(p.active) === 'true' || p.active === true;
      return '<div class="card"><div class="row"><strong>' + Utils.escapeHtml(p.name) + '</strong>' + (active ? '<span class="badge green">Aktif</span>' : '<span class="badge grey">Nonaktif</span>') + '</div>' +
        '<div class="muted">' + typeLabel + ' &middot; ' + Utils.formatDateOnly(p.start_date) + ' - ' + Utils.formatDateOnly(p.end_date) + '</div>' +
        '<button class="btn btn-outline btn-sm" style="margin-top:6px;" data-toggle="' + p.promo_id + '" data-active="' + active + '">' + (active ? 'Nonaktifkan' : 'Aktifkan') + '</button></div>';
    }).join('');
    Utils.qsa('[data-toggle]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        Api.call('promo.update', { promo_id: b.getAttribute('data-toggle'), active: b.getAttribute('data-active') !== 'true' }).then(function () {
          Utils.toast('Promo diperbarui.', 'success'); Router.render();
        });
      });
    });
  }

  function openForm() {
    var m = Utils.openModal('<h3>Promo Baru</h3><form id="f">' +
      '<div class="field"><label>Nama Promo</label><input name="name" required></div>' +
      '<div class="field"><label>Tipe</label><select name="type" id="promo-type"><option value="PERCENTAGE">Persentase (%)</option><option value="NOMINAL">Potongan Nominal (Rp)</option><option value="SPECIAL_PRICE">Harga Khusus (Rp)</option><option value="QTY_BASED">Berdasarkan Qty Minimal</option></select></div>' +
      '<div class="field" id="value-field"><label>Nilai</label><input name="value" type="number" required></div>' +
      '<div class="field" id="qty-field" style="display:none;"><label>Qty Minimal</label><input name="min_qty" type="number" value="2"></div>' +
      '<div class="field"><label>Berlaku Untuk</label><select name="applies_to" id="promo-applies"><option value="ALL">Semua Produk</option><option value="CATEGORY">Kategori Tertentu</option><option value="PRODUCT">Produk Tertentu</option></select></div>' +
      '<div class="field" id="target-field" style="display:none;"><label>Target</label><select name="target_id"></select></div>' +
      '<div class="field-row"><div class="field"><label>Mulai</label><input name="start_date" type="date" required></div><div class="field"><label>Berakhir</label><input name="end_date" type="date" required></div></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>');

    var typeSel = m.querySelector('#promo-type');
    var appliesSel = m.querySelector('#promo-applies');
    function updateFields() {
      m.querySelector('#qty-field').style.display = typeSel.value === 'QTY_BASED' ? 'block' : 'none';
      m.querySelector('#value-field').style.display = typeSel.value === 'QTY_BASED' ? 'none' : 'block';
      var targetField = m.querySelector('#target-field');
      if (appliesSel.value === 'ALL') { targetField.style.display = 'none'; }
      else {
        targetField.style.display = 'block';
        var list = appliesSel.value === 'CATEGORY' ? categories : products;
        var nameField = appliesSel.value === 'CATEGORY' ? 'category_name' : 'product_name';
        var idField = appliesSel.value === 'CATEGORY' ? 'category_id' : 'product_id';
        targetField.querySelector('select').innerHTML = list.map(function (x) { return '<option value="' + x[idField] + '">' + Utils.escapeHtml(x[nameField]) + '</option>'; }).join('');
      }
    }
    typeSel.addEventListener('change', updateFields);
    appliesSel.addEventListener('change', updateFields);
    updateFields();

    m.querySelector('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      if (fd.type === 'QTY_BASED') { fd.qty_discount_type = 'PERCENTAGE'; fd.qty_discount_value = fd.value || 10; }
      Api.call('promo.create', fd).then(function () {
        Utils.toast('Promo dibuat.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
