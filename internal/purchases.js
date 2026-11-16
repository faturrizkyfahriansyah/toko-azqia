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
      var suppliers = r[0].suppliers || [], rows = r[1].purchases || [];
      var nameOf = {}; suppliers.forEach(function (s) { nameOf[s.supplier_id] = s.name; });
      container.innerHTML = '<div class="row"><h1 class="page-title" style="margin:0;">Barang Masuk</h1><button class="btn btn-primary" id="btn-new">+ Barang Masuk</button></div><div id="list" style="margin-top:12px;"></div>';
      renderList(rows, nameOf);
      document.getElementById('btn-new').addEventListener('click', function () {
        if (!suppliers.length) { Utils.toast('Tambahkan supplier dulu di menu Supplier.', 'error'); return; }
        openForm(container, suppliers);
      });
    });
  }

  function renderList(rows, nameOf) {
    var box = document.getElementById('list');
    if (rows.length === 0) { box.innerHTML = '<div class="empty-state"><div class="empty-title">Belum ada barang masuk</div><div class="empty-sub">Ketuk "+ Barang Masuk" saat barang dari supplier datang.</div></div>'; return; }
    rows = rows.slice().sort(function (a, b) { return String(b.created_at || b.date) < String(a.created_at || a.date) ? -1 : 1; });
    box.innerHTML = '<div class="lcard">' + rows.map(function (p) {
      var ok = p.status === 'CONFIRMED';
      return '<div class="lrow"><div class="lr-main"><div class="lr-name">' + Utils.escapeHtml(p.purchase_number) + '</div><div class="lr-sub">' + Utils.formatDateOnly(p.date) + (nameOf[p.supplier_id] ? ' &middot; ' + Utils.escapeHtml(nameOf[p.supplier_id]) : '') + '</div></div>' +
        '<div style="text-align:right;"><div class="lr-right">' + Utils.formatCurrency(p.total) + '</div>' +
        (ok ? '<span class="badge green">Dikonfirmasi</span>' : '<button class="btn btn-secondary btn-sm" data-confirm="' + p.purchase_id + '" style="margin-top:4px;">Konfirmasi</button>') + '</div></div>';
    }).join('') + '</div>';
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

  /** Halaman form bertahap: 1 Supplier -> 2 Tambah barang -> 3 Daftar & total -> Simpan. */
  function openForm(container, suppliers) {
    draftItems = [];
    container.innerHTML = '<div class="sub-head"><a class="sub-back" href="#/internal/purchases" id="pf-back" aria-label="Kembali">&#8249;</a><h1 class="page-title">Barang Masuk Baru</h1></div>' +
      '<div class="card rt-step"><div class="rt-n">1</div><div class="rt-b"><div class="set-h">Supplier</div><div class="field" style="margin:0;"><select id="p-supplier">' +
      suppliers.map(function (s) { return '<option value="' + s.supplier_id + '">' + Utils.escapeHtml(s.name) + '</option>'; }).join('') + '</select></div></div></div>' +
      '<div class="card rt-step"><div class="rt-n">2</div><div class="rt-b"><div class="set-h">Tambah barang</div>' +
      '<div class="field"><input id="p-search" type="search" placeholder="Cari nama, SKU, atau barcode" autocomplete="off"></div>' +
      '<div id="p-search-result" class="pk-list" hidden></div>' +
      '<div id="p-selected" class="muted" style="margin-bottom:8px;"></div>' +
      '<div id="p-fields" hidden><div class="field-row"><div class="field"><label>Satuan</label><select id="p-unit"></select></div><div class="field"><label>Jumlah</label><input id="p-qty" type="number" inputmode="numeric" value="1" min="1"></div></div>' +
      '<div class="field"><label>Harga beli per satuan (Rp)</label><input id="p-price" type="number" inputmode="numeric" min="0"></div>' +
      '<button class="btn btn-outline btn-block" id="p-add-item" type="button">+ Masukkan ke daftar</button></div></div></div>' +
      '<div class="card rt-step"><div class="rt-n">3</div><div class="rt-b"><div class="set-h">Daftar barang</div><div id="p-items"></div>' +
      '<div class="row" style="margin-top:8px;"><strong>Total</strong><strong id="p-total">Rp 0</strong></div></div></div>' +
      '<button class="btn btn-primary btn-block" id="p-submit">Simpan Barang Masuk</button><p class="hint">Disimpan sebagai draft. Stok baru bertambah setelah Anda konfirmasi dari daftar Barang Masuk.</p>';
    var m = container, selectedProduct = null;
    m.querySelector('#pf-back').addEventListener('click', function (e) { e.preventDefault(); if (draftItems.length && !confirm('Daftar barang belum disimpan. Keluar?')) return; Router.render(); });
    var searchInput = m.querySelector('#p-search'), resultBox = m.querySelector('#p-search-result');
    searchInput.addEventListener('input', Utils.debounce(function () {
      var q = searchInput.value.trim();
      if (!q) { resultBox.hidden = true; return; }
      Api.call('product.list', { search: q, activeOnly: true }).then(function (d) {
        resultBox.hidden = false;
        if (d.products.length === 0) { resultBox.innerHTML = '<div class="empty-sub" style="padding:12px;">Produk tidak ditemukan. Tambahkan dulu lewat menu Produk.</div>'; return; }
        resultBox.innerHTML = d.products.slice(0, 30).map(function (p) {
          return '<div class="lrow" data-pick="' + p.product_id + '"><div class="lr-main"><div class="lr-name">' + Utils.escapeHtml(p.product_name) + '</div><div class="lr-sub">' + Utils.escapeHtml(p.sku) + '</div></div></div>';
        }).join('');
        Utils.qsa('[data-pick]', resultBox).forEach(function (row) {
          row.addEventListener('click', function () { selectProduct(d.products.filter(function (x) { return x.product_id === row.getAttribute('data-pick'); })[0]); });
        });
      });
    }, 280));

    function selectProduct(prod) {
      selectedProduct = prod; resultBox.hidden = true; searchInput.value = '';
      m.querySelector('#p-selected').innerHTML = 'Dipilih: <b>' + Utils.escapeHtml(prod.product_name) + '</b> (' + Utils.escapeHtml(prod.sku) + ')';
      m.querySelector('#p-fields').hidden = false;
      if (prod.purchase_price) m.querySelector('#p-price').value = Math.round(Number(prod.purchase_price)) || '';
      Api.call('productUnit.list', { product_id: prod.product_id }).then(function (d) {
        m.querySelector('#p-unit').innerHTML = d.product_units.map(function (u) {
          return '<option value="' + u.unit_id + '">' + Utils.escapeHtml(u.unit_name) + (String(u.is_base) === 'true' || u.is_base === true ? ' (utama)' : ' = ' + u.conversion_to_base) + '</option>';
        }).join('');
      });
    }

    m.querySelector('#p-add-item').addEventListener('click', function () {
      var qty = Number(m.querySelector('#p-qty').value || 0), price = Number(m.querySelector('#p-price').value || 0), unitId = m.querySelector('#p-unit').value;
      if (!selectedProduct) { Utils.toast('Pilih produk terlebih dahulu dari hasil pencarian.', 'error'); return; }
      if (!unitId || qty <= 0 || price <= 0) { Utils.toast('Lengkapi satuan, jumlah, dan harga beli.', 'error'); return; }
      var unitOption = m.querySelector('#p-unit option:checked');
      draftItems.push({ product_id: selectedProduct.product_id, product_name: selectedProduct.product_name, qty: qty, purchase_price: price, unit_id: unitId, unit_label: unitOption.textContent.replace(/ \(utama\)| = .*/, '') });
      renderItems();
      selectedProduct = null; m.querySelector('#p-selected').textContent = ''; m.querySelector('#p-fields').hidden = true;
      m.querySelector('#p-qty').value = 1; m.querySelector('#p-price').value = ''; m.querySelector('#p-unit').innerHTML = '';
    });

    function renderItems() {
      var box = m.querySelector('#p-items');
      box.innerHTML = draftItems.length ? '<div class="lcard">' + draftItems.map(function (it, idx) {
        return '<div class="lrow"><div class="lr-main"><div class="lr-name">' + Utils.escapeHtml(it.product_name) + '</div><div class="lr-sub">' + it.qty + ' ' + Utils.escapeHtml(it.unit_label) + ' &times; ' + Utils.formatCurrency(it.purchase_price) + '</div></div>' +
          '<div class="lr-right" style="font-size:0.95rem;">' + Utils.formatCurrency(it.qty * it.purchase_price) + '</div><button class="btn btn-ghost btn-sm" data-del="' + idx + '" aria-label="Hapus">&times;</button></div>';
      }).join('') + '</div>' : '<div class="empty-sub">Belum ada barang. Cari dan masukkan di langkah 2.</div>';
      var total = draftItems.reduce(function (s, it) { return s + it.qty * it.purchase_price; }, 0);
      m.querySelector('#p-total').textContent = Utils.formatCurrency(total);
      Utils.qsa('[data-del]', box).forEach(function (b) { b.addEventListener('click', function () { draftItems.splice(+b.getAttribute('data-del'), 1); renderItems(); }); });
    }
    renderItems();

    m.querySelector('#p-submit').addEventListener('click', function () {
      if (draftItems.length === 0) { Utils.toast('Tambahkan minimal 1 barang.', 'error'); return; }
      var btn = this; btn.disabled = true;
      Api.call('purchase.create', {
        supplier_id: m.querySelector('#p-supplier').value,
        items: draftItems.map(function (it) { return { product_id: it.product_id, qty: it.qty, purchase_price: it.purchase_price, unit_id: it.unit_id }; })
      }).then(function () {
        Utils.toast('Tersimpan sebagai draft. Konfirmasi untuk menambah stok.', 'success'); draftItems = []; Router.render();
      }).catch(function (err) { btn.disabled = false; Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
