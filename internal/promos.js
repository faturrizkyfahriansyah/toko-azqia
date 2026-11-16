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
      container.innerHTML = '<div class="row"><h1 class="page-title" style="margin:0;">Promo</h1><button class="btn btn-primary" id="btn-add">+ Promo</button></div><div id="list" style="margin-top:12px;"></div>';
      renderList(r[0].promos);
      document.getElementById('btn-add').addEventListener('click', openForm);
    });
  }

  function renderList(rows) {
    var box = document.getElementById('list');
    if (rows.length === 0) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Belum ada promo</div><div class="empty-sub">Ketuk "+ Promo" untuk membuat diskon pertama.</div></div>'; return; }
    box.innerHTML = '<div class="card" style="padding-top:2px;padding-bottom:2px;">' + rows.map(function (p) {
      var typeLabel = { PERCENTAGE: p.value + '%', NOMINAL: Utils.formatCurrency(p.value) + ' off', SPECIAL_PRICE: 'Harga ' + Utils.formatCurrency(p.value), QTY_BASED: 'Min ' + p.min_qty + ' pcs' }[p.type] || p.type;
      var active = String(p.active) === 'true' || p.active === true;
      return '<div class="switch-row"><div><div class="sw-title">' + Utils.escapeHtml(p.name) + '</div><div class="sw-sub">' + typeLabel + ' &middot; ' + Utils.formatDateOnly(p.start_date) + ' - ' + Utils.formatDateOnly(p.end_date) + '</div></div>' +
        '<label class="switch"><input type="checkbox" data-toggle="' + p.promo_id + '"' + (active ? ' checked' : '') + '><span class="slider"></span></label></div>';
    }).join('') + '</div>';
    Utils.qsa('[data-toggle]', box).forEach(function (c) {
      c.addEventListener('change', function () {
        Api.call('promo.update', { promo_id: c.getAttribute('data-toggle'), active: c.checked }).then(function () { Utils.toast(c.checked ? 'Promo diaktifkan.' : 'Promo dinonaktifkan.', 'success'); })
          .catch(function (err) { c.checked = !c.checked; Utils.toast(err.message, 'error'); });
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
