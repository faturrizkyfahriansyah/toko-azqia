/**
 * internal/inventory.js - Stok: Ledger, Stock Opname, Retur Pelanggan, Retur Supplier.
 */
window.Modules = window.Modules || {};
Modules.inventory = (function () {
  var activeTab = 'ledger';

  function render(container) {
    container.innerHTML =
      '<h1>Stok</h1>' +
      '<div class="tabs">' +
      tabBtn('ledger', 'Ledger Stok') + tabBtn('opname', 'Stock Opname') +
      tabBtn('retur_customer', 'Retur Pelanggan') + tabBtn('retur_supplier', 'Retur Supplier') +
      '</div><div id="tab-body"></div>';
    Utils.qsa('[data-tab]', container).forEach(function (b) {
      b.addEventListener('click', function () { activeTab = b.getAttribute('data-tab'); render(container); });
    });
    return renderTab();
  }
  function tabBtn(id, label) { return '<button data-tab="' + id + '" class="' + (activeTab === id ? 'active' : '') + '">' + label + '</button>'; }

  function renderTab() {
    var body = document.getElementById('tab-body');
    if (activeTab === 'ledger') return renderLedger(body);
    if (activeTab === 'opname') return renderOpname(body);
    if (activeTab === 'retur_customer') return renderReturCustomer(body);
    return renderReturSupplier(body);
  }

  function renderLedger(body) {
    return Api.call('stock.ledger', {}).then(function (d) {
      var rows = d.movements.slice(0, 100);
      body.innerHTML = '<div class="field"><label>Sesuaikan Stok Manual</label><div class="field-row">' +
        '<input id="adj-sku" placeholder="SKU produk" style="flex:2;"><input id="adj-qty" type="number" placeholder="+/- qty" style="flex:1;">' +
        '</div><input id="adj-reason" placeholder="Alasan (wajib)" style="margin-top:6px;"><button class="btn btn-secondary btn-block" id="adj-submit" style="margin-top:8px;">Simpan Penyesuaian</button></div>' +
        '<div class="divider"></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Tipe</th><th>Qty</th><th>Sebelum</th><th>Sesudah</th></tr></thead><tbody>' +
        rows.map(function (m) { return '<tr><td>' + Utils.formatDate(m.created_at) + '</td><td>' + m.movement_type + '</td><td>' + m.qty + '</td><td>' + m.stock_before + '</td><td>' + m.stock_after + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
      body.querySelector('#adj-submit').addEventListener('click', function () {
        var sku = body.querySelector('#adj-sku').value.trim();
        var qty = Number(body.querySelector('#adj-qty').value || 0);
        var reason = body.querySelector('#adj-reason').value.trim();
        if (!sku || !qty || !reason) { Utils.toast('SKU, qty, dan alasan wajib diisi.', 'error'); return; }
        Api.call('product.list', { search: sku }).then(function (pd) {
          var prod = pd.products.filter(function (p) { return p.sku === sku; })[0];
          if (!prod) { Utils.toast('SKU tidak ditemukan.', 'error'); return; }
          Api.call('stock.adjustment', { product_id: prod.product_id, qty: qty, reason: reason }).then(function () {
            Utils.toast('Stok disesuaikan.', 'success'); render(document.getElementById('view-container'));
          }).catch(function (err) { Utils.toast(err.message, 'error'); });
        });
      });
    });
  }

  function renderOpname(body) {
    return Api.call('stock.opname.list', {}).then(function (d) {
      body.innerHTML = '<button class="btn btn-primary" id="opname-new">+ Mulai Stock Opname</button>' +
        '<div class="table-wrap" style="margin-top:12px;"><table><thead><tr><th>No.</th><th>Tanggal</th><th>Status</th></tr></thead><tbody>' +
        d.opnames.map(function (o) { return '<tr><td>' + o.opname_number + '</td><td>' + Utils.formatDateOnly(o.date) + '</td><td>' + (o.status === 'CONFIRMED' ? '<span class="badge green">Selesai</span>' : '<span class="badge gold" data-continue="' + o.opname_id + '" style="cursor:pointer;">Draft - lanjutkan</span>') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' +
        '<p class="hint">Stok sistem dicatat saat opname dimulai (snapshot); tidak mengunci penjualan selama proses hitung fisik berlangsung. Isi hasil hitung fisik lalu konfirmasi untuk mencatat selisih ke ledger stok.</p>';
      body.querySelector('#opname-new').addEventListener('click', function () {
        Api.call('product.list', { activeOnly: true }).then(function (pd) {
          Api.call('stock.opname.create', { product_ids: pd.products.map(function (p) { return p.product_id; }) }).then(function (r) {
            openOpnameForm(r.opname_id, r.items, pd.products);
          });
        });
      });
    });
  }
  function openOpnameForm(opnameId, items, products) {
    var nameOf = {}; products.forEach(function (p) { nameOf[p.product_id] = p.product_name; });
    var m = Utils.openModal('<h3>Isi Hasil Hitung Fisik</h3><form id="op-form">' +
      items.map(function (it, idx) {
        return '<div class="field-row" style="align-items:flex-end;"><div class="field" style="flex:2;"><label>' + Utils.escapeHtml(nameOf[it.product_id] || it.product_id) + ' (sistem: ' + it.system_stock + ')</label>' +
          '<input name="count_' + idx + '" type="number" placeholder="Hasil hitung fisik" required></div>' +
          '<div class="field" style="flex:1;"><input name="reason_' + idx + '" placeholder="Alasan jika beda"></div></div>';
      }).join('') +
      '<button class="btn btn-primary btn-block" type="submit">Konfirmasi Stock Opname</button></form>');
    m.querySelector('#op-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payloadItems = items.map(function (it, idx) {
        return { opname_item_id: it.opname_item_id, physical_count: fd.get('count_' + idx), reason: fd.get('reason_' + idx) || '' };
      });
      Api.call('stock.opname.confirm', { opname_id: opnameId, items: payloadItems }).then(function () {
        Utils.toast('Stock opname dikonfirmasi.', 'success'); Utils.closeModal(); Router.render();
      }).catch(function (err) { Utils.toast(err.message, 'error'); });
    });
  }

  function renderReturCustomer(body) {
    body.innerHTML = '<form id="rc-form">' +
      '<div class="field"><label>SKU Produk</label><input name="sku" required></div>' +
      '<div class="field-row"><div class="field"><label>Referensi (No. Transaksi/Pesanan)</label><input name="ref_id" required></div>' +
      '<div class="field"><label>Tipe Referensi</label><select name="ref_type"><option value="SALE">Kasir</option><option value="ONLINE_ORDER">Online</option></select></div></div>' +
      '<div class="field-row"><div class="field"><label>Qty</label><input name="qty" type="number" value="1" required></div>' +
      '<div class="field"><label>Kondisi</label><select name="condition"><option value="BAIK">Baik (kembali ke stok)</option><option value="RUSAK">Rusak</option></select></div></div>' +
      '<div class="field"><label>Jumlah Refund (Rp, opsional)</label><input name="refund_amount" type="number" value="0"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Proses Retur</button></form>';
    body.querySelector('#rc-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target).entries());
      Api.call('product.list', { search: fd.sku }).then(function (pd) {
        var prod = pd.products.filter(function (p) { return p.sku === fd.sku; })[0];
        if (!prod) { Utils.toast('SKU tidak ditemukan.', 'error'); return; }
        fd.product_id = prod.product_id; delete fd.sku;
        Api.call('return.customer.create', fd).then(function (r) {
          Utils.toast('Retur ' + r.return_number + ' diproses.', 'success'); e.target.reset();
        }).catch(function (err) { Utils.toast(err.message, 'error'); });
      });
    });
  }

  function renderReturSupplier(body) {
    return Api.call('supplier.list', {}).then(function (sd) {
      body.innerHTML = '<form id="rs-form">' +
        '<div class="field"><label>Supplier</label><select name="supplier_id">' + sd.suppliers.map(function (s) { return '<option value="' + s.supplier_id + '">' + Utils.escapeHtml(s.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>SKU Produk</label><input name="sku" required></div>' +
        '<div class="field-row"><div class="field"><label>Qty</label><input name="qty" type="number" value="1" required></div>' +
        '<div class="field"><label>Kondisi</label><select name="condition"><option value="RUSAK">Rusak</option><option value="SALAH_KIRIM">Salah Kirim</option></select></div></div>' +
        '<div class="field"><label>Kredit dari Supplier (Rp, opsional)</label><input name="refund_amount" type="number" value="0"></div>' +
        '<button class="btn btn-primary btn-block" type="submit">Proses Retur ke Supplier</button></form>';
      body.querySelector('#rs-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = Object.fromEntries(new FormData(e.target).entries());
        Api.call('product.list', { search: fd.sku }).then(function (pd) {
          var prod = pd.products.filter(function (p) { return p.sku === fd.sku; })[0];
          if (!prod) { Utils.toast('SKU tidak ditemukan.', 'error'); return; }
          fd.product_id = prod.product_id; delete fd.sku;
          Api.call('return.supplier.create', fd).then(function (r) {
            Utils.toast('Retur ' + r.return_number + ' diproses. Stok berkurang.', 'success'); e.target.reset();
          }).catch(function (err) { Utils.toast(err.message, 'error'); });
        });
      });
    });
  }

  return { render: render };
})();
