/**
 * internal/products.js - Master Produk. SKU dibuat OTOMATIS oleh sistem (bukan input manual).
 * Barcode internal dibuat otomatis jika produk tidak punya barcode pabrik. Satuan tambahan
 * (mis. 1 DUS = 40 PCS) dikelola lewat tombol "Kelola Satuan" pada tiap produk.
 */
window.Modules = window.Modules || {};
Modules.products = (function () {
  var categories = [], units = [];
  var lastProducts = [];

  function render(container) {
    return Promise.all([Api.call('category.list', {}), Api.call('unit.list', {}), Api.call('product.list', {})]).then(function (r) {
      if (!container.isConnected) return;
      categories = r[0].categories; units = r[1].units;
      container.innerHTML =
        '<div class="row"><h1>Produk</h1><button class="btn btn-primary" id="btn-add-product">+ Tambah Produk</button></div>' +
        '<div class="search-box"><input id="product-search" placeholder="Cari produk"></div>' +
        '<div class="filter-row">' +
        '<select id="filter-category"><option value="">Semua Kategori</option>' + categories.map(function (c) { return '<option value="' + c.category_id + '">' + Utils.escapeHtml(c.category_name) + '</option>'; }).join('') + '</select>' +
        '<select id="filter-status"><option value="">Semua Status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select>' +
        '<select id="filter-stock"><option value="">Semua Stok</option><option value="low">Stok Menipis</option><option value="out">Stok Habis</option></select>' +
        '</div>' +
        '<div id="product-list" class="responsive-data"></div>';
      renderList(r[2].products);
      document.getElementById('btn-add-product').addEventListener('click', function () { openForm(); });

      var reload = Utils.debounce(function () {
        var params = { search: document.getElementById('product-search').value, category_id: document.getElementById('filter-category').value };
        Api.call('product.list', params).then(function (d) {
          if (!document.getElementById('product-list')) return;
          renderList(applyLocalFilters(d.products));
        });
      }, 260);
      document.getElementById('product-search').addEventListener('input', reload);
      document.getElementById('filter-category').addEventListener('change', reload);
      document.getElementById('filter-status').addEventListener('change', reload);
      document.getElementById('filter-stock').addEventListener('change', reload);
    });
  }

  function applyLocalFilters(products) {
    var status = document.getElementById('filter-status').value;
    var stock = document.getElementById('filter-stock').value;
    return products.filter(function (p) {
      var active = String(p.active) === 'true' || p.active === true;
      if (status === 'active' && !active) return false;
      if (status === 'inactive' && active) return false;
      var available = Number(p.current_stock) - Number(p.reserved_stock);
      if (stock === 'low' && !(available > 0 && available <= Number(p.minimum_stock))) return false;
      if (stock === 'out' && available > 0) return false;
      return true;
    });
  }

  function renderList(products) {
    lastProducts = products;
    var box = document.getElementById('product-list');
    if (products.length === 0) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Belum ada produk</div><div class="empty-sub">Klik "+ Tambah Produk" untuk mulai.</div></div>'; return; }

    var statusBadge = function (p) { return (String(p.active) === 'true' || p.active === true) ? '<span class="badge green">Aktif</span>' : '<span class="badge grey">Nonaktif</span>'; };
    var stockBadge = function (available, min) { return available <= 0 ? ' <span class="badge red">Habis</span>' : (available <= min ? ' <span class="badge gold">Menipis</span>' : ''); };

    var tableHtml = '<div class="table-wrap"><table><thead><tr><th>Produk</th><th>SKU</th><th>Harga</th><th>Stok</th><th>Status</th><th></th></tr></thead><tbody>' +
      products.map(function (p) {
        var available = Number(p.current_stock) - Number(p.reserved_stock);
        return '<tr><td>' + Utils.escapeHtml(p.product_name) + '</td><td class="muted">' + Utils.escapeHtml(p.sku) + '</td>' +
          '<td>' + Utils.formatCurrency(p.selling_price) + '</td><td>' + available + stockBadge(available, Number(p.minimum_stock)) + '</td>' +
          '<td>' + statusBadge(p) + '</td><td><button class="btn btn-outline btn-sm" data-edit="' + p.product_id + '">Edit</button></td></tr>';
      }).join('') + '</tbody></table></div>';

    var listHtml = '<div class="mobile-list">' + products.map(function (p) {
      var available = Number(p.current_stock) - Number(p.reserved_stock);
      return '<div class="data-row" data-edit="' + p.product_id + '" style="cursor:pointer;">' +
        '<div class="main"><div class="title">' + Utils.escapeHtml(p.product_name) + '</div><div class="sub">' + Utils.escapeHtml(p.sku) + ' &middot; Stok ' + available + stockBadge(available, Number(p.minimum_stock)) + '</div></div>' +
        '<div class="end"><div class="amount">' + Utils.formatCurrency(p.selling_price) + '</div>' + statusBadge(p) + '</div></div>';
    }).join('') + '</div>';

    box.innerHTML = tableHtml + listHtml;
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
      (isEdit ? '<p class="muted">SKU: <strong>' + Utils.escapeHtml(p.sku) + '</strong> (dibuat otomatis, tidak bisa diubah)</p>' :
        '<p class="hint">SKU akan dibuat otomatis oleh sistem berdasarkan kategori (mis. SEM-001) setelah disimpan.</p>') +
      '<form id="product-form">' +
      '<div class="field"><label>Nama Produk</label><input name="product_name" value="' + Utils.escapeHtml(p.product_name || '') + '" required></div>' +
      '<div class="field-row"><div class="field"><label>Kategori <a href="#" id="btn-new-category" style="font-weight:400;">+ baru</a></label><select name="category_id">' + optionsHtml(categories, 'category_id', 'category_name', p.category_id) + '</select></div>' +
      '<div class="field"><label>Satuan Utama</label><select name="unit_id"' + (isEdit ? '' : '') + '>' + optionsHtml(units, 'unit_id', 'unit_name', p.unit_id) + '</select></div></div>' +
      '<div class="field"><label>Barcode (kosongkan jika tidak ada - akan dibuat otomatis)</label><input name="barcode" value="' + Utils.escapeHtml(p.barcode || '') + '" placeholder="Scan/ketik barcode pabrik, atau kosongkan"></div>' +
      '<div class="field-row"><div class="field"><label>Harga Beli</label><input name="purchase_price" type="number" value="' + (p.purchase_price || 0) + '"></div>' +
      '<div class="field"><label>Harga Jual</label><input name="selling_price" type="number" value="' + (p.selling_price || 0) + '" required></div></div>' +
      '<div class="field"><label>Stok Minimum</label><input name="minimum_stock" type="number" value="' + (p.minimum_stock || 0) + '"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Simpan</button></form>' +
      (isEdit ? '<div class="field-row" style="margin-top:8px;">' +
        '<button class="btn btn-outline btn-block" type="button" id="btn-units">Kelola Satuan</button>' +
        '<button class="btn btn-outline btn-block" type="button" id="btn-barcode">Cetak Barcode</button>' +
        '</div><button class="btn btn-ghost btn-block" type="button" id="btn-deactivate" style="margin-top:8px;color:var(--red);">Nonaktifkan Produk</button>' : '')
    );
    m.querySelector('#product-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      if (isEdit) payload.product_id = p.product_id;
      var action = isEdit ? 'product.update' : 'product.create';
      Api.call(action, payload).then(function (result) {
        Utils.toast(isEdit ? 'Produk disimpan.' : ('Produk disimpan. SKU: ' + result.sku), 'success');
        Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
    var deactivateBtn = m.querySelector('#btn-deactivate');
    if (deactivateBtn) deactivateBtn.addEventListener('click', function () {
      if (!confirm('Nonaktifkan produk ini? Produk akan hilang dari Kasir dan Katalog online.')) return;
      Api.call('product.deactivate', { product_id: p.product_id }).then(function () {
        Utils.toast('Produk dinonaktifkan.', 'success'); Utils.closeModal(); Router.render();
      });
    });
    var unitsBtn = m.querySelector('#btn-units');
    if (unitsBtn) unitsBtn.addEventListener('click', function () { openUnitsManager(p); });
    var barcodeBtn = m.querySelector('#btn-barcode');
    if (barcodeBtn) barcodeBtn.addEventListener('click', function () { openBarcodeLabel(p); });
    var newCatBtn = m.querySelector('#btn-new-category');
    if (newCatBtn) newCatBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var name = prompt('Nama kategori baru:');
      if (!name) return;
      var code = prompt('Kode kategori (2-5 huruf, mis. SUS untuk "Susu"):');
      if (!code) return;
      Api.call('category.create', { category_name: name, code: code }).then(function () {
        return Api.call('category.list', {});
      }).then(function (cd) {
        categories = cd.categories;
        Utils.toast('Kategori ditambahkan.', 'success'); Utils.closeModal(); openForm(isEdit ? p : null);
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  function openUnitsManager(p) {
    Api.call('productUnit.list', { product_id: p.product_id }).then(function (d) {
      var baseUnit = units.filter(function (u) { return u.unit_id === p.unit_id; })[0];
      var baseUnitName = baseUnit ? baseUnit.unit_name : '';
      var m = Utils.openModal(
        '<h3>Satuan Produk: ' + Utils.escapeHtml(p.product_name) + '</h3>' +
        '<div id="units-list">' + d.product_units.map(function (pu) {
          var isBase = String(pu.is_base) === 'true' || pu.is_base === true;
          return '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border);">' +
            '<span>' + Utils.escapeHtml(pu.unit_name) + (isBase ? ' <span class="badge blue">Utama</span>' : ' = ' + pu.conversion_to_base + ' ' + Utils.escapeHtml(baseUnitName)) + '</span>' +
            '<span>' + (pu.selling_price ? Utils.formatCurrency(pu.selling_price) : '<span class="muted">otomatis</span>') + '</span></div>';
        }).join('') + '</div>' +
        '<div class="divider"></div><h3>Tambah Satuan Alternatif</h3>' +
        '<div class="field"><label>Satuan</label><select id="alt-unit">' + optionsHtml(units, 'unit_id', 'unit_name') + '</select></div>' +
        '<div class="field-row"><div class="field"><label>1 Satuan Ini = Berapa Satuan Utama?</label><input id="alt-conversion" type="number" min="1" placeholder="mis. 10"></div>' +
        '<div class="field"><label>Harga Jual (opsional)</label><input id="alt-price" type="number" placeholder="Kosongkan = otomatis"></div></div>' +
        '<button class="btn btn-primary btn-block" id="alt-add">Tambah Satuan</button>'
      );
      m.querySelector('#alt-add').addEventListener('click', function () {
        var unitId = m.querySelector('#alt-unit').value;
        var conversion = m.querySelector('#alt-conversion').value;
        var price = m.querySelector('#alt-price').value;
        if (!conversion || Number(conversion) <= 0) { Utils.toast('Isi nilai konversi yang benar.', 'error'); return; }
        Api.call('productUnit.create', { product_id: p.product_id, unit_id: unitId, conversion_to_base: conversion, selling_price: price }).then(function () {
          Utils.toast('Satuan ditambahkan.', 'success'); Utils.closeModal(); openUnitsManager(p);
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }

  function openBarcodeLabel(p) {
    var m = Utils.openModal(
      '<h3>Label Barcode</h3>' +
      '<div style="text-align:center;padding:10px;border:1px dashed var(--border);border-radius:8px;">' +
      '<div style="font-weight:700;">' + Utils.escapeHtml(p.product_name) + '</div>' +
      '<div class="muted">' + Utils.escapeHtml(p.sku) + ' &middot; ' + Utils.formatCurrency(p.selling_price) + '</div>' +
      '<svg id="barcode-svg" style="margin-top:8px;"></svg></div>' +
      '<div class="field-row" style="margin-top:12px;">' +
      '<button class="btn btn-primary btn-block" id="btn-print-label">Cetak Label</button>' +
      '<button class="btn btn-outline btn-block" id="btn-regen">Buat Ulang Barcode</button>' +
      '</div>'
    );
    window.BarcodeTools.renderTo(m.querySelector('#barcode-svg'), p.barcode || p.sku).catch(function (err) { Utils.toast(err.message, 'error'); });
    m.querySelector('#btn-print-label').addEventListener('click', function () {
      var win = window.open('', 'PRINT_LABEL', 'height=300,width=300');
      win.document.write('<html><head><title>Label</title></head><body style="text-align:center;font-family:sans-serif;">' + m.querySelector('div[style*="dashed"]').innerHTML + '</body></html>');
      win.document.close(); win.focus();
      setTimeout(function () { win.print(); }, 400);
    });
    m.querySelector('#btn-regen').addEventListener('click', function () {
      if (!confirm('Buat barcode internal baru untuk produk ini? Barcode lama tidak berlaku lagi.')) return;
      Api.call('product.regenerateBarcode', { product_id: p.product_id }).then(function (r) {
        p.barcode = r.barcode;
        Utils.toast('Barcode baru dibuat: ' + r.barcode, 'success');
        window.BarcodeTools.renderTo(m.querySelector('#barcode-svg'), r.barcode);
      });
    });
  }

  return { render: render };
})();
