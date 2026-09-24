/**
 * internal/pos.js - Kasir (POS). Alur: scan (kamera/scanner)/cari produk -> keranjang (atur
 * qty & satuan) -> bayar (Tunai/QRIS/Transfer/Hutang) -> struk.
 */
window.Modules = window.Modules || {};
Modules.pos = (function () {
  var CAMERA_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/></svg>';
  var cart = []; // {product_id, product_name, unit_id, unit_name, unit_price, qty, discount, availableUnits}
  var customersCache = null;

  function findLine(productId, unitId) { return cart.filter(function (l) { return l.product_id === productId && l.unit_id === unitId; })[0]; }

  function addToCart(p) {
    Api.call('productUnit.list', { product_id: p.product_id }).then(function (d) {
      var base = d.product_units.filter(function (u) { return String(u.is_base) === 'true' || u.is_base === true; })[0] || d.product_units[0];
      if (!base) { Utils.toast('Produk ini belum punya satuan terdaftar.', 'error'); return; }
      var line = findLine(p.product_id, base.unit_id);
      if (line) { line.qty += 1; } else {
        cart.push({
          product_id: p.product_id, product_name: p.product_name, unit_id: base.unit_id, unit_name: base.unit_name,
          unit_price: base.selling_price ? Number(base.selling_price) : Number(p.selling_price),
          qty: 1, discount: 0, availableUnits: d.product_units
        });
      }
      renderCart();
    });
  }
  function subtotal() { return cart.reduce(function (s, l) { return s + l.qty * l.unit_price - l.discount; }, 0); }

  function render(container) {
    container.innerHTML =
      '<h1>Kasir</h1>' +
      '<div class="search-box"><input id="pos-search" placeholder="Cari produk atau scan barcode" autofocus>' +
      '<button class="btn btn-secondary" id="pos-scan" title="Scan barcode via kamera" aria-label="Scan barcode">' + CAMERA_ICON + '</button></div>' +
      '<div id="pos-results" class="card" style="display:none;max-height:260px;overflow-y:auto;"></div>' +
      '<div class="card"><h3>Keranjang</h3><div id="pos-cart"></div></div>' +
      '<div class="pos-sticky-footer">' +
      '<div class="field" style="margin-bottom:8px;"><label>Diskon Transaksi (Rp)</label><input id="pos-discount" type="number" value="0" min="0"></div>' +
      '<div class="row"><span class="muted">Total</span><strong id="pos-total" style="color:var(--red);font-size:1.3rem;"></strong></div>' +
      '<button class="btn btn-primary btn-block" id="pos-pay" style="margin-top:10px;">Bayar</button>' +
      '</div>';

    var searchInput = document.getElementById('pos-search');
    var doSearch = Utils.debounce(function () {
      var q = searchInput.value.trim();
      var resultsBox = document.getElementById('pos-results');
      if (!q) { resultsBox.style.display = 'none'; return; }
      Api.call('product.list', { search: q, activeOnly: true }).then(function (d) {
        resultsBox.style.display = 'block';
        if (d.products.length === 0) { resultsBox.innerHTML = '<div class="empty-state">Produk tidak ditemukan.</div>'; return; }
        resultsBox.innerHTML = d.products.slice(0, 15).map(function (p) {
          var available = Number(p.current_stock) - Number(p.reserved_stock);
          return '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" data-add="' + p.product_id + '">' +
            '<div><div style="font-weight:600;">' + Utils.escapeHtml(p.product_name) + '</div><div class="muted">Stok: ' + available + ' &middot; ' + Utils.formatCurrency(p.selling_price) + '</div></div>' +
            '<button class="btn btn-secondary btn-sm">+ Tambah</button></div>';
        }).join('');
        Utils.qsa('[data-add]', resultsBox).forEach(function (row) {
          row.addEventListener('click', function () {
            var p = d.products.filter(function (x) { return x.product_id === row.getAttribute('data-add'); })[0];
            addToCart(p);
            searchInput.value = ''; resultsBox.style.display = 'none';
          });
        });
      });
    }, 280);
    searchInput.addEventListener('input', doSearch);
    document.getElementById('pos-scan').addEventListener('click', openCameraScan);

    document.getElementById('pos-discount').addEventListener('input', renderCart);
    document.getElementById('pos-pay').addEventListener('click', openPaymentModal);
    renderCart();
  }

  function openCameraScan() {
    var m = Utils.openModal('<h3>Scan Barcode</h3><div id="scan-area" style="width:100%;min-height:220px;"></div><p class="hint">Arahkan kamera ke barcode produk. Jika kamera tidak bisa dibuka, gunakan pencarian manual.</p><button class="btn btn-outline btn-block" id="scan-cancel">Batal</button>');
    var scannerRef = null;
    window.BarcodeTools.startCameraScan('scan-area', function (text) {
      Api.call('product.list', { search: text }).then(function (d) {
        var exact = d.products.filter(function (p) { return p.barcode === text || p.sku === text; })[0] || d.products[0];
        Utils.closeModal();
        if (!exact) { Utils.toast('Barcode "' + text + '" tidak ditemukan di produk.', 'error'); return; }
        addToCart(exact);
        Utils.toast(exact.product_name + ' ditambahkan.', 'success');
      });
    }, function (err) {
      Utils.toast('Kamera tidak dapat diakses: ' + err.message, 'error');
    }).then(function (s) { scannerRef = s; }).catch(function () {});
    m.querySelector('#scan-cancel').addEventListener('click', function () {
      if (scannerRef) scannerRef.stop();
      Utils.closeModal();
    });
  }

  function renderCart() {
    var box = document.getElementById('pos-cart');
    if (!box) return;
    if (cart.length === 0) { box.innerHTML = '<div class="empty-state">Keranjang kosong. Cari atau scan produk di atas.</div>'; }
    else {
      box.innerHTML = cart.map(function (l, idx) {
        var unitSelect = l.availableUnits.length > 1
          ? '<select data-unit-switch="' + idx + '" style="margin-top:4px;font-size:0.78rem;padding:3px 6px;">' +
            l.availableUnits.map(function (u) { return '<option value="' + u.unit_id + '"' + (u.unit_id === l.unit_id ? ' selected' : '') + '>' + Utils.escapeHtml(u.unit_name) + '</option>'; }).join('') + '</select>'
          : '<span class="muted">' + Utils.escapeHtml(l.unit_name) + '</span>';
        return '<div class="cart-item"><div style="flex:1;"><div style="font-weight:600;">' + Utils.escapeHtml(l.product_name) + '</div>' +
          '<div class="muted">' + Utils.formatCurrency(l.unit_price) + ' / ' + Utils.escapeHtml(l.unit_name) + '</div>' + unitSelect +
          '<div class="muted" style="margin-top:2px;">Subtotal: <strong style="color:var(--ink);">' + Utils.formatCurrency(l.qty * l.unit_price) + '</strong></div></div>' +
          '<div class="qty-control"><button data-dec="' + idx + '">-</button><span>' + l.qty + '</span><button data-inc="' + idx + '">+</button></div>' +
          '<button class="btn btn-ghost btn-sm" data-remove="' + idx + '">Hapus</button></div>';
      }).join('');
      Utils.qsa('[data-inc]', box).forEach(function (b) { b.addEventListener('click', function () { cart[+b.getAttribute('data-inc')].qty++; renderCart(); }); });
      Utils.qsa('[data-dec]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var l = cart[+b.getAttribute('data-dec')];
          l.qty--; if (l.qty <= 0) cart.splice(+b.getAttribute('data-dec'), 1);
          renderCart();
        });
      });
      Utils.qsa('[data-remove]', box).forEach(function (b) { b.addEventListener('click', function () { cart.splice(+b.getAttribute('data-remove'), 1); renderCart(); }); });
      Utils.qsa('[data-unit-switch]', box).forEach(function (sel) {
        sel.addEventListener('change', function () {
          var idx = +sel.getAttribute('data-unit-switch');
          var l = cart[idx];
          var u = l.availableUnits.filter(function (x) { return x.unit_id === sel.value; })[0];
          if (!u) return;
          l.unit_id = u.unit_id; l.unit_name = u.unit_name;
          l.unit_price = u.selling_price ? Number(u.selling_price) : Number(l.unit_price);
          renderCart();
        });
      });
    }
    var discount = Number(document.getElementById('pos-discount').value || 0);
    document.getElementById('pos-total').textContent = Utils.formatCurrency(subtotal() - discount);
  }

  function openPaymentModal() {
    if (cart.length === 0) { Utils.toast('Keranjang masih kosong.', 'error'); return; }
    var discount = Number(document.getElementById('pos-discount').value || 0);
    var total = subtotal() - discount;
    var m = Utils.openModal(
      '<h3>Pembayaran</h3>' +
      '<div class="row"><span>Total Tagihan</span><strong style="font-size:1.3rem;">' + Utils.formatCurrency(total) + '</strong></div>' +
      '<div class="field" style="margin-top:14px;"><label>Metode</label><select id="pay-method"><option value="CASH">Tunai</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option><option value="HUTANG">Hutang (Piutang Pelanggan)</option></select></div>' +
      '<div class="field" id="pay-cash-field"><label>Uang Diterima</label><input id="pay-received" type="number" min="0"></div>' +
      '<div class="row" id="pay-change-row"><span>Kembalian</span><strong id="pay-change">Rp 0</strong></div>' +
      '<div class="field" id="pay-customer-field" style="display:none;"><label>Pelanggan (wajib untuk Hutang)</label><select id="pay-customer"></select></div>' +
      '<div id="pay-qris-preview"></div>' +
      '<a href="#" id="pay-split-toggle" style="display:block;margin:8px 0;font-size:0.85rem;">+ Split pembayaran (Tunai + QRIS, dsb)</a>' +
      '<div id="pay-split-area" style="display:none;">' +
      '<div class="field-row"><div class="field"><label>Metode ke-2</label><select id="pay-method-2"><option value="CASH">Tunai</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option></select></div>' +
      '<div class="field"><label>Nominal</label><input id="pay-amount-2" type="number" min="0"></div></div>' +
      '<p class="hint">Nominal Metode 1 akan dihitung otomatis = Total - Nominal Metode 2.</p>' +
      '</div>' +
      '<button class="btn btn-primary btn-block" id="pay-submit" style="margin-top:14px;">Selesaikan Transaksi</button>'
    );
    var methodSel = m.querySelector('#pay-method');
    var receivedInput = m.querySelector('#pay-received');
    var splitToggle = m.querySelector('#pay-split-toggle');
    var splitArea = m.querySelector('#pay-split-area');
    var splitOn = false;
    splitToggle.addEventListener('click', function (e) {
      e.preventDefault();
      splitOn = !splitOn;
      splitArea.style.display = splitOn ? 'block' : 'none';
      splitToggle.textContent = splitOn ? '- Batalkan split pembayaran' : '+ Split pembayaran (Tunai + QRIS, dsb)';
      if (splitOn) { methodSel.value = 'CASH'; updateChange(); }
    });
    function updateChange() {
      var method = methodSel.value;
      var isHutang = method === 'HUTANG';
      splitToggle.style.display = isHutang ? 'none' : 'block';
      if (isHutang && splitOn) { splitOn = false; splitArea.style.display = 'none'; }
      m.querySelector('#pay-cash-field').style.display = (method === 'CASH' && !splitOn) ? 'block' : 'none';
      m.querySelector('#pay-change-row').style.display = (method === 'CASH' && !splitOn) ? 'flex' : 'none';
      m.querySelector('#pay-customer-field').style.display = isHutang ? 'block' : 'none';
      var received = Number(receivedInput.value || 0);
      m.querySelector('#pay-change').textContent = Utils.formatCurrency(Math.max(0, received - total));
      if (isHutang && !customersCache) {
        Api.call('customer.list', {}).then(function (d) {
          customersCache = d.customers;
          m.querySelector('#pay-customer').innerHTML = d.customers.map(function (c) { return '<option value="' + c.customer_id + '">' + Utils.escapeHtml(c.name) + '</option>'; }).join('');
        });
      }
      if (method === 'QRIS' && !splitOn) {
        Api.call('public.qrisInfo', {}).then(function (q) {
          m.querySelector('#pay-qris-preview').innerHTML = '<img src="' + q.qris_image_url + '" style="max-width:180px;display:block;margin:10px auto;">';
        }).catch(function () {});
      } else {
        m.querySelector('#pay-qris-preview').innerHTML = '';
      }
    }
    methodSel.addEventListener('change', updateChange);
    receivedInput.addEventListener('input', updateChange);
    updateChange();

    m.querySelector('#pay-submit').addEventListener('click', function () {
      var method = methodSel.value;
      var customerId = method === 'HUTANG' ? m.querySelector('#pay-customer').value : undefined;
      if (method === 'HUTANG' && !customerId) { Utils.toast('Pilih pelanggan untuk transaksi Hutang.', 'error'); return; }

      var payments;
      if (splitOn && method !== 'HUTANG') {
        var method2 = m.querySelector('#pay-method-2').value;
        var amount2 = Number(m.querySelector('#pay-amount-2').value || 0);
        if (amount2 <= 0 || amount2 >= total) { Utils.toast('Nominal metode ke-2 harus lebih dari 0 dan kurang dari total.', 'error'); return; }
        var amount1 = total - amount2;
        payments = [{ method: method, amount: amount1 }, { method: method2, amount: amount2 }];
      } else if (method === 'CASH') {
        var received = Number(receivedInput.value || 0);
        if (received < total) { Utils.toast('Uang diterima kurang dari total.', 'error'); return; }
        payments = [{ method: 'CASH', amount: total, received: received }];
      } else {
        payments = [{ method: method, amount: total }];
      }
      if (method === 'QRIS' || (splitOn && payments.some(function (pe) { return pe.method === 'QRIS'; }))) {
        if (!confirm('Pastikan pembayaran QRIS sudah benar-benar diterima (cek notifikasi/mutasi) sebelum konfirmasi. Lanjutkan?')) return;
      }
      var btn = m.querySelector('#pay-submit'); btn.disabled = true; btn.textContent = 'Memproses...';
      var idempotencyKey = 'sale_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      Api.call('pos.createSale', {
        items: cart.map(function (l) { return { product_id: l.product_id, qty: l.qty, discount: l.discount, unit_id: l.unit_id }; }),
        discount: discount, payments: payments, customer_id: customerId, idempotency_key: idempotencyKey
      }).then(function (result) {
        Utils.closeModal();
        cart = [];
        showReceipt(result.sale_id);
      }).catch(function (err) {
        Utils.toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Selesaikan Transaksi';
      });
    });
  }

  function showReceipt(saleId) {
    Api.call('pos.reprintReceipt', { sale_id: saleId }).then(function (data) {
      var m = Utils.openModal(
        '<h3>Transaksi Berhasil</h3>' +
        '<div class="receipt-preview">' + Utils.escapeHtml(window.ReceiptBuilder.buildTextLines(data).join('\n')) + '</div>' +
        '<div class="field-row" style="margin-top:14px;">' +
        '<button class="btn btn-secondary btn-block" id="btn-print">Cetak Struk</button>' +
        '<button class="btn btn-outline btn-block" id="btn-close">Transaksi Baru</button>' +
        '</div>'
      );
      m.querySelector('#btn-print').addEventListener('click', function () {
        window.PrinterManager.print(data).catch(function (e) { Utils.toast(e.message, 'error'); });
      });
      m.querySelector('#btn-close').addEventListener('click', function () { Utils.closeModal(); Router.render(); });
    });
  }

  return { render: render };
})();
