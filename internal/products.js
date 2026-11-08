/**
 * internal/products.js - Master Produk. SKU dibuat OTOMATIS oleh sistem (bukan input manual).
 * Barcode internal dibuat otomatis jika produk tidak punya barcode pabrik. Satuan tambahan
 * (mis. 1 DUS = 40 PCS) dikelola lewat tombol "Kelola Satuan" pada tiap produk.
 */
window.Modules = window.Modules || {};
Modules.products = (function () {
  var categories = [], units = [];
  var lastProducts = [];
  // Kategori standar (sesuai tampilan Kasir). Dibuat lewat tombol di halaman Produk - hanya yang BELUM ada.
  var STANDARD_CATS = [
    { name: 'Makanan Segar & Beku', code: 'SGR' }, { name: 'Bahan Pokok', code: 'BPK' }, { name: 'Telur & Olahan Susu', code: 'TLR' },
    { name: 'Roti & Snack', code: 'RTS' }, { name: 'Minuman', code: 'MIN' }, { name: 'Perawatan & Kecantikan', code: 'PRK' },
    { name: 'Perlengkapan Rumah', code: 'RUM' }
  ];
  function missingStandardCats() {
    var have = {}; categories.forEach(function (c) { have[String(c.category_name).trim().toLowerCase()] = true; });
    return STANDARD_CATS.filter(function (c) { return !have[c.name.toLowerCase()]; });
  }
  function addStandardCats(cats, done) {
    var made = 0, failed = [];
    cats.reduce(function (p, c) {
      return p.then(function () {
        return Api.call('category.create', { category_name: c.name, code: c.code }).then(function () { made++; }).catch(function () { failed.push(c.name); });
      });
    }, Promise.resolve()).then(function () { done(made, failed); });
  }
  var CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  /** Produk dilacak stoknya? Kolom kosong/true = ya (produk lama), false = tidak (jual langsung). */
  function isManaged(p) { return !(p.manage_stock === false || String(p.manage_stock).toLowerCase() === 'false'); }

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
        '<div id="std-cats"></div>' +
        '<div id="product-list" class="responsive-data"></div>';
      renderStdCatsNotice();
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

  function renderStdCatsNotice() {
    var box = document.getElementById('std-cats');
    if (!box) return;
    var missing = missingStandardCats();
    if (missing.length === 0) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="card" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;">' +
      '<div style="min-width:0;flex:1 1 200px;"><div style="font-weight:700;font-size:0.88rem;">Lengkapi kategori toko</div>' +
      '<div class="muted" style="font-size:0.76rem;">Tambah ' + missing.length + ' kategori standar (' + missing.slice(0, 3).map(function (c) { return Utils.escapeHtml(c.name); }).join(', ') + (missing.length > 3 ? ', ...' : '') + ') agar Kasir lebih rapi. Produk lama tidak berubah.</div></div>' +
      '<button class="btn btn-outline btn-sm" id="btn-std-cats">Tambah</button></div>';
    box.querySelector('#btn-std-cats').addEventListener('click', function (e) {
      var btn = e.target; btn.disabled = true; btn.textContent = 'Menambah...';
      addStandardCats(missing, function (made, failed) {
        Api.call('category.list', {}).then(function (cd) { categories = cd.categories; renderStdCatsNotice(); });
        Utils.toast(made + ' kategori ditambahkan.' + (failed.length ? ' Gagal: ' + failed.join(', ') + ' (kode mungkin sudah dipakai).' : ''), failed.length ? 'info' : 'success');
      });
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
      if (stock && !isManaged(p)) return false; // produk tanpa manajemen stok tidak ikut filter stok
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
    var stockText = function (p) {
      if (!isManaged(p)) return '<span class="muted">Tanpa stok</span>';
      var available = Number(p.current_stock) - Number(p.reserved_stock);
      return available + stockBadge(available, Number(p.minimum_stock));
    };

    var tableHtml = '<div class="table-wrap"><table><thead><tr><th>Produk</th><th>SKU</th><th>Harga</th><th>Stok</th><th>Status</th><th></th></tr></thead><tbody>' +
      products.map(function (p) {
        return '<tr><td>' + Utils.escapeHtml(p.product_name) + '</td><td class="muted">' + Utils.escapeHtml(p.sku) + '</td>' +
          '<td>' + Utils.formatCurrency(p.selling_price) + '</td><td>' + stockText(p) + '</td>' +
          '<td>' + statusBadge(p) + '</td><td><button class="btn btn-outline btn-sm" data-edit="' + p.product_id + '">Edit</button></td></tr>';
      }).join('') + '</tbody></table></div>';

    var listHtml = '<div class="mobile-list">' + products.map(function (p) {
      return '<div class="data-row" data-edit="' + p.product_id + '" style="cursor:pointer;">' +
        '<div class="main"><div class="title">' + Utils.escapeHtml(p.product_name) + '</div><div class="sub">' + Utils.escapeHtml(p.sku) + ' &middot; ' + (isManaged(p) ? 'Stok ' : '') + stockText(p) + '</div></div>' +
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

  function pickDefault(list, nameField, preferred, idField) {
    var hit = list.filter(function (x) { return preferred.indexOf(String(x[nameField]).toLowerCase()) !== -1; })[0] || list[0];
    return hit ? hit[idField] : '';
  }

  function switchRow(id, title, sub, checked) {
    return '<div class="switch-row"><div><div class="sw-title">' + title + '</div><div class="sw-sub">' + sub + '</div></div>' +
      '<label class="switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span class="slider"></span></label></div>';
  }

  /**
   * Form produk dibuat SEDERHANA: hanya Nama, Harga Beli, Harga Jual yang tampil. Sisanya
   * (kategori, satuan, barcode, manajemen stok, satuan jual lain) ada di "Tampilkan Opsi Lanjutan".
   * Produk baru: Manajemen Stok MATI secara default (jual langsung, tanpa pusing stok).
   */
  function openForm(p) {
    var isEdit = !!p;
    p = p || {};
    var managed = isEdit ? isManaged(p) : false;
    var defaultCat = p.category_id || pickDefault(categories, 'category_name', ['lainnya'], 'category_id');
    var defaultUnit = p.unit_id || pickDefault(units, 'unit_name', ['pcs', 'pc', 'buah'], 'unit_id');
    var m = Utils.openModal(
      '<h3>' + (isEdit ? 'Edit Produk' : 'Tambah Produk') + '</h3>' +
      (isEdit ? '<p class="muted">SKU: <strong>' + Utils.escapeHtml(p.sku) + '</strong> (dibuat otomatis, tidak bisa diubah)</p>' : '') +
      '<form id="product-form" novalidate>' +
      '<div class="field"><label>Nama <span style="color:var(--red);">*</span></label><input name="product_name" value="' + Utils.escapeHtml(p.product_name || '') + '" placeholder="Contoh: Tahu Bulat" required></div>' +
      '<div class="field-row"><div class="field"><label>Harga Beli</label><input name="purchase_price" type="number" inputmode="numeric" min="0" value="' + (p.purchase_price || '') + '" placeholder="Rp0"></div>' +
      '<div class="field"><label>Harga Jual <span style="color:var(--red);">*</span></label><input name="selling_price" type="number" inputmode="numeric" min="0" value="' + (p.selling_price || '') + '" placeholder="Rp0" required></div></div>' +

      '<button type="button" class="disclosure-btn' + (isEdit ? ' open' : '') + '" id="btn-advanced"><span id="adv-label">' + (isEdit ? 'Sembunyikan Opsi Lanjutan' : 'Tampilkan Opsi Lanjutan') + '</span>' + CHEVRON + '</button>' +
      '<div class="disclosure-body' + (isEdit ? ' open' : '') + '" id="advanced">' +

      '<div class="field-row"><div class="field"><label>Kategori <a href="#" id="btn-new-category" style="font-weight:400;">+ baru</a></label><select name="category_id">' + optionsHtml(categories, 'category_id', 'category_name', defaultCat) + '</select></div>' +
      '<div class="field"><label>Satuan Utama</label><select name="unit_id">' + optionsHtml(units, 'unit_id', 'unit_name', defaultUnit) + '</select></div></div>' +
      '<div class="field"><label>Barcode</label><input name="barcode" value="' + Utils.escapeHtml(p.barcode || '') + '" placeholder="Scan/ketik barcode pabrik, kosongkan = dibuat otomatis"></div>' +

      switchRow('sw-stock', 'Manajemen Stok', 'Lacak jumlah stok produk ini. Matikan jika cukup jual langsung.', managed) +
      '<div class="sub-panel" id="stock-fields" style="' + (managed ? '' : 'display:none;') + '">' +
      (isEdit
        ? '<p class="muted" style="margin:0 0 8px;">Stok saat ini: <strong>' + Number(p.current_stock || 0) + '</strong> (ubah lewat menu Stok &rarr; Penyesuaian atau Barang Masuk)</p>'
        : '<div class="field"><label>Stok Awal</label><input name="initial_stock" type="number" inputmode="numeric" min="0" placeholder="0"></div>') +
      '<div class="field" style="margin-bottom:0;"><label>Stok Minimum (peringatan menipis)</label><input name="minimum_stock" type="number" inputmode="numeric" min="0" value="' + (p.minimum_stock || 0) + '"></div>' +
      '</div>' +

      (isEdit ? '' :
        switchRow('sw-alt', 'Satuan Jual Lain', 'Mis. lusin, dus, atau per 10 pcs - bisa dipilih saat di Kasir.', false) +
        '<div class="sub-panel" id="alt-fields" style="display:none;">' +
        '<div class="field"><label>Satuan</label><select id="alt-unit">' + optionsHtml(units, 'unit_id', 'unit_name') + '</select></div>' +
        '<div class="field"><label>1 satuan ini = berapa satuan utama?</label><input id="alt-conversion" type="number" inputmode="numeric" min="1" placeholder="mis. 12">' +
        '<div class="chip-row">' + [6, 10, 12, 24, 40].map(function (n) { return '<button type="button" class="chip" data-conv="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' +
        '<div class="field" style="margin-bottom:0;"><label>Harga Jual Satuan Ini (opsional)</label><input id="alt-price" type="number" inputmode="numeric" min="0" placeholder="Kosong = otomatis"></div>' +
        '</div>') +
      '</div>' +

      '<button class="btn btn-primary btn-block" type="submit" style="margin-top:6px;">Simpan</button></form>' +
      (isEdit ? '<div class="field-row" style="margin-top:8px;">' +
        '<button class="btn btn-outline btn-block" type="button" id="btn-units">Kelola Satuan</button>' +
        '<button class="btn btn-outline btn-block" type="button" id="btn-barcode">Cetak Barcode</button>' +
        '</div><button class="btn btn-ghost btn-block" type="button" id="btn-deactivate" style="margin-top:8px;color:var(--red);">Nonaktifkan Produk</button>' : '')
    );

    var adv = m.querySelector('#advanced'), advBtn = m.querySelector('#btn-advanced'), advLabel = m.querySelector('#adv-label');
    advBtn.addEventListener('click', function () {
      var open = adv.classList.toggle('open');
      advBtn.classList.toggle('open', open);
      advLabel.textContent = open ? 'Sembunyikan Opsi Lanjutan' : 'Tampilkan Opsi Lanjutan';
    });
    var swStock = m.querySelector('#sw-stock'), stockFields = m.querySelector('#stock-fields');
    swStock.addEventListener('change', function () { stockFields.style.display = swStock.checked ? '' : 'none'; });
    var swAlt = m.querySelector('#sw-alt'), altFields = m.querySelector('#alt-fields');
    if (swAlt) swAlt.addEventListener('change', function () { altFields.style.display = swAlt.checked ? '' : 'none'; });
    Utils.qsa('[data-conv]', m).forEach(function (c) {
      c.addEventListener('click', function () { m.querySelector('#alt-conversion').value = c.getAttribute('data-conv'); });
    });

    m.querySelector('#product-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, val = function (n) { return f.elements[n] ? f.elements[n].value.trim() : ''; };
      if (!val('product_name')) { Utils.toast('Nama produk wajib diisi.', 'error'); return; }
      if (val('selling_price') === '') { Utils.toast('Harga jual wajib diisi.', 'error'); return; }
      var payload = {
        product_name: val('product_name'), purchase_price: val('purchase_price') || 0, selling_price: val('selling_price'),
        category_id: val('category_id'), unit_id: val('unit_id'), barcode: val('barcode'),
        manage_stock: swStock.checked
      };
      if (swStock.checked) {
        payload.minimum_stock = val('minimum_stock') || 0;
        if (!isEdit && val('initial_stock')) payload.initial_stock = val('initial_stock');
      }
      if (!isEdit && swAlt && swAlt.checked) {
        var conv = Number(m.querySelector('#alt-conversion').value);
        if (!conv || conv <= 0) { Utils.toast('Isi nilai konversi satuan jual lain dengan benar.', 'error'); return; }
        payload.alt_units = [{ unit_id: m.querySelector('#alt-unit').value, conversion_to_base: conv, selling_price: m.querySelector('#alt-price').value }];
      }
      if (isEdit) payload.product_id = p.product_id;
      var submitBtn = f.querySelector('button[type=submit]');
      submitBtn.disabled = true; submitBtn.textContent = 'Menyimpan...';
      Api.call(isEdit ? 'product.update' : 'product.create', payload).then(function (result) {
        Utils.toast(isEdit ? 'Produk disimpan.' : ('Produk disimpan. SKU: ' + result.sku), 'success');
        Utils.closeModal(); Router.render();
      }).catch(function (err) {
        Utils.toast(err.message, 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Simpan';
      });
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
