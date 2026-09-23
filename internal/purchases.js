/**
 * internal/purchases.js - Barang Masuk (pembelian dari supplier).
 * V1: tanpa Purchase Order formal terpisah - alur langsung input & konfirmasi.
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
          '<td>' + (p.status !== 'CONFIRMED' ? '<button class="btn btn-secondary btn-sm" data-confirm="' + p.purchase_id + '">Konfirmasi (Stok Masuk)</button>' : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    Utils.qsa('[data-confirm]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Konfirmasi barang masuk ini? Stok produk akan bertambah.')) return;
        Api.call('purchase.confirm', { purchase_id: b.getAttribute('data-confirm') }).then(function () {
          Utils.toast('Barang masuk dikonfirmasi, stok bertambah.', 'success'); Router.render();
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }

  function openForm(suppliers) {
    draftItems = [];
    var m = Utils.openModal(
      '<h3>Input Barang Masuk</h3>' +
      '<div class="field"><label>Supplier</label><select id="p-supplier">' +
      suppliers.map(function (s) { return '<option value="' + s.supplier_id + '">' + Utils.escapeHtml(s.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="divider"></div>' +
      '<div class="field-row"><div class="field"><label>SKU Produk</label><input id="p-sku" placeholder="SKU"></div>' +
      '<div class="field"><label>Qty</label><input id="p-qty" type="number" value="1"></div></div>' +
      '<div class="field"><label>Harga Beli / Satuan</label><input id="p-price" type="number"></div>' +
      '<button class="btn btn-outline btn-block" id="p-add-item" type="button">+ Tambah Item</button>' +
      '<div id="p-items" style="margin:12px 0;"></div>' +
      '<div class="row"><strong>Total</strong><strong id="p-total">Rp 0</strong></div>' +
      '<button class="btn btn-primary btn-block" id="p-submit" style="margin-top:12px;">Simpan Barang Masuk</button>'
    );

    m.querySelector('#p-add-item').addEventListener('click', function () {
      var sku = m.querySelector('#p-sku').value.trim();
      var qty = Number(m.querySelector('#p-qty').value || 0);
      var price = Number(m.querySelector('#p-price').value || 0);
      if (!sku || qty <= 0 || price <= 0) { Utils.toast('Lengkapi SKU, qty, dan harga beli.', 'error'); return; }
      Api.call('product.list', { search: sku }).then(function (d) {
        var prod = d.products.filter(function (p) { return p.sku === sku; })[0] || d.products[0];
        if (!prod) { Utils.toast('Produk dengan SKU tersebut tidak ditemukan.', 'error'); return; }
        draftItems.push({ product_id: prod.product_id, product_name: prod.product_name, qty: qty, purchase_price: price });
        renderItems(); m.querySelector('#p-sku').value = ''; m.querySelector('#p-qty').value = 1; m.querySelector('#p-price').value = '';
      });
    });

    function renderItems() {
      var box = m.querySelector('#p-items');
      box.innerHTML = draftItems.map(function (it, idx) {
        return '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border);"><span>' + Utils.escapeHtml(it.product_name) + ' x' + it.qty + '</span>' +
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
        items: draftItems.map(function (it) { return { product_id: it.product_id, qty: it.qty, purchase_price: it.purchase_price }; })
      }).then(function () {
        Utils.toast('Barang masuk disimpan sebagai draft. Konfirmasi untuk menambah stok.', 'success');
        Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  return { render: render };
})();
