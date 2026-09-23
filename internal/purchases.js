/**
 * internal/purchases.js - Barang Masuk (pembelian dari supplier).
 * HANYA memilih produk yang sudah ada di Master Produk - tidak membuat produk baru dari sini.
 * Setiap item memilih satuan pembelian (mis. DUS/SLOP dengan konversi ke satuan utama).
 */
window.Modules = window.Modules || {};
Modules.purchases = (function () {
  var draftItems = [];

  function render(container) {
    return Promise.all([Api.call('supplier.list', {}), Api.call('purchase.list', {})]).then(function (r) {
      if (!container.isConnected) return;
      container.innerHTML =
        '<div class="row"><h1>Barang Masuk</h1><button class="btn btn-primary" id="btn-new">+ Input Barang Masuk</button></div>' +
        '<div id="list"></div>';
      renderList(r[1].purchases);
      document.getElementById('btn-new').addEventListener('click', function () { openForm(r[0].suppliers); });
    });
  }

  function renderList(rows) {
    var box = document.getElementById('list');
    if (rows.length === 0) { box.innerHTML = '<div class="empty-state">Belum ada barang masuk.</div>'; return; }
    box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>No.</th><th>Tanggal</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>' +
      rows.map(function (p) {
        return '<tr><td>' + p.purchase_number + '</td><td>' + Utils.formatDateOnly(p.date) + '</td><td>' + Utils.formatCurrency(p.total) + '</td>' +
          '<td>' + (p.status === 'CONFIRMED' ? '<span class="badge green">Dikonfirmasi</span>' : '<span class="badge gold">Draft</span>') + '</td>' +
          '<td>' + (p.status !== 'CONFIRMED' ? '<button class="btn btn-secondary btn-sm" data-confirm="' + p.purchase_id + '">Konfirmasi</button>' : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    Utils.qsa('[data-confirm]', box).forEach(function (b) {
      b.addEventListener('click', function () { openConfirmChoice(b.getAttribute('data-confirm')); });
    });
  }

  function openConfirmChoice(purchaseId) {
    var m = Utils.openModal(
      '<h3>Konfirmasi Barang Masuk</h3>' +
      '<p class="muted">Stok akan bertambah setelah dikonfirmasi. Pilih status pembayaran ke supplier:</p>' +
      '<button class="btn btn-primary btn-block" id="pay-now" style="margin-bottom:8px;">Sudah Dibayar (Tunai, kurangi Kas)</button>' +
      '<div class="field-row" style="margin-bottom:8px;"><div class="field"><label>Jatuh Tempo (jika Hutang)</label><input type="date" id="due-date"></div></div>' +
      '<button class="btn btn-outline btn-block" id="pay-later">Catat sebagai Hutang Supplier</button>'
    );
    m.querySelector('#pay-now').addEventListener('click', function () { confirmPurchase(purchaseId, true, null); });
    m.querySelector('#pay-later').addEventListener('click', function () { confirmPurchase(purchaseId, false, m.querySelector('#due-date').value); });
  }
  function confirmPurchase(purchaseId, markPaid, dueDate) {
    Api.call('purchase.confirm', { purchase_id: purchaseId, mark_paid: markPaid, due_date: dueDate || undefined }).then(function () {
      Utils.toast(markPaid ? 'Barang masuk dikonfirmasi & lunas. Stok bertambah.' : 'Barang masuk dikonfirmasi. Hutang supplier dicatat.', 'success');
      Utils.closeModal(); Router.render();
    }).catch(function (err) { Utils.toast(err.message, 'error'); });
  }

  function openForm(suppliers) {
    draftItems = [];
    var m = Utils.openModal(
      '<h3>Input Barang Masuk</h3>' +
      '<div class="field"><label>Supplier</label><select id="p-supplier">' +
      suppliers.map(function (s) { return '<option value="' + s.supplier_id + '">' + Utils.escapeHtml(s.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="divider"></div>' +
      '<div class="field"><label>Cari Produk (nama/SKU/barcode)</label><input id="p-search" placeholder="mis. Gula"></div>' +
      '<div id="p-search-result" style="display:none;max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;"></div>' +
      '<div id="p-selected-product" class="muted"></div>' +
      '<div class="field-row"><div class="field"><label>Satuan</label><select id="p-unit"></select></div>' +
      '<div class="field"><label>Qty</label><input id="p-qty" type="number" value="1" min="1"></div></div>' +
      '<div class="field"><label>Harga Beli / Satuan (Rp)</label><input id="p-price" type="number"></div>' +
      '<button class="btn btn-outline btn-block" id="p-add-item" type="button">+ Tambah Item</button>' +
      '<div id="p-items" style="margin:12px 0;"></div>' +
      '<div class="row"><strong>Total</strong><strong id="p-total">Rp 0</strong></div>' +
      '<button class="btn btn-primary btn-block" id="p-submit" style="margin-top:12px;">Simpan Barang Masuk</button>'
    );

    var selectedProduct = null;
    var searchInput = m.querySelector('#p-search');
    var resultBox = m.querySelector('#p-search-result');
    searchInput.addEventListener('input', Utils.debounce(function () {
      var q = searchInput.value.trim();
      if (!q) { resultBox.style.display = 'none'; return; }
      Api.call('product.list', { search: q, activeOnly: true }).then(function (d) {
        if (d.products.length === 0) { resultBox.style.display = 'block'; resultBox.innerHTML = '<div class="empty-state">Produk tidak ditemukan. Tambahkan dulu lewat menu Produk.</div>'; return; }
        resultBox.style.display = 'block';
        resultBox.innerHTML = d.products.map(function (p) {
          return '<div class="row" style="padding:8px;border-bottom:1px solid var(--border);cursor:pointer;" data-pick="' + p.product_id + '"><span>' + Utils.escapeHtml(p.product_name) + '</span><span class="muted">' + Utils.escapeHtml(p.sku) + '</span></div>';
        }).join('');
        Utils.qsa('[data-pick]', resultBox).forEach(function (row) {
          row.addEventListener('click', function () {
            var prod = d.products.filter(function (x) { return x.product_id === row.getAttribute('data-pick'); })[0];
            selectProduct(prod);
          });
        });
      });
    }, 280));

    function selectProduct(prod) {
      selectedProduct = prod;
      resultBox.style.display = 'none'; searchInput.value = '';
      m.querySelector('#p-selected-product').textContent = 'Dipilih: ' + prod.product_name + ' (' + prod.sku + ')';
      Api.call('productUnit.list', { product_id: prod.product_id }).then(function (d) {
        m.querySelector('#p-unit').innerHTML = d.product_units.map(function (u) {
          return '<option value="' + u.unit_id + '">' + Utils.escapeHtml(u.unit_name) + (String(u.is_base) === 'true' || u.is_base === true ? ' (utama)' : ' = ' + u.conversion_to_base) + '</option>';
        }).join('');
      });
    }

    m.querySelector('#p-add-item').addEventListener('click', function () {
      var qty = Number(m.querySelector('#p-qty').value || 0);
      var price = Number(m.querySelector('#p-price').value || 0);
      var unitId = m.querySelector('#p-unit').value;
      if (!selectedProduct) { Utils.toast('Pilih produk terlebih dahulu dari hasil pencarian.', 'error'); return; }
      if (!unitId || qty <= 0 || price <= 0) { Utils.toast('Lengkapi satuan, qty, dan harga beli.', 'error'); return; }
      var unitOption = m.querySelector('#p-unit option:checked');
      draftItems.push({ product_id: selectedProduct.product_id, product_name: selectedProduct.product_name, qty: qty, purchase_price: price, unit_id: unitId, unit_label: unitOption.textContent });
      renderItems();
      selectedProduct = null; m.querySelector('#p-selected-product').textContent = '';
      m.querySelector('#p-qty').value = 1; m.querySelector('#p-price').value = ''; m.querySelector('#p-unit').innerHTML = '';
    });

    function renderItems() {
      var box = m.querySelector('#p-items');
      box.innerHTML = draftItems.map(function (it, idx) {
        return '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border);"><span>' + Utils.escapeHtml(it.product_name) + ' - ' + it.qty + ' ' + Utils.escapeHtml(it.unit_label) + '</span>' +
          '<span>' + Utils.formatCurrency(it.qty * it.purchase_price) + ' <button class="btn btn-ghost btn-sm" data-del="' + idx + '">x</button></span></div>';
      }).join('');
      var total = draftItems.reduce(function (s, it) { return s + it.qty * it.purchase_price; }, 0);
      m.querySelector('#p-total').textContent = Utils.formatCurrency(total);
      Utils.qsa('[data-del]', box).forEach(function (b) { b.addEventListener('click', function () { draftItems.splice(+b.getAttribute('data-del'), 1); renderItems(); }); });
    }

    m.querySelector('#p-submit').addEventListener('click', function () {
      if (draftItems.length === 0) { Utils.toast('Tambahkan minimal 1 item.', 'error'); return; }
      Api.call('purchase.create', {
        supplier_id: m.querySelector('#p-supplier').value,
        items: draftItems.map(function (it) { return { product_id: it.product_id, qty: it.qty, purchase_price: it.purchase_price, unit_id: it.unit_id }; })
      }).then(function () {
        Utils.toast('Barang masuk disimpan sebagai draft. Konfirmasi untuk menambah stok.', 'success');
        Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
