/**
 * internal/products.js - Master Produk.
 */
window.Modules = window.Modules || {};
Modules.products = (function () {
  var categories = [], units = [];

  function render(container) {
    return Promise.all([Api.call('category.list', {}), Api.call('unit.list', {}), Api.call('product.list', {})]).then(function (r) {
      if (!container.isConnected) return;
      categories = r[0].categories; units = r[1].units;
      container.innerHTML =
        '<div class="row"><h1>Produk</h1><button class="btn btn-primary" id="btn-add-product">+ Produk Baru</button></div>' +
        '<div class="search-box"><input id="product-search" placeholder="Cari produk..."></div>' +
        '<div id="product-list"></div>';
      renderList(r[2].products);
      document.getElementById('btn-add-product').addEventListener('click', function () { openForm(); });
      document.getElementById('product-search').addEventListener('input', Utils.debounce(function (e) {
        Api.call('product.list', { search: e.target.value }).then(function (d) {
          if (document.getElementById('product-list')) renderList(d.products);
        });
      }, 280));
    });
  }

  function renderList(products) {
    var box = document.getElementById('product-list');
    if (products.length === 0) { box.innerHTML = '<div class="empty-state">Belum ada produk.</div>'; return; }
    box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Produk</th><th>Stok</th><th>Harga Jual</th><th>Status</th><th></th></tr></thead><tbody>' +
      products.map(function (p) {
        var available = Number(p.current_stock) - Number(p.reserved_stock);
        var low = available <= Number(p.minimum_stock);
        return '<tr><td>' + Utils.escapeHtml(p.product_name) + '<div class="muted">' + Utils.escapeHtml(p.sku) + '</div></td>' +
          '<td>' + available + (low ? ' <span class="badge gold">Menipis</span>' : '') + '</td>' +
          '<td>' + Utils.formatCurrency(p.selling_price) + '</td>' +
          '<td>' + (String(p.active) === 'true' || p.active === true ? '<span class="badge green">Aktif</span>' : '<span class="badge grey">Nonaktif</span>') + '</td>' +
          '<td><button class="btn btn-outline btn-sm" data-edit="' + p.product_id + '">Edit</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    Utils.qsa('[data-edit]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = products.filter(function (x) { return x.product_id === b.getAttribute('data-edit'); })[0];
        openForm(p);
      });
    });
  }

  function optionsHtml(list, idField, nameField, selected) {
    return list.map(function (x) { return '<option value="' + x[idField] + '"' + (x[idField] === selected ? ' selected' : '') + '>' + Utils.escapeHtml(x[nameField]) + '</option>'; }).join('');
  }

  function openForm(p) {
    var isEdit = !!p;
    p = p || {};
    var m = Utils.openModal(
      '<h3>' + (isEdit ? 'Edit Produk' : 'Produk Baru') + '</h3>' +
      '<form id="product-form">' +
      '<div class="field-row"><div class="field"><label>SKU</label><input name="sku" value="' + Utils.escapeHtml(p.sku || '') + '" required></div>' +
      '<div class="field"><label>Barcode</label><input name="barcode" value="' + Utils.escapeHtml(p.barcode || '') + '"></div></div>' +
      '<div class="field"><label>Nama Produk</label><input name="product_name" value="' + Utils.escapeHtml(p.product_name || '') + '" required></div>' +
      '<div class="field-row"><div class="field"><label>Kategori</label><select name="category_id">' + optionsHtml(categories, 'category_id', 'category_name', p.category_id) + '</select></div>' +
      '<div class="field"><label>Satuan</label><select name="unit_id">' + optionsHtml(units, 'unit_id', 'unit_name', p.unit_id) + '</select></div></div>' +
      '<div class="field-row"><div class="field"><label>Harga Beli</label><input name="purchase_price" type="number" value="' + (p.purchase_price || 0) + '"></div>' +
      '<div class="field"><label>Harga Jual</label><input name="selling_price" type="number" value="' + (p.selling_price || 0) + '" required></div></div>' +
      '<div class="field"><label>Stok Minimum</label><input name="minimum_stock" type="number" value="' + (p.minimum_stock || 0) + '"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button>' +
      (isEdit ? '<button class="btn btn-outline btn-block" type="button" id="btn-deactivate" style="margin-top:8px;">Nonaktifkan Produk</button>' : '') +
      '</form>'
    );
    m.querySelector('#product-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      if (isEdit) payload.product_id = p.product_id;
      var action = isEdit ? 'product.update' : 'product.create';
      Api.call(action, payload).then(function () {
        Utils.toast('Produk disimpan.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
    var deactivateBtn = m.querySelector('#btn-deactivate');
    if (deactivateBtn) deactivateBtn.addEventListener('click', function () {
      Api.call('product.deactivate', { product_id: p.product_id }).then(function () {
        Utils.toast('Produk dinonaktifkan.', 'success'); Utils.closeModal(); Router.render();
      });
    });
  }

  return { render: render };
})();
